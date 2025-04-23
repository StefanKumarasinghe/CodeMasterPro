from datetime import datetime, timedelta
from langchain.memory import ConversationSummaryMemory
from fastapi import HTTPException
from Model.MemoryPayload import MemoryRequest
from pathlib import Path
import config.tars as gemini
import langchain
import shutil
from utils.faiss import build_index

import config.tars as gemini  # Your custom Gemini config

# Global state
gemini_llm = gemini.gemini_llm
chat_memories = gemini.chat_memories
chat_memory_metadata = gemini.chat_memory_metadata


# Get or create memory for a chat
def get_chat_memory(chat_id: str) -> ConversationSummaryMemory:
    now = datetime.now()
    meta = chat_memory_metadata.get(chat_id)

    if chat_id not in chat_memories or not meta or now - meta["created_at"] > timedelta(minutes=60):
        chat_memories[chat_id] = ConversationSummaryMemory(
            llm=gemini_llm,
            max_token_limit=900_000,
            return_messages=True
        )
        chat_memory_metadata[chat_id] = {"created_at": now}
    
    return chat_memories[chat_id]

async def give_memory(payload: MemoryRequest):
    try:
        chat_id = payload.chatId
        input_text = payload.input
        result = payload.result
        if not chat_id or not input_text or not result:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: 'chatId', 'input', or 'result'."
            )
        reset_chat_memory(chat_id)
        mem = get_chat_memory(chat_id)
        mem.save_context({"input": input_text}, {"output": result})
        return {"message": "Memory updated successfully."}
    except Exception as e:
        gemini.logger.error(f"Error in give_memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to update memory.")
    
def reset_chat_memory(chat_id: str):
    if chat_id in chat_memories:
        del chat_memories[chat_id]
    if chat_id in chat_memory_metadata:
        del chat_memory_metadata[chat_id]

async def erase_long_term_memory():
    try:
        reset_chat_memory("default")
        resources_dir = Path("resources")
        if resources_dir.exists() and resources_dir.is_dir():
            for entry in resources_dir.iterdir():
                if entry.is_file():
                    entry.unlink()
                elif entry.is_dir():
                    shutil.rmtree(entry)
        gemini.rl_agent.q_values.clear()
        langchain.llm_cache.clear()
        if gemini.resource_vectorstore:
            gemini.resource_vectorstore = None
        await build_index()

        return {"result": "Cleared all long‑term memories and removed all resource files."}
    except Exception as e:
        gemini.logger.error(f"Error in erase_long_term_memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear long‑term memories.")


