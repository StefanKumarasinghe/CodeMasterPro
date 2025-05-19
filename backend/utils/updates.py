import asyncio
from ai.model_switcher import process_summary_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini

class UpdateState:
    def __init__(self):
        self._update = None
        self._event = asyncio.Event()

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

    def has_new_update(self, last_hash):
        return self._update is not None and hash(self._update) != last_hash

update_state = UpdateState()

def set_update(update):
    update_state.set(update)

async def get_process_summary():
    update = await update_state.get()
    if not update:
        return "Understanding your query..."

    if isinstance(update, str) and update.isdigit():
        confidence = min(max(int(update), 0), 10) * 10
        return f"{confidence}% confident with the answer. Checking if it is good enough."

    try:
        chain = process_summary_chain(model_type="super-lite", provider_type=gemini.providerName)
        response = await invoke_with_retry(chain, {"process": update})
        return response.content.strip()
    except Exception as e:
        return f"Summarization failed: {e} | No fallback available."

async def event_generator(timeout: float = 300.0):
    last_hash = None
    while True:
        has_update = await update_state.wait(timeout)
        if not has_update:
            break 

        update_state.clear_event()

        if update_state.has_new_update(last_hash):
            try:
                summary = await get_process_summary()
                yield f"{summary}\n\n"
                last_hash = hash(await update_state.get())
            except Exception as e:
                yield f"Sorry, something went wrong: {e}\n\n"
