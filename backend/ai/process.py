import asyncio
import json
from typing import Any, Dict, Tuple, Optional
from fastapi import HTTPException, Request, status
from pydantic import ValidationError
from difflib import SequenceMatcher

from ai.memory import ChatMemoryManager
from ai.model_switcher import (
    get_process_chain,
    get_refinement_chain,
    strategy_chain,
    user_behavior_chain,
    validation_chain,
    reasoning_chain,
)
from config import tars as gemini
from Model.MessageBody import MessageRequest
from Prompts.prompts import get_format_rules
from utils import deep_think as deep_think
from utils.invoke_retry import invoke_with_retry
from utils.parser import process_reasoning_response
from utils.tools import handle_tool_selector
from utils.updates import set_update


VALID_MCP_TYPES = {
    "auto",
    "quick",
    "python",
    "sast",
    "visualization",
    "computer",
    "code_analysis",
    "github",
    "web",
    "internal",
    "stack",
    "context",
}
VALID_OUTPUT_FORMATS = {"codeonly", "explanationonly", "codeandexplanation"}
VALID_PROVIDERS = {"gemini", "chatgpt", "claude"}
VALID_MODELS = {"fast", "advanced", "pro", "quick-think"}

MIN_MESSAGE_LENGTH = 3
MAX_MESSAGE_LENGTH = 100_000
MIN_OUTPUT_FORMAT_LENGTH = 1
MAX_OUTPUT_FORMAT_LENGTH = 500
DEFAULT_MCP_TYPE = "auto"
MIN_CHAT_ID_LENGTH = 1

_processing_lock = asyncio.Lock()
memory_manager = ChatMemoryManager(gemini)

def is_similar(text1: str, text2: str, threshold: float = 0.7) -> bool:
    """Checks if two texts are similar based on a similarity ratio."""
    return SequenceMatcher(None, text1.strip(), text2.strip()).ratio() >= threshold


async def validate_request(payload: Dict[str, Any]) -> Tuple[Optional[MessageRequest], Optional[str]]:
    """Validates the request payload against the MessageRequest model and other constraints."""
    try:
        if "pinnedFiles" in payload:
            gemini.logger.info(
                f"Processing pinnedFiles in validate_request: {payload['pinnedFiles']}"
            )

        msg = MessageRequest(**payload)

        if not msg.message or not (
            MIN_MESSAGE_LENGTH <= len(msg.message) <= MAX_MESSAGE_LENGTH
        ):
            return (
                None,
                f"Message length is invalid. Must be between {MIN_MESSAGE_LENGTH} and {MAX_MESSAGE_LENGTH}",
            )

        output_format = msg.outputFormat.lower() if msg.outputFormat else ""
        if not output_format or not (
            MIN_OUTPUT_FORMAT_LENGTH <= len(output_format) <= MAX_OUTPUT_FORMAT_LENGTH
        ):
            return (
                None,
                f"Output format is invalid. Must be between {MIN_OUTPUT_FORMAT_LENGTH} and {MAX_OUTPUT_FORMAT_LENGTH}",
            )

        if output_format not in VALID_OUTPUT_FORMATS:
            return (
                None,
                f"Invalid output format. Must be one of: {', '.join(VALID_OUTPUT_FORMATS)}",
            )

        chatID = msg.chatId
        if not chatID or len(chatID) < MIN_CHAT_ID_LENGTH:
            return None, "Chat ID is required and must be valid."

        mcp = msg.mcp.lower() if msg.mcp else DEFAULT_MCP_TYPE
        if mcp not in VALID_MCP_TYPES:
            return (
                None,
                f"Invalid MCP type. Must be one of: {', '.join(VALID_MCP_TYPES)}",
            )

        provider_name = msg.providerName.lower().strip()
        if provider_name not in VALID_PROVIDERS:
            return (
                None,
                f"Invalid provider name. Must be one of: {', '.join(VALID_PROVIDERS)}",
            )

        model_type = msg.modelType.lower().strip()
        if model_type not in VALID_MODELS:
            return (
                None,
                f"Invalid model type. Must be one of: {', '.join(VALID_MODELS)}",
            )

        # Length validations based on the provider
        message_length = len(msg.message)
        provider = msg.providerName.lower().strip()

        if provider == "chatgpt" and message_length > 6000:
            return (
                None,
                "ChatGPT models require a maximum message length of 6000 characters.",
            )
        elif provider == "claude" and message_length > 7000:
            return (
                None,
                "Claude models require a maximum message length of 7000 characters.",
            )
        elif provider == "gemini" and message_length > 100000:
            return (
                None,
                "Gemini models require a maximum message length of 100000 characters for better results.",
            )

        # Process pinned files
        if hasattr(msg, "pinnedFiles") and msg.pinnedFiles:
            gemini.logger.info(f"Found pinnedFiles after validation: {msg.pinnedFiles}")

            for idx, file in enumerate(msg.pinnedFiles):
                gemini.logger.info(f"Pinned file {idx}: {file}")
                if not file.path or not file.name:
                    return None, "Pinned files must have both path and name."

            pinned_files_list = [
                file.dict() if hasattr(file, "dict") else {"path": file.path, "name": file.name}
                for file in msg.pinnedFiles
            ]
            msg.pinnedFiles = pinned_files_list
            gemini.logger.info(f"Processed pinnedFiles for query: {msg.pinnedFiles}")
        else:
            gemini.logger.info("No pinnedFiles found in the validated request")

        return msg, None

    except (ValidationError, Exception) as e:
        gemini.logger.error(f"Validation error: {e}")
        return None, f"Invalid request payload: {e}"


async def setup_model_config(model_type: str) -> Dict[str, Any]:
    """Sets up model-specific configurations."""
    config = {"retry_chain": 1, "quick_think": False}

    if model_type == "advanced":
        config["retry_chain"] = 2
    elif model_type == "quick-think":
        config["retry_chain"] = 2
        config["quick_think"] = True

    return config


async def get_memory_data(chatID: str) -> Tuple[Any, list, list, str, bool]:
    """Retrieves and prepares memory data for a given chat ID."""
    mem = memory_manager.get_chat_memory(chatID)
    memory_data = mem.load_memory_variables({}) if mem else {}
    history = memory_data.get("history", [])
    recent_messages = memory_manager.decay_memory(mem, 10) if mem else []
    last_message = recent_messages[-1].content if recent_messages else ""
    return mem, history, recent_messages, last_message, len(history) > 0


async def execute_chains(tasks: Dict[str, asyncio.Task]) -> Dict[str, Any]:
    """Executes multiple asynchronous tasks and captures results or exceptions."""
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    results_map = {}

    for key, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            gemini.logger.error(f"Chain '{key}' failed: {result}")
            results_map[key] = None
        else:
            results_map[key] = result

    return results_map


async def handle_user_behavior(
    user_behavior: Any, has_history: bool, last_message: str
) -> Optional[str]:
    """Handles user behavior analysis and updates RL agent accordingly."""
    if not has_history or not last_message:
        return None

    user_behavior_content = user_behavior.content.strip() if user_behavior else None
    if user_behavior_content not in ["positive", "negative", "neutral"]:
        return None

    set_update(f"User Behavior: {user_behavior_content}")

    action_idx = gemini.actions.index(
        "accept" if user_behavior_content == "positive" else "reject"
    )
    reward = (
        10
        if user_behavior_content == "positive"
        else -10
        if user_behavior_content == "negative"
        else -1
    )

    try:
        gemini.rl_agent.update_q_value(action_idx, reward)
        gemini.logger.info(f"Updated RL agent: action_idx={action_idx}, reward={reward}")
    except AttributeError:
        gemini.logger.warning("RL agent not available or misconfigured.")

    return user_behavior_content


async def process_iteration(
    i: int,
    model_type: str,
    provider_name: str,
    message_query: str,
    history: list,
    recent_messages: list,
    resources: Dict[str, Any],
    personal_info: str,
    custom_prompt: str,
    format_rules: str,
    best_answer: str,
    user_behavior_content: str,
    model_answer_from_reasoning: str,
    current_reasoning: str,
    deep_think_world: Any,
    feedback: str,
    improvements: str,
    quick_think: bool,
) -> Tuple[Optional[str], Optional[str], Optional[int], str, str, str, str, bool]:
    iteration_start_time = asyncio.get_event_loop().time()

    try:
        iter_tasks = {}
        iter_tasks["draft"] = invoke_with_retry(
            get_process_chain(model_type=model_type, provider_type=provider_name),
            {
                "history": history,
                "query": message_query,
                "past_messages": recent_messages,
                "resources": resources,
                "personalInfo": personal_info,
                "customPrompt": custom_prompt,
                "format_rules": format_rules,
                "current_best_answer": best_answer,
                "incentive": user_behavior_content,
                "model_answer": model_answer_from_reasoning,
                "reasoning": current_reasoning,
                "memory_analyzer": deep_think_world,
                "feedback": feedback,
                "improvements": improvements,
            },
        )

        if model_type != "fast" and not quick_think:
            iter_tasks["reasoning"] = invoke_with_retry(
                reasoning_chain(model_type="lite", provider_type=provider_name),
                {
                    "user_query": message_query,
                    "memory": recent_messages + history,
                    "user_sentiment": user_behavior_content,
                },
            )

        iter_results = await execute_chains(iter_tasks)

        draft_resp = iter_results.get("draft")
        if not draft_resp:
            return (
                None,
                None,
                current_reasoning,
                feedback,
                improvements,
                model_answer_from_reasoning,
                False,
            )

        current_draft = draft_resp.content.strip()
        set_update(f"Draft {i+1}: {current_draft[:300]}...")

        reasoning_resp = iter_results.get("reasoning")
        if reasoning_resp:
            try:
                model_answer_from_reasoning = await process_reasoning_response(
                    reasoning_resp, {"message": message_query}
                )
                set_update(f"Reasoning: {current_reasoning[:300]}...")
                if model_answer_from_reasoning:
                    set_update(f"Reasoning Model Answer: {model_answer_from_reasoning[:300]}...")
            except Exception as e:
                gemini.logger.error(
                    f"Reasoning response processing failed in iteration {i + 1}: {e}"
                )

        if model_type == "fast":
            try:
                refine_resp = await invoke_with_retry(
                    get_refinement_chain(model_type="fast", provider_type=provider_name),
                    {
                        "draft": current_draft,
                        "query": message_query,
                        "personalInfo": personal_info,
                        "format_rules": format_rules,
                        "customPrompt": custom_prompt,
                        "history": history,
                    },
                )
                current_refined = refine_resp.content.strip()
                set_update(f"Refined {i+1}: {current_refined[:300]}...")
            except Exception as e:
                gemini.logger.error(
                    f"Refinement chain error in iteration {i + 1}: {e}"
                )
                current_refined = current_draft

            return (
                current_refined,
                10,
                current_reasoning,
                feedback,
                improvements,
                model_answer_from_reasoning,
                True,
            )
        else:
            current_refined = current_draft

        val_resp = None
        current_val_score = 5

        if model_type != "fast":
            try:
                val_resp = await invoke_with_retry(
                    validation_chain(model_type="lite", provider_type=provider_name),
                    {
                        "response": current_refined,
                        "history": history,
                        "recent_messages": recent_messages,
                        "query": message_query,
                    },
                )

                current_val_score = int(val_resp.score)
                feedback = val_resp.feedback
                improvements = val_resp.improvements

                rl_agent = getattr(gemini, "rl_agent", None)
                action = rl_agent.select_action() if rl_agent else "accept"
                time_taken = asyncio.get_event_loop().time() - iteration_start_time

                reward = 0
                if rl_agent:
                    try:
                        reward = rl_agent._compute_reward(
                            gemini.actions.index(action),
                            current_refined,
                            message_query,
                            current_val_score,
                            time_taken,
                        )
                    except Exception as rl_e:
                        gemini.logger.error(f"RL reward computation failed: {rl_e}")

                set_update(
                    f"Validation Score: {current_val_score} and rewarded the RL agent: {reward}"
                )

                if current_val_score == 10 or (action == "accept" and current_val_score >= 8):
                    return (
                        current_refined,
                        current_val_score,
                        current_reasoning,
                        feedback,
                        improvements,
                        model_answer_from_reasoning,
                        True,
                    )

            except Exception as e:
                gemini.logger.error(
                    f"Validation chain or processing error in iteration {i + 1}: {e}"
                )
                feedback = None
                improvements = None
                current_val_score = 5

        return (
            current_refined,
            current_val_score,
            current_reasoning,
            feedback,
            improvements,
            model_answer_from_reasoning,
            False,
        )

    except asyncio.CancelledError:
        gemini.logger.warning("Processing cancelled within iteration.")
        raise
    except Exception as e:
        gemini.logger.error(f"Unexpected error within iteration {i + 1}: {e}")
        return (
            None,
            None,
            current_reasoning,
            feedback,
            improvements,
            model_answer_from_reasoning,
            False,
        )


async def process_message(request: Request) -> Dict[str, Any]:

    start_time = asyncio.get_event_loop().time()

    if _processing_lock.locked():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Processing already in progress.",
        )

    async with _processing_lock:
        try:
            try:
                payload = await request.json()
                gemini.logger.info(f"Request payload keys: {payload.keys()}")
                if "pinnedFiles" in payload:
                    gemini.logger.info(
                        f"Found pinnedFiles in payload: {payload['pinnedFiles']}"
                    )
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON: {e}"
                )

            msg, error = await validate_request(payload)
            if error:
                return {"result": error, "chatId": payload.get("chatId", "")}

            if hasattr(msg, "pinnedFiles"):
                gemini.logger.info(f"After validation, msg has pinnedFiles: {msg.pinnedFiles}")

            model_config = await setup_model_config(msg.modelType.lower().strip())

            set_update(msg.message[:200])

            mem, history, recent_messages, last_message, has_history = (
                await get_memory_data(msg.chatId)
            )
            deep_think_world = (
                deep_think.get_deep_thinking(msg.chatId) if has_history else None
            )

            tool_result = await handle_tool_selector(
                msg.mcp.lower() if msg.mcp else DEFAULT_MCP_TYPE,
                msg,
                history,
                last_message,
                recent_messages,
                request,
                mem,
            )

            if (
                tool_result.get("result") is not None
                and not tool_result.get("continue", False)
            ):
                if tool_result.get("tooling") == "visualization":
                    return {
                        "result": tool_result["result"],
                        "chatId": msg.chatId,
                        "image_url": tool_result.get("image_url"),
                    }
                else:
                    return {"result": tool_result["result"], "chatId": msg.chatId}

            tool_selector = tool_result.get("tooling")

            resources = {
                "stackoverflow": tool_result.get("result")
                if tool_selector == "stack"
                else None,
                "internal": tool_result.get("result")
                if tool_selector == "internal"
                else None,
                "web": tool_result.get("result") if tool_selector == "web" else None,
                "github": tool_result.get("result")
                if tool_selector == "github"
                else None,
                "context": tool_result.get("result")
                if tool_selector == "context"
                else None,
            }

            tasks = {}

            if msg.modelType.lower().strip() != "fast":
                tasks["strategy"] = invoke_with_retry(
                    strategy_chain(
                        model_type="thinking", provider_type=msg.providerName.lower().strip()
                    ),
                    {
                        "query": msg.message,
                        "history": history,
                        "past_messages": recent_messages,
                    },
                )

            if has_history and last_message:
                tasks["behavior"] = invoke_with_retry(
                    user_behavior_chain(
                        model_type="super-lite", provider_type=msg.providerName.lower().strip()
                    ),
                    {
                        "query": msg.message,
                        "response": last_message,
                    },
                )

            results_map = await execute_chains(tasks)

            strategy = results_map.get("strategy")
            strategy_content = strategy.content.strip() if strategy else None
            user_behavior = results_map.get("behavior")
            user_behavior_content = await handle_user_behavior(
                user_behavior, has_history, last_message
            )

            if not user_behavior_content:
                deep_think_world = None

            best_answer = None
            model_answer_from_reasoning = None
            current_reasoning = strategy_content
            feedback = None
            improvements = None
            best_avg_score = float("-inf")

            format_rules = get_format_rules(
                msg.outputFormat.lower() if msg.outputFormat else ""
            )

            for i in range(model_config["retry_chain"]):
                (
                    current_refined,
                    current_val_score,
                    current_reasoning,
                    feedback,
                    improvements,
                    model_answer_from_reasoning,
                    early_exit,
                ) = await process_iteration(
                    i,
                    msg.modelType.lower().strip(),
                    msg.providerName.lower().strip(),
                    msg.message,
                    history,
                    recent_messages,
                    resources,
                    msg.personalInfo,
                    msg.customPrompt,
                    format_rules,
                    best_answer,
                    user_behavior_content,
                    model_answer_from_reasoning,
                    current_reasoning,
                    deep_think_world,
                    feedback,
                    improvements,
                    model_config["quick_think"],
                )

                if not current_refined:
                    continue

                reward = 0
                rl_agent = getattr(gemini, "rl_agent", None)
                if rl_agent:
                    try:
                        time_taken = asyncio.get_event_loop().time() - start_time
                        action = rl_agent.select_action()
                        reward = rl_agent._compute_reward(
                            gemini.actions.index(action),
                            current_refined,
                            msg.message,
                            current_val_score,
                            time_taken,
                        )
                    except Exception as rl_e:
                        gemini.logger.error(f"RL reward computation failed: {rl_e}")

                avg_score = (reward + current_val_score * 2) / 3

                if avg_score > best_avg_score:
                    best_avg_score = avg_score
                    best_answer = current_refined

                if (
                    early_exit
                    or msg.modelType.lower().strip() == "fast"
                    or current_val_score == 10
                ):
                    best_answer = current_refined
                    break

            final_answer = (
                best_answer
                if best_answer
                else "Could not generate a suitable response. Did you check your API keys?"
            )

            if mem:
                try:
                    mem.save_context({"input": msg.message}, {"output": final_answer})
                except Exception as e:
                    gemini.logger.error(f"Failed to save memory for chat {msg.chatId}: {e}")

            total_time_taken = asyncio.get_event_loop().time() - start_time
            gemini.logger.info(
                f"Processing finished for chat {msg.chatId} in {total_time_taken:.2f} seconds"
            )

            return {"result": final_answer, "chatId": msg.chatId}

        except asyncio.CancelledError:
            gemini.logger.warning("Processing cancelled globally")
            raise HTTPException(status_code=499, detail="Processing cancelled by user")
        except HTTPException:
            raise
        except Exception as e:
            gemini.logger.error(f"Unhandled error in process_message: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An internal server error occurred",
            )