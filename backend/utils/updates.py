import asyncio
from Prompts.prompts import process_summary_chain
from utils.invoke_retry import invoke_with_retry

updates = None

async def set_update(update):
    global updates
    updates = update
    updates_event.set() 
    
async def get_update(): 
    global updates
    return updates

updates_event = asyncio.Event()

async def get_process_summary():
    global updates
    if not updates:
        return "Understanding your query..."    
    if isinstance(updates, str) and updates.isdigit():
        confidence = min(max(int(updates), 0), 10) * 10
        return f"{confidence}% confident with the answer. Checking if it is good enough."
    try:
        response = await invoke_with_retry(process_summary_chain, {"process": updates})
        return response.content.strip()
    except Exception as chain_error:
        return f"Summarization failed: {chain_error} | Fallback also failed: {chain_error}"


async def event_generator(timeout: float = 120.0):
    global updates, process
    updates = None
    process = True
    last_update_hash = None
    start_time = asyncio.get_event_loop().time()

    while process:
        try:
            await asyncio.wait_for(updates_event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            print("Timeout expired.")
            process = False
            break
        updates_event.clear()
        if not process:
            break

        current_update = updates
        current_hash = hash(current_update)

        if current_hash != last_update_hash and current_update is not None:
            try:
                summary = await get_process_summary()
                yield f"{summary}\n\n"
                last_update_hash = current_hash
            except Exception as e:
                yield f"Sorry, but something went wrong, {e}\n\n"
    
    updates = None