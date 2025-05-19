from typing import Dict, Optional
from datetime import datetime, timedelta

deep_thinking_states: Dict[str, Dict[str, any]] = {}

def set_deep_thinking(chat_id: str, content: str):
    global deep_thinking_states
    if not chat_id:
        raise ValueError("Chat ID is required")
        
    deep_thinking_states[chat_id] = {
        "content": content,
        "last_updated": datetime.now()
    }

def get_deep_thinking(chat_id: str) -> Optional[str]:
    if not chat_id:
        return None
        
    state = deep_thinking_states.get(chat_id)
    if not state:
        return None
        
    if datetime.now() - state["last_updated"] > timedelta(minutes=15):
        clear_deep_thinking(chat_id)
        return None
        
    return state["content"]

def clear_deep_thinking(chat_id: Optional[str] = None):

    global deep_thinking_states
    if chat_id:
        if chat_id in deep_thinking_states:
            del deep_thinking_states[chat_id]
    else:
        deep_thinking_states.clear()
