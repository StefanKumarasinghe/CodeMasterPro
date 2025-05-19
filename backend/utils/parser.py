import re
import json
import asyncio
from typing import Any, Dict, Optional

from Model.MessageBody import MessageRequest
import config.tars as gemini
from utils.mistral import chat_with_model

VALID_MODELS = {
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    "Qwen/Qwen3-235B-A22B-fp8-tput",
    "Qwen/QwQ-32B",
    "deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "deepseek-ai/DeepSeek-V3",
    "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    "meta-llama/Llama-Vision-Free",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct-Turbo",
    "mistralai/Mistral-Small-24B-Instruct-2501",
    "google/gemma-3-27b-it"
}

DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"


async def process_reasoning_response(reason_resp: Any, msg: MessageRequest) -> Dict[str, Any]:
    try:
        raw_text = reason_resp.content.strip()
        model = msg.free_model if msg.free_model and msg.free_model in VALID_MODELS else DEFAULT_MODEL
        
        if not raw_text:
            raise ValueError("Empty reasoning response")
            
        model_answer = await chat_with_model(
            model_name=model,
            message=raw_text,
            user_input=msg.message
        )
        
        return {"result": model_answer}
        
    except asyncio.CancelledError:
        gemini.logger.warning("Reasoning response processing cancelled.")
        raise
    except Exception as e:
        gemini.logger.error(f"Error processing reasoning response: {e}")
        return {"reasoning": getattr(reason_resp, 'content', str(e))}