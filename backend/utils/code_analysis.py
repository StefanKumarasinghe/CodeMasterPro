import re
from typing import List, Any, Tuple, Optional
import asyncio
from langchain.text_splitter import RecursiveCharacterTextSplitter
import config.tars as gemini
from ai.model_switcher import reword_chain, user_intent_chain, validate_chunk_chain, final_code_prompt_chain
from Prompts.prompts import get_format_rules
from utils.invoke_retry import invoke_with_retry
from utils.updates import set_update
from functools import lru_cache

CHUNK_SIZE = 5000
CHUNK_OVERLAP = 200
REFERENCE_WINDOW_SIZE = 15
MAX_RETRIES = 3
SCORE_THRESHOLD = 85

@lru_cache(maxsize=128)
async def break_code_into_chunks(code_input: str) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=max(3000, CHUNK_SIZE),
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", "."],
    )
    return splitter.split_text(code_input)

async def validate_output(focus_chunk: str, raw_output: str, intent: str) -> int:
    validate = await invoke_with_retry(validate_chunk_chain(model_type="code", provider_type=gemini.providerName), {
        "actual_code": focus_chunk,
        "generated_code": raw_output,
        "user_query": intent
    })
    
    try:
        return int(validate.content.strip())
    except ValueError:
        gemini.logger.warning(f"Invalid validation score format: {validate.content}")
        return 0

async def analyze_chunk(
    index: int,
    focus_chunk: str,
    reference_chunks: List[str],
    prior_results: List[str],
    request_data: Any,
    code_analysis_chain: Any,
    intent: str,
    format_rules: str,
) -> Tuple[Optional[str], Optional[str]]:
    backoff_delay = 1
    retries = 0
    past_results = None
    raw_output = ""
    current_refs = reference_chunks.copy()
    current_prior_results = prior_results.copy()

    while retries < MAX_RETRIES:
        prompt_input = {
            "focus_chunk": focus_chunk,
            "prior_results": current_prior_results,
            "reference_chunks": "\n...\n".join(current_refs),
            "language": request_data.language,
            "format_rules": format_rules,
            "personalInfo": request_data.personalInfo,
            "customPrompt": request_data.customPrompt,
            "past_results": past_results or "",
            **request_data.dict(exclude={"language", "outputFormat", "personalInfo", "customPrompt"}),
            "intent": intent,
        }

        result = await invoke_with_retry(code_analysis_chain, prompt_input)
        raw_output = result.content
        set_update(f"Analyzing chunk {index}...{raw_output[:200]}")

        score = await validate_output(focus_chunk, raw_output, intent)
        
        if score > SCORE_THRESHOLD:
            break
            
        set_update(f"Retrying chunk {index}...{raw_output[:200]}")
        past_results = raw_output

        if len(current_refs) > 1:
            current_refs = current_refs[:max(1, len(current_refs) // 2)]
        
        retries += 1
        await asyncio.sleep(backoff_delay)
        backoff_delay *= 2

    code_match = re.search(r"```(?P<lang>\w+)?\n(?P<code>.*?)\n```", raw_output, re.DOTALL)

    if code_match:
        lang = code_match.group("lang") or "output"
        cleaned_code = code_match.group("code")
    else:
        lang = "output"
        cleaned_code = raw_output

    return lang, cleaned_code

async def analyze_user_intent(intent: str) -> str:
    prompt_input = {"query": intent}
    result = await invoke_with_retry(
        user_intent_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
        prompt_input
    )
    return result.content.strip()

async def process_chunk_batch(batch_data):
    batch_results = []
    for data in batch_data:
        i, focus_chunk, reference_chunks, prior_results, request_data, code_analysis_chain, intent, format_rules = data
        current_lang, cleaned_code = await analyze_chunk(
            i, focus_chunk, reference_chunks, prior_results, 
            request_data, code_analysis_chain, intent, format_rules
        )
        batch_results.append((i, current_lang, cleaned_code))
    return batch_results

async def code_analysis(
    code_input: str,
    request_data: Any,
    code_analysis_chain: Any
) -> str:
    code_sample = code_input[:100] + "..." + code_input[-100:] if len(code_input) > 200 else code_input
    intent = await analyze_user_intent(code_sample)
    set_update(f"Understanding intent...{intent[:200]}")
    code_chunks = await break_code_into_chunks(code_input)
    gemini.logger.info(f"Split input into {len(code_chunks)} chunks")
    set_update(f"Processing {len(code_chunks)} chunks...")

    results = []
    detected_langs = {}
    prior_results = []
    request_data.outputFormat = request_data.outputFormat.strip().lower()
    format_rules = get_format_rules(request_data.outputFormat)
    
    batch_size = 3
    chunked_data = []
    reference_chunks = code_chunks[:]
    
    for i, focus_chunk in enumerate(code_chunks):
        refs = reference_chunks[i+1:i+1+REFERENCE_WINDOW_SIZE]
        chunked_data.append((i, focus_chunk, refs, prior_results.copy(), 
                            request_data, code_analysis_chain, intent, format_rules))
    
    batches = [chunked_data[i:i+batch_size] for i in range(0, len(chunked_data), batch_size)]
    all_results = []
    
    for batch in batches:
        batch_results = await process_chunk_batch(batch)
        all_results.extend(batch_results)
        
    all_results.sort(key=lambda x: x[0])
    
    for _, lang, code in all_results:
        if code and code not in results:
            results.append(code)
            prior_results.append(code)
            
        if lang and lang != "output":
            detected_langs[lang] = detected_langs.get(lang, 0) + 1
    
    detected_lang = max(detected_langs.items(), key=lambda x: x[1])[0] if detected_langs else "output"
    set_update(f"Finalizing output from {len(results)} chunks...")
    
    final_combined_output = "\n".join(results)
    output_format = request_data.outputFormat.strip()

    if output_format == "codeonly":
        final_result = await invoke_with_retry(
            final_code_prompt_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
            {"code": final_combined_output, "intent": intent, "customPrompt": request_data.customPrompt}
        )
        final_output = final_result.content.strip()
        final_output = re.sub(r"```.*?\n", "", final_output, flags=re.DOTALL)
        final_output = re.sub(r"\n```", "", final_output, flags=re.DOTALL)
        return f"```{detected_lang}\n{final_output}\n```"

    elif output_format in ("explanationonly", "codeandexplanation"):
        explanation_result = await invoke_with_retry(
            reword_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
            {"query": final_combined_output, "format_rules": format_rules}
        )
        return explanation_result.content.strip()

    else:
        return f"```{detected_lang}\n{final_combined_output}\n```"