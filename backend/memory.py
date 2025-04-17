from datetime import datetime, timedelta
from langchain.memory import ConversationSummaryMemory
from langchain_google_genai import GoogleGenerativeAI
chat_memories: dict[str, ConversationSummaryMemory] = {}
chat_memory_metadata: dict[str, dict] = {}
gemini_llm = GoogleGenerativeAI(model="gemini-2.0-flash",temperature=0.6)

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
    memory = chat_memories[chat_id]
    return memory
