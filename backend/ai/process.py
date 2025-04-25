from fastapi import HTTPException, Request
import asyncio
from Model.MessageBody import MessageRequest
from utils.code_analysis import code_analysis
from Prompts.prompts import get_validation_chain, get_refinement_chain, get_process_chain, code_chain, process_summary_chain
import config.tars as gemini
from utils.stackoverflow import search_stackoverflow_and_rank
from utils.invoke_retry import invoke_with_retry
from utils.faiss import search_resources
from ai.memory import get_chat_memory
import asyncio
from functools import lru_cache

process = False
updates = None
async def process_message(request: Request):
    try:
        global process
        payload = await request.json()
        msg = MessageRequest(**payload)
        await set_update("The user has asked: Please make a plan an outline and reasoning thinking -- message : " + msg.message[:150])

        if (len(msg.message) > 100000) or (len(msg.message) < 3):
            gemini.logger.warning(f"Message length is too long or too short: {len(msg.message)}")
            process = False
            return {
                "result": "Sorry, the message is too long or too short.",
                "chatId": msg.chatId
            }
        
        if len(msg.message) > 25000:
            try:
                result = await code_analysis(msg.message, msg, code_chain)
                process = False
                return {
                    "result": result,
                    "chatId": msg.chatId
                }
            
            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during validation_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
        
        stack_result = None
        if gemini.web_stack_state["enabled"]:
            stack_result = await search_stackoverflow_and_rank(msg.message)
            await set_update("Searching StackOverflow for relevant information... " + str(stack_result[:200]))

        mem = get_chat_memory(msg.chatId)
        history = mem.load_memory_variables({})["history"]
        messages = mem.chat_memory.messages

        await set_update("Updating memory with the latest messages and chat history... " + str(messages[:150]) + str(history[:100]))


        recent_messages = messages[-2:] if len(messages) >= 2 else messages
        internal_resources = None
        if gemini.internal_stack_state["enabled"] or gemini.web_flag_state["enabled"]:
            internal_resources = await search_resources(" User Query : " + str(msg.message) + " ---- This is the history of the chat ->" + str(history), msg)

        resources = {"stackoverflow": stack_result, "internal": internal_resources}
        best_avg_score = -float("inf")
        best_answer = None

        for iteration in range(gemini.RETRY_CHAIN):
            gemini.logger.info(f"Iteration {iteration + 1}: Processing message...")
            try:
                out1 = await invoke_with_retry(get_process_chain(), {
                    "history": history,
                    "query": msg.message,
                    "past_messages": recent_messages,
                    "resources": resources,
                    "language": msg.language,
                    "output_format": msg.outputFormat,
                    "personalInfo": msg.personalInfo,
                    "customPrompt": msg.customPrompt,
                    **msg.dict(exclude={"chatId"})
                })
                draft = out1["text"].strip()
                await set_update("Tars generated a draft response." + draft[:500])
                best_answer = draft


            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during process_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"Iteration {iteration + 1}: process_chain error: {e}")
                continue
            refined=None
            try:
                out2 = await invoke_with_retry(get_refinement_chain(), {
                    "draft": draft,
                    "language": msg.language,
                    "output_format": msg.outputFormat,
                    "personalInfo": msg.personalInfo,
                    "customPrompt": msg.customPrompt,
                    "resources": resources,
                    "history": history,
                    **msg.dict(exclude={"chatId"})
                })
                refined = out2["text"].strip()
                best_answer = refined
                await set_update("Tars has refined your answer" + refined[:500])
            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during refinement_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"Iteration {iteration + 1}: refinement_chain error: {e}")
                best_answer = draft
                continue
            try:
                out3 = await invoke_with_retry(get_validation_chain(), {
                    "response": refined,
                    "query": msg.message,
                    **msg.dict(exclude={"chatId"})
                })
                val_text = out3["text"].strip()
                gemini.logger.info(f"Iteration {iteration + 1}: Validation chain output: {val_text}")
                try:
                    val_score = int(val_text)
                except Exception:
                    gemini.logger.error(f"Iteration {iteration + 1}: Failed to convert validation score: {val_text}")
                    val_score = 5
                await set_update(str(val_score))
            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during validation_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"Iteration {iteration + 1}: validation_chain error: {e}")
                val_score = 5
            action = gemini.rl_agent.select_action()
            reward = gemini.rl_agent._compute_reward(
                gemini.rl_agent,
                gemini.actions.index(action),
                refined,
                msg.message,
                val_score
            )
            composite = reward + val_score
            avg_score = (composite + val_score + reward) / 3
            gemini.logger.info(
                f"Iteration {iteration + 1}: Action: {action} | "
                f"Val Score: {val_score} | Reward: {reward:.2f} | "
                f"Composite: {composite:.2f} | Avg Score: {avg_score:.2f}"
            )

            if avg_score > best_avg_score:
                best_avg_score = avg_score
                best_answer = refined
            if action == "accept" and val_score >= 9:
                mem.save_context({"input": msg.message}, {"output": refined})
                process = False
                return {
                    "result": refined,
                    "chatId": msg.chatId
                }
            
        mem.save_context({"input": msg.message}, {"output": refined})
        process = False
        return {
            "result": best_answer,
            "chatId": msg.chatId
        }

    except asyncio.CancelledError:
        gemini.logger.warning("process_message was cancelled by user.")
        raise HTTPException(status_code=499, detail="Processing cancelled by user.")
    except Exception as e:
        process = False
        gemini.logger.error(f"Error in process_message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    


async def set_update(update):
    global updates
    updates = update

async def get_update():
    return updates

async def get_process_summary():
    if not updates:
        return "Let's get started! Please wait while I process your request."
    if updates.isdigit():
        confidence = min(max(int(updates), 0), 10) * 10
        return f"Well, I have a solution for you. I am {confidence}% confident with the process. Please wait a moment."
    try:
        response = await invoke_with_retry(process_summary_chain, {"process": updates})
        return response.get("text", "").strip()
    except Exception as chain_error:
        return f"Summarization failed: {chain_error} | Fallback also failed: {chain_error}"

async def event_generator(timeout: float = 30.0):
    global updates, process
    updates = None
    process = True
    last_sent = None
    last_update_hash = None
    start_time = asyncio.get_event_loop().time()

    while process:
        now = asyncio.get_event_loop().time()

        if now - start_time > timeout:
            process = False 
            break
        
        await asyncio.sleep(0.05)
        
        current_hash = hash(updates)
        if current_hash == last_update_hash:
            continue
        last_update_hash = current_hash

        current_update = await get_process_summary()

        if current_update and current_update != last_sent:
            yield f"{current_update}\n\n"
            last_sent = current_update

    print("Let me know if you need anything else.")
