from datetime import datetime, timedelta
from langchain.memory import ConversationSummaryBufferMemory
from fastapi import HTTPException
from Model.MemoryPayload import MemoryRequest
from pathlib import Path
import config.tars as gemini
import langchain
import shutil
from utils.faiss import build_index
from Prompts.prompts import gemini_fast

gemini_llm = gemini_fast
chat_memories = gemini.chat_memories
chat_memory_metadata = gemini.chat_memory_metadata

def get_chat_memory(chat_id: str) -> ConversationSummaryBufferMemory:
    now = datetime.now()
    meta = chat_memory_metadata.get(chat_id)
    
    if chat_id not in chat_memories or not meta or now - meta["created_at"] > timedelta(minutes=15):
        chat_memories[chat_id] = ConversationSummaryBufferMemory(
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
        
        langchain.llm_cache.clear()
        if gemini.resource_vectorstore:
            gemini.resource_vectorstore = None 
        await build_index() 
        return {"result": "Cleared all long‑term memories and removed all resource files."}
    
    except Exception as e:
        gemini.logger.error(f"Error in erase_long_term_memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear long‑term memories.")

def decay_memory(mem, max_history=10, decay_factor=0.8):
    messages = mem.chat_memory.messages
    recent_messages = messages[-max_history:]  
    for i, msg in enumerate(recent_messages):
        if not hasattr(msg, 'relevance'):
            msg.relevance = 1.0 
        msg.relevance *= (decay_factor ** i)
    mem.chat_memory.messages = recent_messages
    return recent_messages
