import asyncio
from typing import Any, Dict
import random
import config.tars as gemini
from utils.mistral import chat_with_model

async def process_reasoning_response(reason_resp: Any, msg: Dict[str, Any], model_name:str) -> Dict[str, Any]:
    try:
        raw_text = reason_resp.content.strip()
        model = model_name if model_name in gemini.VALID_MODELS else random.choice(list(gemini.VALID_MODELS))
        if not raw_text:
            raise ValueError("Empty reasoning response")
        
        model_answer = await chat_with_model(
            model_name=model,
            message=raw_text,
            user_input=msg['message']
        )

        return {"result": model_answer}
        
    except asyncio.CancelledError:
        gemini.logger.warning("Reasoning response processing cancelled.")
        raise
    except Exception as e:
        gemini.logger.error(f"Error processing reasoning response: {e}")
        return {"reasoning": getattr(reason_resp, 'content', str(e))}