import shutil
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import HTTPException
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, trim_messages, SystemMessage
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from typing import List, Dict, Any
import langchain
from Model.MemoryPayload import MemoryRequest
from utils.faiss import build_index
from utils.github import delete_all_cloned_repos
from Model.ModelClass import ModelFactory
import config.tars as gemini

model_factory = ModelFactory()

model_provider = model_factory.get_provider(gemini.providerName)
model = model_provider.get_model("lite")

class ModernChatMemory:
    
    def __init__(self, llm, max_token_limit: int = 900_000, return_messages: bool = True):
        self.llm = llm
        self.max_token_limit = max_token_limit
        self.return_messages = return_messages
        self.chat_memory = InMemoryChatMessageHistory()
        self._summary = ""
        self._last_summary_length = 0
    
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        input_str = inputs.get("input", "")
        output_str = outputs.get("output", "")
        
        if input_str:
            self.chat_memory.add_message(HumanMessage(content=input_str))
        if output_str:
            self.chat_memory.add_message(AIMessage(content=output_str))
        
        self._trim_messages_if_needed()
    
    def _trim_messages_if_needed(self) -> None:
        try:
            messages = self.chat_memory.messages
            if len(messages) > 50:
                total_tokens = sum(len(str(msg.content)) for msg in messages)
                
                if total_tokens > self.max_token_limit:
                    messages_to_keep = messages[-20:]
                    messages_to_summarize = messages[:-20]
                    
                    if messages_to_summarize and len(messages_to_summarize) > self._last_summary_length:
                        self._update_summary(messages_to_summarize)
                        self._last_summary_length = len(messages_to_summarize)
                    
                    self.chat_memory.clear()
                    if self._summary:
                        self.chat_memory.add_message(SystemMessage(content=f"Previous conversation summary: {self._summary}"))
                    for msg in messages_to_keep:
                        self.chat_memory.add_message(msg)
                        
        except Exception as e:
            messages = self.chat_memory.messages
            if len(messages) > 30:
                self.chat_memory.clear()
                for msg in messages[-30:]:
                    self.chat_memory.add_message(msg)
    
    def _update_summary(self, removed_messages: List[BaseMessage]) -> None:
        if not removed_messages:
            return
            
        try:
            conversation_text = "\n".join([
                f"{'Human' if isinstance(msg, HumanMessage) else 'AI'}: {msg.content[:200]}"
                for msg in removed_messages
                if hasattr(msg, 'content') and msg.content
            ])
            
            if self._summary:
                self._summary += f"\n\nContinuation: {conversation_text[:800]}..."
            else:
                self._summary = f"Previous conversation: {conversation_text[:800]}..."
                
        except Exception:
            self._summary = f"Previous conversation with {len(removed_messages)} messages exchanged."
    
    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        if self.return_messages:
            return {"history": self.chat_memory.messages}
        else:
            messages_str = "\n".join([
                f"{'Human' if isinstance(msg, HumanMessage) else 'AI'}: {msg.content}"
                for msg in self.chat_memory.messages
                if hasattr(msg, 'content')
            ])
            return {"history": messages_str}
    
    def get_recent_messages(self, max_count: int = 10) -> List[BaseMessage]:
        messages = self.chat_memory.messages
        if len(messages) <= max_count:
            return messages.copy()
        return messages[-max_count:].copy()
    
    def clear(self) -> None:
        self.chat_memory.clear()
        self._summary = ""
        self._last_summary_length = 0

class ChatMemoryManager:

    def __init__(self, gemini_config):
        self.config = gemini_config
        self.config.chat_memories = {}
        self.config.chat_memory_metadata = {}

    def get_chat_memory(self, chat_id: str) -> ModernChatMemory:
        if not chat_id:
            raise ValueError("Chat ID is required")
            
        now = datetime.now()
        meta = self.config.chat_memory_metadata.get(chat_id)

        if chat_id not in self.config.chat_memories or not meta or now - meta["created_at"] > timedelta(minutes=15):
            self.config.chat_memories[chat_id] = ModernChatMemory(
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
        
        recent_messages = mem.get_recent_messages(max_history)
        
        processed_messages = []
        for i, msg in enumerate(recent_messages):
            if hasattr(msg, 'copy'):
                msg_copy = msg.copy()
            else:
                if isinstance(msg, HumanMessage):
                    msg_copy = HumanMessage(content=msg.content)
                elif isinstance(msg, AIMessage):
                    msg_copy = AIMessage(content=msg.content)
                elif isinstance(msg, SystemMessage):
                    msg_copy = SystemMessage(content=msg.content)
                else:
                    msg_copy = msg
            
            msg_copy.relevance = decay_factor ** i
            processed_messages.append(msg_copy)
        
        return processed_messages