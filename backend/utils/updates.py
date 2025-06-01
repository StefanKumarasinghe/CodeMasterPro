import asyncio
import time
from ai.model_switcher import process_summary_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini

_process_summary_chain_cache = {}

def _get_or_create_process_summary_chain(model_type: str, provider_type: str):
    cache_key = (model_type, provider_type)
    if cache_key not in _process_summary_chain_cache:
        _process_summary_chain_cache[cache_key] = process_summary_chain(
            model_type=model_type,
            provider_type=provider_type
        )
    return _process_summary_chain_cache[cache_key]

class UpdateState:
    def __init__(self):
        self._update = None
        self._event = asyncio.Event()
        self._last_emit_time = 0
        self._last_emitted_summary = None
        self._last_emitted_input_hash = None

    def set(self, value):
        self._update = value
        self._event.set()

    async def get(self):
        return self._update

    def clear_event(self):
        self._event.clear()

    async def wait(self, timeout):
        try:
            await asyncio.wait_for(self._event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    def has_new_update(self):
        if self._update is None:
            return False
        current_input_hash = hash(str(self._update))
        return current_input_hash != self._last_emitted_input_hash

    def is_summary_different(self, summary):
        if self._last_emitted_summary is None:
            return True
        return summary.strip() != self._last_emitted_summary.strip()

    def mark_as_emitted(self, summary):
        if self._update is not None:
            self._last_emitted_input_hash = hash(str(self._update))
            self._last_emitted_summary = summary.strip()

    def should_emit(self):
        current_time = time.time()
        if current_time - self._last_emit_time >= 1.0:
            self._last_emit_time = current_time
            return True
        return False

class ChatUpdateManager:
    def __init__(self):
        self._chat_states = {}
        self._cleanup_lock = asyncio.Lock()

    def get_update_state(self, chat_id: str) -> UpdateState:
        if chat_id not in self._chat_states:
            self._chat_states[chat_id] = UpdateState()
        return self._chat_states[chat_id]

    async def cleanup_old_states(self, max_age_seconds: int = 3600):
        async with self._cleanup_lock:
            current_time = time.time()
            to_remove = []

            for chat_id, state in self._chat_states.items():
                if current_time - state._last_emit_time > max_age_seconds:
                    to_remove.append(chat_id)

            for chat_id in to_remove:
                del self._chat_states[chat_id]

    def remove_chat_state(self, chat_id: str):
        if chat_id in self._chat_states:
            del self._chat_states[chat_id]

chat_update_manager = ChatUpdateManager()

def set_update(update: str, chat_id: str):
    update_state = chat_update_manager.get_update_state(chat_id)
    update_state.set(update)

async def get_process_summary(chat_id: str):
    update_state = chat_update_manager.get_update_state(chat_id)
    update = await update_state.get()
    if not update:
        return "Understanding your query..."

    if isinstance(update, str) and update.isdigit():
        confidence = min(max(int(update), 0), 10) * 10
        return f"{confidence}% confident with the answer. Checking if it is good enough."

    try:
        chain = _get_or_create_process_summary_chain(model_type="super-lite", provider_type=gemini.providerName)
        response = await invoke_with_retry(chain, {"process": update})
        return response.content.strip()
    except Exception as e:
        return f"Summarization failed: {e} | No fallback available."

async def event_generator(chat_id: str, timeout: float = 300.0):
    update_state = chat_update_manager.get_update_state(chat_id)

    while True:
        has_update = await update_state.wait(timeout)
        if not has_update:
            break

        update_state.clear_event()

        if update_state.has_new_update() and update_state.should_emit():
            try:
                summary = await get_process_summary(chat_id)
                if update_state.is_summary_different(summary):
                    yield f"{summary}\n\n"
                    update_state.mark_as_emitted(summary)
            except Exception as e:
                error_msg = f"Sorry, something went wrong: {e}"
                if update_state.is_summary_different(error_msg):
                    yield f"{error_msg}\n\n"
                    update_state.mark_as_emitted(error_msg)