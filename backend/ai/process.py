from fastapi import HTTPException, Request
import asyncio

from Model.MessageBody import MessageRequest
from utils.code_analysis import code_analysis
from Prompts.prompts import get_validation_chain, get_refinement_chain, get_process_chain, code_chain
import config.tars as gemini
from utils.stackoverflow import search_stackoverflow_and_rank
from utils.invoke_retry import invoke_with_retry
from utils.faiss import search_resources
from ai.memory import get_chat_memory
from datetime import datetime

async def process_message(request: Request):
    try:
        payload = await request.json()
        msg = MessageRequest(**payload)
        if len(msg.message) > 15000:
            result = await code_analysis(msg.message, msg, code_chain)
            return {
                "result": result,
                "chatId": msg.chatId
            }
        
        stack_result = None
        if gemini.web_stack_state["enabled"]:
            stack_result = await search_stackoverflow_and_rank(msg.message)


        if (len(msg.message) > 100000) or (len(msg.message) < 3):
            gemini.logger.warning(f"Message length is too long or too short: {len(msg.message)}")
            return {
                "result": "Sorry, the message is too long or too short.",
                "chatId": msg.chatId
            }
        mem = get_chat_memory(msg.chatId)
        history = mem.load_memory_variables({})["history"]
        #get last 2 messages 
        messages = mem.chat_memory.messages
        # Get the last 2 messages (or all if fewer than 2)
        recent_messages = messages[-2:] if len(messages) >= 2 else messages
        internal_resources = None
        if gemini.internal_stack_state["enabled"] or gemini.web_flag_state["enabled"]:
            internal_resources = await search_resources(str(msg.message) + "This is the history of the chat" + str(history), msg)
        #print (f"Internal resources: {internal_resources}")
        resources = {
            "stackoverflow": stack_result,
            "internal": internal_resources
        }

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
                best_answer = draft

            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during process_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"Iteration {iteration + 1}: process_chain error: {e}")
                continue

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
            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during refinement_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"Iteration {iteration + 1}: refinement_chain error: {e}")
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
                return {
                    "result": refined,
                    "chatId": msg.chatId
                }
            
        mem.save_context({"input": msg.message}, {"output": refined})
        return {
            "result": best_answer,
            "chatId": msg.chatId
        }

    except asyncio.CancelledError:
        gemini.logger.warning("process_message was cancelled by user.")
        raise HTTPException(status_code=499, detail="Processing cancelled by user.")
    except Exception as e:
        gemini.logger.error(f"Error in process_message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
