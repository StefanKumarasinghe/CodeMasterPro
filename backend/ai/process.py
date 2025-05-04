from fastapi import HTTPException, Request
import asyncio
import json
import re
from Model.MessageBody import MessageRequest
from utils.code_analysis import code_analysis
from Prompts.prompts import (validation_chain,get_refinement_chain,get_process_chain,code_chain,reasoning_chain,user_behavior_chain, tool_chain, analyse_changes_python_chain, quick_answer_chain, analyse_bandit_chain, analyse_compute_chain)
import config.tars as gemini
from utils.stackoverflow import search_stackoverflow_and_rank
from utils.invoke_retry import invoke_with_retry
from utils.faiss import search_resources
from ai.memory import get_chat_memory, decay_memory
from utils.updates import set_update
from utils.mistral import chat_with_model
from utils.shell import run_python_code, init_python_session, close_python_session
from Model.CodePayload import CodePayload
from Model.SessionPayload import SessionPayload
from utils.bandit import generate_bandit_code

process = False
async def process_message(request: Request):
    global process
    try:
        payload = await request.json()
        msg = MessageRequest(**payload)
        mcp = msg.mcp.lower()

        msg_len = len(msg.message)
        if msg_len > 100_000 or msg_len < 3:
            gemini.logger.warning(f"Invalid message length: {msg_len}")
            process = False
            return {"result": "Sorry, the message is too long or too short.", "chatId": msg.chatId}

        await set_update(msg.message[:250])

        if msg_len > 50_000:
            try:
                result = await code_analysis(msg.message, msg, code_chain)
                process = False
                return {"result": result, "chatId": msg.chatId}
            except asyncio.CancelledError:
                gemini.logger.warning("Cancelled during code analysis.")
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")

        mem = get_chat_memory(msg.chatId)
        memory_data = mem.load_memory_variables({})
        history = memory_data.get("history", [])
        recent_messages = decay_memory(mem, 4)
        last_message = recent_messages[-1].content if recent_messages else ""

        user_behavior = "Not applicable as no history"
        internal_resources = None
        stack_result = None
        tool_selector = None

        if not (gemini.web_stack_state["enabled"] or gemini.internal_stack_state["enabled"] or gemini.web_flag_state["enabled"]):

            tool_selector = await invoke_with_retry(tool_chain, {
                "query": msg.message,
                "history": history,
                "past_messages": last_message,
            })

            tool_selector = tool_selector.content.strip()

        if tool_selector == "quick" or mcp == "quick":
            await set_update("We are running a quick answer to validate your code.")
            result = await invoke_with_retry(quick_answer_chain, {
                "query": msg.message,
                "history": history,
                "recent_messages": recent_messages,
                "outputFormat": msg.outputFormat,
                "personalInfo": msg.personalInfo,
                "customPrompt": msg.customPrompt,
                
            })
            result = result.content.strip()
            process = False
            mem.save_context({"input": msg.message}, {"output": result})
            return {"result": result, "chatId": msg.chatId}
        
        elif tool_selector == "bandit" or mcp == "sast":
            await set_update("We are running a Bandit code analysis to validate your  python code.")
            try:
                client_ip = request.client.host
                session = await init_python_session(client_ip=client_ip)
                code=generate_bandit_code(str(msg.message) + "PAST MESSAGE : " + str(recent_messages))
                result = await run_python_code(CodePayload(
                    session_id=session["session_id"],
                    code=code,
                ))
                result = await invoke_with_retry(analyse_bandit_chain, {"result": result["stdout"], "query": msg.message})
                result = result.content.strip()
                await close_python_session(SessionPayload(
                    session_id=session["session_id"],
                ))
                process = False
                mem.save_context({"input": msg.message}, {"output": result})
                return {"result": result, "chatId": msg.chatId}
            except Exception as e:
                gemini.logger.error(f"Python execution error: {e}")
                await close_python_session(SessionPayload(session_id=session["session_id"]))
                process = False
                return {"result": "We couldn't validate your code", "chatId": msg.chatId}

        elif tool_selector == "python" or mcp == "python":
            await set_update("I am creating a Python session for you and running your code.")
            try:
                client_ip = request.client.host
                session = await init_python_session(client_ip=client_ip)
                code_check = str(msg.message) + "PAST MESSAGE : " + str(recent_messages)
                code_check = re.search(r"```python(.*?)```", code_check, re.DOTALL)
                if code_check:
                    code_check = code_check.group(1)

                result = await run_python_code(CodePayload(
                    session_id=session["session_id"],
                    code=code_check if code_check else msg.message,
                ))
                result = await invoke_with_retry(analyse_changes_python_chain, {"result": result, "query": msg.message})
                result = result.content.strip()
                process = False
                mem.save_context({"input": msg.message}, {"output": result})
                await close_python_session(SessionPayload(
                    session_id=session["session_id"],
                ))
                return {"result": result, "chatId": msg.chatId}
            except Exception as e:
                gemini.logger.error(f"Python execution error: {e}")
                process = False
                await close_python_session(SessionPayload(session_id=session["session_id"]))
                return {"result": "We couldn't validate your code", "chatId": msg.chatId}
            
        elif tool_selector == "visualization" or mcp == "visualize":
            await set_update("We are generating and running a python code to visualize the logs, or input data to the best of my ability.")
            try:
                client_ip = request.client.host
                session = await init_python_session(client_ip=client_ip)
                code_check = str(msg.message) + "PAST MESSAGE : " + str(recent_messages)
                instruction = (
                    "# I want you to try your best to visualize the logs or input data.\n"
                    "# Use your best judgment to generate a visualization.\n"
                    "# Save the image in a buffer and return it as a data URL:\n"
                    "#   data:image/{gif or png};base64,<encoded_image>\n"
                    "# Do NOT load or launch the app.\n"
                )
                code_check = instruction + code_check
                
                result = await run_python_code(CodePayload(
                    session_id=session["session_id"],
                    code=code_check if code_check else msg.message,
                ))
                print(result)
                image_url = None
                if "stdout" in result and isinstance(result["stdout"], str) and "data:" in result["stdout"]:
                    image_url = result["stdout"]
                    result["stdout"] = "Successfully returned the image URL. Stripped to reduce overhead."

                result = await invoke_with_retry(analyse_changes_python_chain, {"result": result, "query": msg.message})
                result = result.content.strip()
                
                process = False
                mem.save_context({"input": msg.message}, {"output": result})
                await close_python_session(SessionPayload(session_id=session["session_id"]))

                return {"result": result, "chatId": msg.chatId, "image_url" :  image_url}
            except Exception as e:
                gemini.logger.error(f"Python execution error: {e}")
                process = False
                await close_python_session(SessionPayload(
                    session_id=session["session_id"],
                ))
                return {"result": "We couldn't validate your code", "chatId": msg.chatId}
            
        elif tool_selector == "computer" or mcp == "compute":
            await set_update("We are generating and running a python code to compute a complex problem, or input data to the best of my ability.")
            try:
                client_ip = request.client.host
                session = await init_python_session(client_ip=client_ip)
                code_check = str(msg.message)
                code_check = "# I want you to solve this complex problem using a python algorithm and print the answer, find the best way to solve this complex problem \n  #" + code_check
                result = await run_python_code(CodePayload(
                    session_id=session["session_id"],
                    code=code_check if code_check else msg.message,
                ))

                result = await invoke_with_retry(analyse_compute_chain, {"result": result, "query": msg.message})
                result = result.content.strip()
                process = False
                mem.save_context({"input": msg.message}, {"output": result})
                await close_python_session(SessionPayload(
                    session_id=session["session_id"],
                ))

                return {"result": result, "chatId": msg.chatId}
            except Exception as e:
                gemini.logger.error(f"Python execution error: {e}")
                process = False
                await close_python_session(SessionPayload(
                    session_id=session["session_id"],
                ))
                return {"result": "We couldn't validate your code", "chatId": msg.chatId}

        elif tool_selector == "code_analysis" or mcp == "deep_analysis":
            await set_update("We are analyzing your code and using CodeAnalystPrompt to generate the best response.")
            result = await code_analysis(msg.message, msg, code_chain)
            process = False
            mem.save_context({"input": msg.message}, {"output": result})
            return {"result": result, "chatId": msg.chatId}
        
        if len(history) > 0 or gemini.web_stack_state["enabled"] or gemini.internal_stack_state["enabled"] or gemini.web_flag_state["enabled"] or tool_selector in ["web", "stack", "internal"]:
            behavior_result = await invoke_with_retry(user_behavior_chain, {
                "query": msg.message, "response": last_message
            })
            if gemini.web_stack_state["enabled"] or (tool_selector == "stack" and mcp == "auto"):
                stack_result = await search_stackoverflow_and_rank(msg.message)

            if gemini.internal_stack_state["enabled"] or gemini.web_flag_state["enabled"] or ( tool_selector in ["internal", "web"] and mcp == "auto"):
                full_query = f"User Query: {msg.message} ---- History: {history}"
                internal_resources = await search_resources(full_query, msg, tool_selector)

            user_behavior = behavior_result.content.strip()

            action_idx = gemini.actions.index("accept" if user_behavior == "positive" else "reject")

            gemini.rl_agent.update_q_value(action_idx, 10 if user_behavior == "positive" else -10 if user_behavior == "negative" else -1)

        resources = {"stackoverflow": stack_result, "internal": internal_resources}

        best_answer, model_answer, reasoning, feedback, improvements = None, None, None, None, None
        best_avg_score = float("-inf")
        high_score, retry_count = 0, 0
        for i in range(gemini.RETRY_CHAIN):
            gemini.logger.info(f"Iteration {i + 1} started.")
            try:
                draft_resp = await invoke_with_retry(get_process_chain(), {
                    **msg.dict(exclude={"chatId"}),
                    "history": history,
                    "query": msg.message,
                    "past_messages": recent_messages,
                    "resources": resources,
                    "outputFormat": msg.outputFormat,
                    "personalInfo": msg.personalInfo,
                    "customPrompt": msg.customPrompt,
                    "previous_best_answer": best_answer,
                    "incentive": user_behavior,
                    "model_answer": model_answer,
                    "reasoning": reasoning,
                    "feedback": feedback,
                    "improvements": improvements
                })

                draft = draft_resp.content.strip()
                best_answer = draft
                await set_update(f"{draft[:300]}")

            except asyncio.CancelledError:
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"process_chain error: {e}")
                continue

            if str(gemini.gemini_llm.model) != "models/gemini-2.0-flash":
                if not gemini.quick_think:
                    try:
                        reason_resp = await invoke_with_retry(reasoning_chain, {
                            "user_query": msg.message,
                            "memory": recent_messages + history,
                            "user_sentiment": user_behavior
                        })
                        response = await process_reasoning_response(reason_resp, msg, mem)
                        if response.get("flag"):
                            return {"result": response["result"], "chatId": msg.chatId}
                        model_answer, reasoning = response["result"], response["reasoning"]
                    except Exception as e:
                        gemini.logger.error(f"Reasoning failed: {e}")
            
            try:
                refine_resp = await invoke_with_retry(get_refinement_chain(), {
                    "draft": draft,
                    "outputFormat": msg.outputFormat,
                    "personalInfo": msg.personalInfo,
                    "customPrompt": msg.customPrompt,
                    "resources": resources,
                    "history": history,
                    "incentive": user_behavior,
                    **msg.dict(exclude={"chatId"})
                })

                refined = refine_resp.content.strip()
                await set_update(f"Refined response: {refined[:300]}")

            except asyncio.CancelledError:
                raise HTTPException(status_code=499, detail="Processing cancelled by user.")
            except Exception as e:
                gemini.logger.error(f"refinement_chain error: {e}")
                refined = draft

            action = "accept"

            try:
                if str(gemini.gemini_llm.model) != "models/gemini-2.0-flash":

                    val_resp = await invoke_with_retry(validation_chain, {
                        "response": refined,
                        "query": msg.message,
                        **msg.dict(exclude={"chatId"})
                    })

                    val_text = val_resp.content.strip()
                    val_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", val_text)
                    val_text = val_text.translate({ord(c): None for c in map(chr, range(0x00, 0x20))}).strip()
                    val_json = json.loads(val_text) if val_text.startswith("{") else {}
                    val_score = int(val_json.get("score", 5))
                    improvements = val_json.get("improvements")
                    feedback = val_json.get("feedback")

                    action = gemini.rl_agent.select_action()
                    reward = gemini.rl_agent._compute_reward(
                        gemini.rl_agent,
                        gemini.actions.index(action),
                        refined,
                        msg.message,
                        val_score
                    )
                    avg_score = (reward + val_score * 2) / 3

                    gemini.logger.info(f"Iteration {i + 1}: Action={action}, Val={val_score}, Reward={reward:.2f}, Avg={avg_score:.2f}")

                    if avg_score > best_avg_score:
                        best_avg_score = avg_score
                        best_answer = refined
                    
                    await set_update(str(val_score))

                else:

                    val_score, improvements, feedback = 10, None, None

            except Exception as e:

                gemini.logger.error(f"Validation error: {e}")
                val_score = 5

            if val_score > high_score:
                high_score = val_score
                retry_count = 0
            else:
                retry_count += 1

            if val_score == 10 or retry_count >= 2:
                mem.save_context({"input": msg.message}, {"output": refined})
                process = False
                return {"result": refined, "chatId": msg.chatId}

            if action == "accept" and val_score >= 9:
                mem.save_context({"input": msg.message}, {"output": refined})
                process = False
                return {"result": refined, "chatId": msg.chatId}

            if len(recent_messages) < 6:
                recent_messages = decay_memory(mem, 10)

        mem.save_context({"input": msg.message}, {"output": best_answer})
        process = False
        return {"result": best_answer, "chatId": msg.chatId}

    except asyncio.CancelledError:
        gemini.logger.warning("Cancelled globally.")
        raise HTTPException(status_code=499, detail="Processing cancelled by user.")
    except Exception as e:
        gemini.logger.error(f"Unhandled error: {e}")
        process = False
        raise HTTPException(status_code=getattr(e, 'status_code', 500), detail=str(e))

async def process_reasoning_response(reason, msg, mem):
    model_answer, reasoning, raw = None, None, None
    try:
        raw = reason.content.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE)
        raw = raw.translate({ord(c): None for c in map(chr, range(0x00, 0x20))}).strip()
        reason_json = json.loads(raw)

        if reason_json.get("flag") == "True":
            mem.save_context({"input": msg.message}, {"output": reason_json["reasoning"]})
            return {"result": reason_json["reasoning"], "chatId": msg.chatId, "flag": True}

        model_answer = await chat_with_model(
            model=reason_json.get("selected_model"),
            message=reason_json.get("generated_prompt"),
            user_input=msg.message
        )
        reasoning = reason_json.get("reasoning")
        await set_update(reasoning)

    except (json.JSONDecodeError, AttributeError, TypeError):
        model_answer = await chat_with_model(
            message=raw,
            user_input=msg.message,
            model="meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"
        )
    
    except asyncio.CancelledError:
        raise HTTPException(status_code=499, detail="Processing cancelled by user.")

    return {
        "result": model_answer,
        "reasoning": reasoning,
        "chatId": msg.chatId,
        "flag": False
    }