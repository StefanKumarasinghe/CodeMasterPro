import shutil
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import HTTPException
from langchain.memory import ConversationSummaryBufferMemory
import langchain
from Model.MemoryPayload import MemoryRequest
from utils.faiss import build_index
from utils.github import delete_all_cloned_repos
from Model.ModelClass import ModelFactory
import config.tars as gemini

model_factory = ModelFactory()

model_provider = model_factory.get_provider(gemini.providerName)
model = model_provider.get_model("lite")

class ChatMemoryManager:

    def __init__(self, gemini_config):
        self.config = gemini_config
        self.config.chat_memories = {}
        self.config.chat_memory_metadata = {}

    def get_chat_memory(self, chat_id: str) -> ConversationSummaryBufferMemory:
        if not chat_id:
            raise ValueError("Chat ID is required")
            
        now = datetime.now()
        meta = self.config.chat_memory_metadata.get(chat_id)

        if chat_id not in self.config.chat_memories or not meta or now - meta["created_at"] > timedelta(minutes=15):
            self.config.chat_memories[chat_id] = ConversationSummaryBufferMemory(
                llm=model,
                max_token_limit=900_000,
                return_messages=True
            )
            self.config.chat_memory_metadata[chat_id] = {
                "created_at": now,
                "last_accessed": now
            }
        else:
            self.config.chat_memory_metadata[chat_id]["last_accessed"] = now
            
        return self.config.chat_memories[chat_id]

    def reset_chat_memory(self, chat_id: str = None):
        if chat_id:
            if chat_id in self.config.chat_memories:
                del self.config.chat_memories[chat_id]
            if chat_id in self.config.chat_memory_metadata:
                del self.config.chat_memory_metadata[chat_id]
            self.config.logger.info(f"Cleared memory for chat {chat_id}")
        else:
            self.config.chat_memories.clear()
            self.config.chat_memory_metadata.clear()
            self.config.logger.info("Cleared all chat memories")

    def get_active_chats(self):
        return list(self.config.chat_memories.keys())

    def get_chat_metadata(self, chat_id: str):
        return self.config.chat_memory_metadata.get(chat_id)

    async def give_memory(self, payload: MemoryRequest):
        try:
            chat_id = payload.chatId
            input_text = payload.input
            result = payload.result
            
            if not chat_id or not input_text or not result:
                self.config.logger.warning("Missing required fields for give_memory")
                raise HTTPException(
                    status_code=400,
                    detail="Missing required fields: 'chatId', 'input', or 'result'"
                )
                
            mem = self.get_chat_memory(chat_id)
            mem.save_context({"input": input_text}, {"output": result})
            return {"message": f"Memory updated successfully for chat {chat_id}"}
        except Exception as e:
            self.config.logger.error(f"Error in give_memory for chat_id {payload.chatId if hasattr(payload, 'chatId') else 'N/A'}: {e}")
            raise HTTPException(status_code=500, detail="Failed to update memory")

    async def erase_long_term_memory(self):
        try:
            self.config.chat_memories.clear()
            self.config.chat_memory_metadata.clear()
            self.config.logger.info("Cleared all chat memories and metadata.")
            await delete_all_cloned_repos()
            self.config.logger.info("Deleted cloned repositories.")
            resources_dir = Path("resources")
            if resources_dir.exists() and resources_dir.is_dir():
                for entry in resources_dir.iterdir():
                    if entry.is_file():
                        entry.unlink()
                    elif entry.is_dir():
                        shutil.rmtree(entry)
                self.config.logger.info("Cleaned up resources directory.")
            else:
                self.config.logger.warning("Resources directory not found during cleanup.")
            try:
                if hasattr(langchain, 'llm_cache') and hasattr(langchain.llm_cache, 'clear'):
                    langchain.llm_cache.clear()
                    self.config.logger.info("Cleared Langchain LLM cache.")
                else:
                    self.config.logger.warning("Could not access langchain.llm_cache.clear.")
            except Exception as cache_err:
                self.config.logger.error(f"Error clearing LLM cache: {cache_err}")
            if hasattr(self.config, 'resource_vectorstore'):
                self.config.resource_vectorstore = None
                self.config.logger.info("Reset resource_vectorstore reference.")
            else:
                self.config.logger.warning("Config object does not have 'resource_vectorstore' attribute.")
            await build_index()
            self.config.logger.info("Rebuilt FAISS index.")
            return {"result": "Cleared all long‑term memories and removed all resource files."}
        except Exception as e:
            self.config.logger.error(f"Error in erase_long_term_memory: {e}")
            raise HTTPException(status_code=500, detail="Failed to clear long‑term memories.")

    def decay_memory(self, mem, max_history=10, decay_factor=0.8):
        if not mem:
            return []
            
        messages = mem.chat_memory.messages
        if len(messages) > max_history:
            recent_messages = messages[-max_history:]
        else:
            recent_messages = messages
            
        for i, msg in enumerate(recent_messages):
            if not hasattr(msg, 'relevance'):
                msg.relevance = 1.0
            msg.relevance *= (decay_factor ** i)
            
        mem.chat_memory.messages = recent_messages
        return recent_messages