from fastapi import HTTPException, Request
import asyncio
from Model.MessageBody import MessageRequest
from utils.code_analysis import code_analysis
from Prompts.prompts import validation_chain, get_refinement_chain, get_process_chain, code_chain, process_summary_chain, user_behavior_chain
import config.tars as gemini
from utils.stackoverflow import search_stackoverflow_and_rank
from utils.invoke_retry import invoke_with_retry
from utils.faiss import search_resources
from ai.memory import get_chat_memory, decay_memory
import asyncio
from utils.updates import set_update

process = False

async def process_message(request: Request):
    try:
        global process
        payload = await request.json()
        msg = MessageRequest(**payload)
        await set_update("USER QUERY" + msg.message[:150])

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
                  
        mem = get_chat_memory(msg.chatId)
        history = mem.load_memory_variables({})["history"]
        recent_messages = decay_memory(mem, 4)
        user_behavior_result = await invoke_with_retry(user_behavior_chain, {
            "query": msg.message,
            "response": recent_messages[-1].content if recent_messages else ""
        })

        stack_result = None
        internal_resources = None
        tasks = []

        if gemini.web_stack_state["enabled"]:
            tasks.append(search_stackoverflow_and_rank(msg.message))

        if gemini.internal_stack_state["enabled"] or gemini.web_flag_state["enabled"]:
            query = "User Query: " + str(msg.message) + " ---- This is the history of the chat ->" + str(history)
            tasks.append(search_resources(query, msg))

        results = await asyncio.gather(*tasks)

        idx = 0
        if gemini.web_stack_state["enabled"]:
            stack_result = results[idx]
            await set_update("Searching StackOverflow for relevant information... " + str(stack_result[:200]))
            idx += 1

        if gemini.internal_stack_state["enabled"] or gemini.web_flag_state["enabled"]:
            internal_resources = results[idx]

        user_behavior_result = user_behavior_result.content.strip()

        if user_behavior_result=="positive":
             gemini.rl_agent.update_q_value(gemini.actions.index("accept"), 10)
        elif user_behavior_result=="negative":
            gemini.rl_agent.update_q_value(gemini.actions.index("reject"), -10)
        elif user_behavior_result=="neutral":
            gemini.rl_agent.update_q_value(gemini.actions.index("accept"), -1)
        
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
                    "outputFormat": msg.outputFormat,
                    "personalInfo": msg.personalInfo,
                    "customPrompt": msg.customPrompt,
                    "previous_best_answer": best_answer,
                    "incentive": user_behavior_result,
                    **msg.dict(exclude={"chatId"})\
                })
                draft = out1.content.strip()
                await set_update("Tars generated a draft response : " + draft[:500])
                best_answer = draft

            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during process_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"Iteration {iteration + 1}: process_chain error: {e}")
                continue

            refined = draft
            try:
                out2 = await invoke_with_retry(get_refinement_chain(), {
                    "draft": draft,
                    "language": msg.language,
                    "outputFormat": msg.outputFormat,
                    "personalInfo": msg.personalInfo,
                    "customPrompt": msg.customPrompt,
                    "resources": resources,
                    "history": history,
                    "incentive": user_behavior_result,
                    **msg.dict(exclude={"chatId"})\
                })

                refined = out2.content.strip()
                await set_update("Tars has refined your answer" + refined[:500])
            except asyncio.CancelledError:
                gemini.logger.warning("process_message was cancelled during refinement_chain.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"Iteration {iteration + 1}: refinement_chain error: {e}")

            best_answer = refined

            try:
                out3 = await invoke_with_retry(validation_chain, {
                    "response": refined,
                    "query": msg.message,
                    **msg.dict(exclude={"chatId"})\
                })
                val_text = out3.content.strip()
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
            
            recent_messages = decay_memory(mem, 10)

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
        raise HTTPException(status_code=e.status_code if hasattr(e, 'status_code') else 500, detail=str(e))

