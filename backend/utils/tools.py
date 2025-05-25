import re
from utils.code_analysis import code_analysis
from ai.model_switcher import (
    tool_chain,
    quick_answer_chain,
    analyse_bandit_chain,
    analyse_changes_python_chain,
    analyse_compute_chain,
    code_chain,
    reference_github_check_chain,
    github_reword_chain,
    choose_file_name_chain,
    analyse_node_chain,
    analyse_bash_chain,
    reference_check_chain
)
from utils.context import query_index, read_file_content
from utils.updates import set_update
from utils.shell import (
    init_python_session,
    run_python_code,
)
from utils.faiss import (
    search_resources_local,
    search_resources_web
)
from utils.stackoverflow import search_stackoverflow_and_rank
from Model.CodePayload import CodePayload
from utils.bandit import generate_bandit_code
from utils.invoke_retry import invoke_with_retry
from utils.github import query_repo, pipeline, read_file_content_from_github_directory
from utils.reddit_api import search_reddit_and_rank
import config.tars as gemini
from utils.node import run_with_self_correction_loop
from utils.analyse_pinned import calculate_file_relevance, format_context_for_llm, summarize_file_content
from utils.bash_runner import self_correction_loop_bash
import asyncio

def clean_result(result):
    try:
        return result.content.strip()
    except AttributeError:
        return str(result).strip()

async def resolve_tool_selector(gemini, message_query, history, last_message):
    try:
        tool_selector = await invoke_with_retry(tool_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
            "query": message_query,
            "history": history,
            "past_messages": last_message,
        })
        return clean_result(tool_selector)
    except Exception as e:
        gemini.logger.error(f"Error resolving tool selector: {e}")
        return None

async def run_code_with_analysis(msg, code, analysis_chain, mem, gemini, client_ip=None):
    session = None
    try:
        session = await init_python_session(client_ip=client_ip)
        result = await run_python_code(CodePayload(session_id=session["session_id"], code=code.strip()))
        result = await invoke_with_retry(analysis_chain, {"result": result, "query": msg.message})
        cleaned = clean_result(result)
        mem.save_context({"input": msg.message}, {"output": cleaned})
        return {"result": cleaned, "chatId": msg.chatId, "continue": False, "tooling": "python"}
    except Exception as e:
        gemini.logger.error(f"Python execution error: {e}")
        return {"result": "We couldn't validate your code", "chatId": msg.chatId}


async def handle_tool_selector(mcp, msg, history, last_message, recent_messages, request, mem):
    if mcp != "auto":
        tool_selector = mcp
    else:
        tool_selector = await resolve_tool_selector(gemini, msg.message, history, last_message)
    
    mem.save_context({"input": "What tool was used to answer the question?"}, {"output": tool_selector})
    handlers = {
        "quick": handle_quick_answer,
        "sast": handle_bandit_analysis,
        "python": handle_python_execution,
        "visualization": handle_visualization,
        "computer": handle_computation,
        "code_analysis": handle_deep_code_analysis,
        "github": github_search,
        "web": handle_web_answer,
        "internal": handle_internal_answer,
        "stack": handle_stack_answer,
        "context": handle_context_answer,
        "reddit": handle_reddit_answer,
        "node": handle_node_answer,
        "bash": handle_bash_answer,  
    }


    handler = handlers.get(tool_selector)
    if handler:
        if 'request' in handler.__code__.co_varnames:
            return await handler(msg, recent_messages, request, mem, gemini)
        else:
            return await handler(msg, mem)
    return {"result": None, "chatId": msg.chatId, "continue": True, "tooling": None, "image_url": None}


async def handle_bash_answer(msg, recent_messages, request, mem, gemini):
    set_update("We are running a Bash command to validate your code.")
    command = msg.message.strip()
    
    if not command:
        return {"result": "No command provided.", "chatId": msg.chatId, "continue": False, "tooling": "bash"}

    try:
        result = await self_correction_loop_bash(command, recent_messages)
        cleaned = clean_result(result)
        analyse_result = await invoke_with_retry(analyse_bash_chain(model_type="super-lite", provider_type=gemini.providerName), {
            "result": result,
            "query": msg.message
        })
        analyse_result = analyse_result.content.strip()
        mem.save_context({"input": command}, {"output": cleaned})
        return {"result": analyse_result, "chatId": msg.chatId, "continue": False, "tooling": "bash"}
    except Exception as e:
        gemini.logger.error(f"Bash execution error: {e}")
        return {"result": f"We couldn't validate your command: {str(e)}", "chatId": msg.chatId, "continue": False, "tooling": "bash"}
    
async def handle_node_answer(msg, recent_messages, request, mem, gemini):
    set_update("We are searching Node for the best answer to your question.")
    result = await run_with_self_correction_loop(msg.message, recent_messages)
    analyse_result = await invoke_with_retry(analyse_node_chain(model_type="super-lite", provider_type=gemini.providerName), {
        "result": result,
        "query": msg.message
    })
    analyse_result = analyse_result.content.strip()

    if result:
        return {
            "result": analyse_result,
            "chatId": msg.chatId,
            "continue": False,
            "tooling": "node"
        }
    
    return {
        "result": "We couldn't find any relevant Node resources for your question.",
        "chatId": msg.chatId,
        "continue": True,
        "tooling": "node"
    }

async def handle_reddit_answer(msg, recent_messages, request, mem, gemini):
    set_update("We are searching Reddit for the best answer to your question.")
    result = await search_reddit_and_rank(msg.message + "PAST MESSAGE : " + " ".join(str(message) for message in recent_messages))
    if result.get("reddit_resource"):
        result = result.get("reddit_resource")
    else:
        result = {
            "result": "We couldn't find any relevant Reddit resources for your question.",
            "chatId": msg.chatId,
            "continue": True,
            "tooling": "reddit"
        }
    return {
        "result": result,
        "chatId": msg.chatId,
        "continue": True,
        "tooling": "reddit"
    }

async def handle_context_answer(msg, recent_messages, request, mem, gemini):
    try:
        set_update("We are analyzing your question and retrieving relevant information from project files.")
        recent_messages_str = [str(message) for message in recent_messages]
            
        pinned_files = None
        max_chars_per_file = 20000
        max_total_chars = 80000
        
        try:
            if hasattr(msg, 'pinnedFiles') and msg.pinnedFiles:
                pinned_files = msg.pinnedFiles
                gemini.logger.info(f"Found {len(pinned_files)} pinned files in request")
                mem.save_context({"input": "PINNED FILES DETECTED"}, {"output": str(pinned_files)})
            else:
                gemini.logger.info("No pinned files found in request")
        except Exception as e:
            gemini.logger.error(f"Error processing pinned files: {e}")
            pinned_files = None

        query_with_context = msg.message
        if pinned_files:
            for file_info in pinned_files:
                if "path" in file_info:
                    query_with_context += f" pinnedFile:{file_info['path']}"
        
        search_results = await query_index(query_with_context)
        mem.save_context({"input": "INITIAL CONTEXT RESULTS"}, {"output": str(search_results)})

        context_data = {
            "query": msg.message,
            "search_results": search_results,
            "file_contexts": []
        }
        
        if not pinned_files:
            try:
                choose_file_name = await invoke_with_retry(choose_file_name_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
                    "result": search_results,
                    "query": msg.message,
                    "recent_messages": recent_messages_str,
                })
                choose_file_name = choose_file_name.content.strip()

                if choose_file_name == "none":
                    return {
                        "result": format_context_for_llm(context_data),
                        "chatId": msg.chatId,
                        "continue": True,
                        "tooling": "context"
                    }

                try:
                    content = await read_file_content(choose_file_name)
                    if isinstance(content, dict) and not content.get("success", True):
                        gemini.logger.warning(f"Failed to read automatically selected file: {choose_file_name}")
                        context_data["file_error"] = f"Failed to read the selected file: {choose_file_name}. {content.get('error', 'Unknown error.')}"
                    else:
                        content_str = str(content.get("content", content)) if isinstance(content, dict) else str(content)
                        file_summary = await summarize_file_content(choose_file_name, content_str, msg.message, gemini)
                        
                        context_data["file_contexts"].append({
                            "filename": choose_file_name,
                            "content": content_str[:max_chars_per_file] if len(content_str) > max_chars_per_file else content_str,
                            "summary": file_summary,
                            "truncated": len(content_str) > max_chars_per_file
                        })
                        
                        mem.save_context({"input": f"FILE ANALYZED: {choose_file_name}"}, {"output": file_summary})
                except Exception as e:
                    gemini.logger.error(f"Error reading auto-selected file {choose_file_name}: {e}")
                    context_data["file_error"] = f"Could not read the most relevant file due to an error: {str(e)}"
            except Exception as e:
                gemini.logger.error(f"Error in file selection process: {e}")
        else:
            processed_files_set = set()
            total_chars = 0
            skipped_files = []
            
            file_relevance = []
            
            for file_info in pinned_files:
                filename = file_info.get("path")
                if not filename or filename in processed_files_set:
                    continue
                    
                processed_files_set.add(filename)
                
                try:
                    content = await read_file_content(filename)
                    
                    if isinstance(content, dict) and not content.get("success", True):
                        gemini.logger.warning(f"Failed to read pinned file: {filename}")
                        skipped_files.append(file_info.get("name", filename))
                        continue
                    
                    content_str = str(content.get("content", content)) if isinstance(content, dict) else str(content)
                    
                    relevance_score = await calculate_file_relevance(filename, content_str, msg.message, gemini)
                    
                    file_relevance.append({
                        "filename": filename,
                        "content": content_str,
                        "relevance": relevance_score,
                        "size": len(content_str)
                    })
                    
                except Exception as e:
                    gemini.logger.error(f"Error analyzing pinned file {filename}: {e}")
                    skipped_files.append(file_info.get("name", filename))
            
            file_relevance.sort(key=lambda x: x["relevance"], reverse=True)
            
            for file_data in file_relevance:
                filename = file_data["filename"]
                content_str = file_data["content"]
                char_count = file_data["size"]
                
                if char_count > max_chars_per_file:
                    truncated_content = content_str[:max_chars_per_file]
                    truncated = True
                    char_count = max_chars_per_file
                else:
                    truncated_content = content_str
                    truncated = False
                
                if total_chars + char_count > max_total_chars:
                    skipped_files.append(filename)
                    gemini.logger.info(f"Skipping file {filename} due to total character limit")
                    continue
                
                total_chars += char_count
                
                file_summary = await summarize_file_content(filename, content_str, msg.message, gemini)
                
                context_data["file_contexts"].append({
                    "filename": filename,
                    "content": truncated_content,
                    "summary": file_summary,
                    "relevance_score": file_data["relevance"],
                    "truncated": truncated
                })
                
                mem.save_context(
                    {"input": f"FILE ANALYZED: {filename}"},
                    {"output": file_summary}
                )
            
            if skipped_files:
                context_data["skipped_files"] = skipped_files
            
            gemini.logger.info(f"Processed {len(context_data['file_contexts'])} pinned files with total {total_chars} characters")
        
        formatted_context = format_context_for_llm(context_data)
        
        return {
            "result": formatted_context,
            "chatId": msg.chatId,
                "continue": True,
                "tooling": "context"
            }
    
    except Exception as e:
        gemini.logger.error(f"Error in context answer: {e}")
        return {
            "result": "We couldn't get any context from your project files, please reindex or reupload your files",
            "chatId": msg.chatId
        }

async def handle_web_answer(msg, recent_messages, request, mem, gemini):
    set_update("We are searching the web for the best answer to your question.")
    local_result = await search_resources_local(msg.message + "PAST MESSAGE : " + " ".join(str(message) for message in recent_messages))
    relevant_result = await invoke_with_retry(reference_check_chain(model_type=gemini.modelType, provider_type=gemini.providerName),{
        "result": local_result,
        "query": msg.message + "PAST MESSAGE : " + " ".join(str(message) for message in recent_messages),
    })

    if relevant_result.content.strip() == "correct":
        result = local_result
    else:
        result = await search_resources_web(msg.message + "PAST MESSAGE : " + " ".join(str(message) for message in recent_messages), msg)
        return {
            "result": result,
            "chatId": msg.chatId,
            "continue": True,
            "tooling": "web"
        }

    return {
        "result": result,
        "chatId": msg.chatId,
        "continue": True,
        "tooling": "web"
    }

async def handle_internal_answer(msg, recent_messages, request, mem, gemini):
    set_update("We are searching the internal resources for the best answer to your question.")
    result = await search_resources_local(msg.message + "PAST MESSAGE : " + " ".join(str(message) for message in recent_messages))
    return {
        "result": result,
        "chatId": msg.chatId,
        "continue": True,
        "tooling": "internal"
    }

async def handle_stack_answer(msg, recent_messages, request, mem, gemini):
    set_update("We are searching StackOverflow for the best answer to your question.")
    result = await search_stackoverflow_and_rank(msg.message)
    return {
        "result": result,
        "chatId": msg.chatId,
        "continue": True,
        "tooling": "stack"
    }


async def handle_deep_code_analysis(msg, mem):
    set_update("We are analyzing your code and using CodeAnalystPrompt to generate the best response.")
    result = await code_analysis(msg.message, msg, code_chain(model_type=gemini.modelType, provider_type=gemini.providerName))
    mem.save_context({"input": msg.message}, {"output": result})
    return {"result": result, "chatId": msg.chatId, "continue": False, "tooling": "code_analysis"}


async def handle_quick_answer(msg, recent_messages, request, mem, gemini):
    set_update("We are running a quick answer to validate your code.")
    result = await invoke_with_retry(quick_answer_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
        "query": msg.message,
        "recent_messages": recent_messages,
        "personalInfo": msg.personalInfo,
        "customPrompt": msg.customPrompt,
    })
    cleaned = clean_result(result)
    mem.save_context({"input": msg.message}, {"output": cleaned})
    return {"result": cleaned, "chatId": msg.chatId, "continue": False, "tooling": "quick"}


async def handle_bandit_analysis(msg, recent_messages, request, mem, gemini):
    set_update("We are running a Bandit code analysis to validate your Python code.")
    code = generate_bandit_code(f"{msg.message}PAST MESSAGE : {recent_messages}")
    return await run_code_with_analysis(msg, code, analyse_bandit_chain(model_type=gemini.modelType, provider_type=gemini.providerName), mem, gemini, request.client.host)


async def handle_python_execution(msg, recent_messages, request, mem, gemini):
    set_update("I am creating a Python session for you and running your code.")
    combined = f"{msg.message}PAST MESSAGE : {recent_messages}"
    match = re.search(r"```python(.*?)```", combined, re.DOTALL)
    code = match.group(1).strip() if match else msg.message.strip()
    return await run_code_with_analysis(msg, code, analyse_changes_python_chain(model_type=gemini.modelType, provider_type=gemini.providerName), mem, gemini, request.client.host)


async def handle_visualization(msg, recent_messages, request, mem, gemini):
    set_update("We are generating and running Python code to visualize the logs or input data.")
    code = (
        "# Visualize the logs or input data using best judgment.\n"
        "# Save the output image to a buffer and return it as a data URL: data:image/{gif or png};base64,<encoded_image>\n"
        "# Avoid launching GUI apps or external viewers.\n"
        "# Only return the image URL — no extra text, no Markdown tags.\n"
        "# Strictly return: data:image/png;base64,<encoded_image>\n\n"
        f"{msg.message}\n\n"
        f"PAST MESSAGE: {recent_messages}"
    )

    try:
        session = None
        session = await init_python_session(client_ip=request.client.host)
        result = await run_python_code(CodePayload(session_id=session["session_id"], code=code.strip()))
        result = result["stdout"] if isinstance(result, dict) else result

        return {
            "image_url": result,
            "result": "The image is generated for the logs provided.",
            "chatId": msg.chatId,
            "continue": False,
            "tooling": "visualization"
        }

    except Exception as e:
        gemini.logger.error(f"[ERROR] Visualization failed: {e}")
        return {
            "result": "Visualization failed.",
            "error": str(e),
            "chatId": msg.chatId,
            "continue": False,
            "tooling": "visualization"
        }


async def handle_computation(msg, recent_messages, request, mem, gemini):
    set_update("We are generating and running a Python code to compute a complex problem.")
    code = (
        "# Solve the problem using a Python algorithm and print the result.\n"
        f"{msg.message}"
    )
    return await run_code_with_analysis(msg, code, analyse_compute_chain(model_type=gemini.modelType, provider_type=gemini.providerName), mem, gemini, request.client.host)


async def github_search(msg, recent_messages, request, mem, gemini):
    set_update("We are searching for the best GitHub repository to solve your problem.")
    github_result = None
    recent_messages_str = [str(message) for message in recent_messages]
    
    github_result = await query_repo(msg.message)

    reference_check = await invoke_with_retry(reference_github_check_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
        "result": github_result,
        "query": msg.message,
        "mem": recent_messages_str
    })
    
    if reference_check.content.strip() == "incorrect":

        github_query = await invoke_with_retry(github_reword_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
            "query": msg.message,
            "past_messages": recent_messages
        })
        github_query = github_query.content.strip()
        await pipeline(github_query, mem)
        github_result = await query_repo(github_query)
    
    mem.save_context({"input": "GITHUB RESULTS"}, {"output": str(github_result)})

    recent_messages_str = [str(message) for message in recent_messages]

    choose_file_name = await invoke_with_retry(choose_file_name_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
        "result": github_result,
        "query": msg.message,
        "recent_messages": recent_messages_str,
    })
    choose_file_name = choose_file_name.content.strip()

    if choose_file_name == "none":
        return {
            "result": github_result,
            "chatId": msg.chatId,
            "continue": True,
            "tooling": "github"
        }

    file_content = await read_file_content_from_github_directory(choose_file_name)

    mem.save_context({"input": "THIS IS THE FILE ADDED AS CONTEXT"}, {"output": str(file_content)})
    
    final_result = (f"{github_result}\n\n"
                    f"Selected file for context: {choose_file_name}\n\n"
                    f"File content:\n```\n{file_content}\n```")

    return {
        "result": final_result,
        "chatId": msg.chatId,
        "continue": True,
        "tooling": "github"
    }

async def tool_results(msg, tool_calls, current_refined, recent_messages, mem, request):
    try:
        results = []
        if tool_calls:
            for tool_call in tool_calls:
                try:
                    if tool_call == "web":
                        result = await asyncio.wait_for(
                            handle_web_answer(msg, recent_messages, request, mem, gemini), timeout=30
                        )
                    elif tool_call == "internal":
                        result = await asyncio.wait_for(
                            handle_internal_answer(msg, recent_messages, request, mem, gemini), timeout=30
                        )
                    elif tool_call == "stack":
                        result = await asyncio.wait_for(
                            handle_stack_answer(msg, recent_messages, request, mem, gemini), timeout=30
                        )
                    elif tool_call == "python":
                        result = await asyncio.wait_for(
                            handle_python_execution(msg, current_refined, request, mem, gemini), timeout=30
                        )
                    elif tool_call == "computer":
                        result = await asyncio.wait_for(
                            handle_computation(msg, current_refined, request, mem, gemini), timeout=30
                        )
                    elif tool_call == "sast":
                        result = await asyncio.wait_for(
                            handle_bandit_analysis(msg, current_refined, request, mem, gemini), timeout=30
                        )
                    else:
                        result = None
                except asyncio.TimeoutError:
                    result = {
                        "result": f"Timeout: {tool_call} tool did not respond within 30 seconds.",
                        "chatId": getattr(msg, "chatId", None),
                        "continue": False,
                        "tooling": tool_call
                    }
                results.append(result)
            return {"results": results}
    except Exception as e:
        gemini.logger.error(f"Error in tool_results: {e}")
        return {"results": []}
