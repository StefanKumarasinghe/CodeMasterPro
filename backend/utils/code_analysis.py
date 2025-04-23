import re
from typing import List, Any, Tuple, Optional
import asyncio
from langchain.text_splitter import RecursiveCharacterTextSplitter
import config.tars as gemini
from Prompts.prompts import reword_chain, user_intent_chain, validate_chunk_chain
from utils.invoke_retry import invoke_with_retry


CHUNK_SIZE = 2000
CHUNK_OVERLAP = 0
REFERENCE_WINDOW_SIZE = 10

async def break_code_into_chunks(code_input: str) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=max(100, CHUNK_SIZE),
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n" , "\n", " "],
    )
    return splitter.split_text(code_input)

async def analyze_chunk(
    index: int,
    focus_chunk: str,
    reference_chunks: List[str],
    prior_results: List[str],
    request_data: Any,
    code_analysis_chain: Any,
    intent: str,
    max_retries: int = 4
) -> Tuple[Optional[str], Optional[str]]:
    try:
        backoff_delay = 1
        retries = 0
        past_results = None
        raw_output = ""
        current_refs = reference_chunks.copy()
        current_prior_results = prior_results.copy()

        while retries < max_retries:
            prompt_input = {
                "focus_chunk": focus_chunk,
                "prior_results": current_prior_results,
                "reference_chunks": "\n...\n".join(current_refs),
                "language": request_data.language,
                "outputFormat": request_data.outputFormat,
                "personalInfo": request_data.personalInfo,
                "customPrompt": request_data.customPrompt,
                "past_results": past_results or "",
                **request_data.dict(exclude={"language", "outputFormat", "personalInfo", "customPrompt"}),
                "intent": intent,
            }

            result = await invoke_with_retry(code_analysis_chain, prompt_input)
            raw_output = result.get("text", "")

            validate = await invoke_with_retry(validate_chunk_chain, {
                "actual_code": focus_chunk,
                "generated_code": raw_output,
                "user_query": intent
            })

            try:
                score = int(validate["text"].strip())
            except ValueError:
                gemini.logger.warning(f"Invalid validation score format: {validate['text']}")
                score = 0

            print(f"Validation score: {score}")
            gemini.logger.debug(f"[Retry {retries + 1}] Validation score for chunk {index}: {score}")

            if score > 90:
                break

            past_results = raw_output

            # Shrink reference and prior result context to improve focus
            if len(current_refs) > 1:
                current_refs = current_refs[:len(current_refs) // 2]
            if len(current_prior_results) > 1:
                current_prior_results = current_prior_results[len(current_prior_results) // 2:]

            retries += 1
            await asyncio.sleep(backoff_delay)
            backoff_delay *= 2

        gemini.logger.debug(f"Final output for chunk {index}: {raw_output}")

        code_match = re.search(r"```(?P<lang>\w+)?\n(?P<code>.*?)\n```", raw_output, re.DOTALL)

        if code_match:
            lang = code_match.group("lang") or "output"
            cleaned_code = code_match.group("code")
        else:
            lang = "output"
            cleaned_code = raw_output

        return lang, cleaned_code

    except Exception as e:
        gemini.logger.warning(
            f"Retries exhausted or error occurred for chunk {index}. "
            f"Returning original focus chunk content. Error: {e}"
        )
        return "output", focus_chunk

async def analyze_user_intent(intent: str) -> None:
    try:
        prompt_input = {
            "query": intent,
        }
        result = await invoke_with_retry(user_intent_chain, prompt_input)
        result = result["text"].strip()
        return result

    except Exception as e:
        gemini.logger.error(f"User intent analysis failed: {e}")


async def code_analysis(
    code_input: str,
    request_data: Any,
    code_analysis_chain: Any
) -> str:
    code_input_temp = code_input[:100] + code_input[-100:]
    intent = await analyze_user_intent(code_input_temp)
    print(f"User intent: {intent}")
    code_chunks = await break_code_into_chunks(code_input)
    gemini.logger.info(f"Split input into {len(code_chunks)} chunks.")

    results = []
    prior_results = []
    detected_lang = "output"
    reference_chunks = code_chunks[:]

    for i, focus_chunk in enumerate(code_chunks):
        gemini.logger.debug(f"Analyzing chunk {i + 1}/{len(code_chunks)}")
        reference_chunks = reference_chunks[i + 1:i + 1 + REFERENCE_WINDOW_SIZE]

        current_lang, cleaned_code = await analyze_chunk(
            i,
            focus_chunk,
            reference_chunks,
            prior_results,
            request_data,
            code_analysis_chain,
            intent
        )

        if cleaned_code:
            if cleaned_code not in results:
                results.append(cleaned_code)

            prior_results.append(cleaned_code)

            if current_lang and detected_lang == "output" and current_lang != "output":
                detected_lang = current_lang
        else:
            gemini.logger.warning(f"Chunk {i + 1} analysis failed or returned empty result.")

    final_combined_output = "\n".join(results)
    output_format = request_data.outputFormat.strip()

    if output_format == "codeOnly":
        return f"```{detected_lang}\n{final_combined_output}\n```"

    elif output_format in ("explanationOnly", "codeAndExplanation"):
        explanation_input = {
            "query": final_combined_output,
            "outputFormat": request_data.outputFormat,
        }

        gemini.logger.info("Generating final explanation/combined output...")
        explanation_result = await invoke_with_retry(reword_chain, explanation_input)
        return str(explanation_result["text"]).strip()

    else:
        gemini.logger.warning(f"Unknown output format: {output_format}. Defaulting to codeOnly.")
        return f"```{detected_lang}\n{final_combined_output}\n```"
