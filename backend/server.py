# Developed by Stefan Ralph Kumarasinghe

from utils.faiss import build_index
from rich.console import Console
from ai.process import process_message
from utils.updates import event_generator, reset_chat_updates, mark_chat_as_new
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form, Body, Query
from typing import List, Optional
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi import UploadFile, File, Form, HTTPException
from ai.task import TaskManager
from Model.ApiKeyData import ApiKeyData
from Model.ApiKeyRequest import ApiKeyRequest
from Model.ReposNames import RepoNamesBody
from pathlib import Path
from Model.SessionPayload import SessionPayload
from Model.CodePayload import CodePayload
from Model.MemoryPayload import MemoryRequest
from Model.DeleteResponse import DeletionResponse
from Model.ExistingDocument import ExistingDocument
from Model.SaveFileRequest import SaveFileRequest
import asyncio
import config.tars as gemini
from utils.background import periodic_assessment_task, run_memory_task
from utils.shell import run_python_code, init_python_session, close_python_session
from utils.node import (
    run_node_tests,
    test_javascript_code,
    run_node_app_with_streaming,
    get_process_output,
    terminate_process,
)
import os
import langchain
from ai.memory import ChatMemoryManager
from utils.documentation import add_documentation, get_documentation, delete_document, get_document_content
from sse_starlette.sse import EventSourceResponse
from contextlib import asynccontextmanager
from utils.env_change import get_api_key, save_api_key
from utils.context import CODESPACE_DIR, upload_project, clear_project, get_project_status, index_status, reindex_project, clone_personal_github_repo, get_project_files_and_folders, get_content_of_file, upload_folder
from utils.github import delete_all_cloned_repos, list_cloned_repos, delete_cloned_repo, reindex_all_github_projects, get_github_project_structure, get_github_project_file_content
from pydantic import BaseModel
import time
from Model.InitBashSessionRequest import InitBashSessionRequest
from Model.BashCommandRequest import BashCommandRequest
from Model.CloseBashSessionRequest import CloseBashSessionRequest
from utils.bash_session import run_bash_command, close_bash_session, init_bash_session
from utils.recommendation import get_recommendation


RESOURCES_DIR = Path("resources")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
langchain.llm_cache = gemini.langchain.llm_cache
task_manager = TaskManager()

memory_manager = ChatMemoryManager(gemini)
CODESPACE_DIR.mkdir(exist_ok=True)

class JavaScriptTestRequest(BaseModel):
    code: str
    test_code: Optional[str] = None
    framework: Optional[str] = "jest"

class NodeAppRequest(BaseModel):
    directory: Optional[str] = None
    run_command: str = "start"

class ProcessTerminateRequest(BaseModel):
    process_id: str

class RecommendationRequest(BaseModel):
    query: str
    history: Optional[List[str]] = []
    recent_messages: Optional[List[str]] = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await build_index()
        task1 = asyncio.create_task(periodic_assessment_task())
        task2 = asyncio.create_task(run_memory_task())
        yield 
        task1.cancel()
        task2.cancel()
        await asyncio.gather(task1, task2, return_exceptions=True)
    except Exception as e:
        gemini.logger.error(f"Error during startup: {e}")
        raise RuntimeError("Failed to initialize application during startup.")
    finally:
        pass

app = FastAPI(title="Developed by Stefan Ralph Kumarasinghe", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    gemini.logger.warning(f"Rate limit exceeded for {request.client.host}")
    return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)

@app.get("/chat/stream")
async def stream_endpoint(chat_id: str = Query(..., description="Chat ID for the streaming session")):
    try:
        return EventSourceResponse(event_generator(chat_id=chat_id))
    except Exception as e:
        gemini.logger.error(f"Error in stream_endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to stream events.")

@app.post("/chat/reset_updates")
@limiter.limit("30/minute")
async def reset_chat_updates_endpoint(request: Request, chat_id: str = Query(..., description="Chat ID to reset updates for")):
    try:
        reset_chat_updates(chat_id)
        return {"message": f"Updates reset for chat {chat_id}"}
    except Exception as e:
        gemini.logger.error(f"Error in reset_chat_updates: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset chat updates.")

@app.post("/process")
@limiter.limit("30/minute")
async def handle_chat(request: Request):
    try:
        async def task_wrapper():
            try:
                return await process_message(request)
            finally:
                task_manager.unregister("current_task")
        task = asyncio.create_task(task_wrapper())
        task_manager.register("current_task", task)
        return await task
    except asyncio.CancelledError:
        gemini.logger.warning("Request was cancelled.")
        return JSONResponse({"detail": "Request cancelled"}, status_code=499)
    
@app.post("/add_resource/")
@limiter.limit("3/minute")
async def add_resource(request: Request):
    try:
        reward = 5.0
        gemini.rl_agent.update_q_value(gemini.actions.index("accept"), reward)
        return {"message": "Resource rewarded successfully."}
    except Exception as e:
        gemini.rl_agent.update_q_value(gemini.actions.index("reject"), -1.0)
        gemini.logger.error(f"Error in add_resource: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/flag_bad_input/")
@limiter.limit("10/minute")
async def flag_bad_input_endpoint(request: Request):
    try:
        punishment = -5.0
        gemini.rl_agent.update_q_value(gemini.actions.index("reject"), punishment)
        return {"message": "Input flagged successfully."}
    except Exception as e:
        gemini.logger.error(f"Error in flag_bad_input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/memory/clear")
@limiter.limit("10/minute")
async def clear_memory(request: Request, chat_id: Optional[str] = None):
    try:
        if chat_id:
            memory_manager.reset_chat_memory(chat_id)
            # Mark the chat as new and trigger initial update
            mark_chat_as_new(chat_id)
            return {"message": f"Cleared memory and reset updates for chat {chat_id}"}
        else:
            memory_manager.reset_chat_memory()
            # Clear all chat update states when clearing all memories
            from utils.updates import chat_update_manager
            chat_update_manager.clear_all_chat_states()
            return {"message": "Cleared all chat memories and updates"}
    except Exception as e:
        gemini.logger.error(f"Error in clear_memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear chat memories.")

@app.get("/memory/active-chats")
@limiter.limit("10/minute")
async def get_active_chats(request: Request):
    try:
        active_chats = memory_manager.get_active_chats()
        chat_metadata = {
            chat_id: memory_manager.get_chat_metadata(chat_id)
            for chat_id in active_chats
        }
        return {
            "active_chats": active_chats,
            "metadata": chat_metadata
        }
    except Exception as e:
        gemini.logger.error(f"Error in get_active_chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get active chats.")

@app.post("/give_memory/")
@limiter.limit("10/minute")
async def give_memory_endpoint(request: Request, payload: MemoryRequest):
   try:
       if not payload.chatId:
           raise HTTPException(status_code=400, detail="Chat ID is required")
           
       await memory_manager.give_memory(payload)
       return {"message": f"Memory updated successfully for chat {payload.chatId}"}
   except Exception as e:
       gemini.logger.error(f"Error in give_memory for chat {payload.chatId if hasattr(payload, 'chatId') else 'N/A'}: {e}")
       raise HTTPException(status_code=500, detail="Failed to update memory.")
    
@app.post("/reindex/")
@limiter.limit("10/minute")
async def reindex(request: Request):
    try:
        await build_index()
        await reindex_all_github_projects()
        return {"message": "Resources reindexed successfully."}
    except Exception as e:
        gemini.logger.error(f"Error in reindex: {e}")
        raise HTTPException(status_code=500, detail="Failed to reindex resources.")

@app.get("/")
@limiter.limit("10/minute")
async def root(request: Request):
    try:
        return {"message": "Ultra Optimized RAG Service is running!"}
    except Exception as e:
        gemini.logger.error(f"Error in root endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to load root endpoint.")


@app.post("/run_python_code")
@limiter.limit("10/minute")
async def run_code(request: Request, payload: CodePayload):
    try:
        return await run_python_code(payload)
    except Exception as e:
        gemini.logger.error(f"Error in run_code: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute Python code.")

@app.post("/init_python_session")
@limiter.limit("10/minute")
async def init_session(request: Request):
    try:
        return await init_python_session(request)
    except Exception as e:
        gemini.logger.error(f"Error in init_session: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize Python session.")

@app.post("/close_python_session")
@limiter.limit("10/minute")
async def close_session(request: Request, payload: SessionPayload):
    try:
        return await close_python_session(payload)
    except Exception as e:
        gemini.logger.error(f"Error in close_session: {e}")
        raise HTTPException(status_code=500, detail="Failed to close Python session.")
    
@app.post("/cancel_message")
@limiter.limit("10/minute")
async def cancel_all_tasks(request: Request):
    try:
        cancelled = []
        for chat_id in list(task_manager.tasks.keys()):
            if task_manager.cancel(chat_id):
                cancelled.append(chat_id)
        if cancelled:
            return {"result": f"Cancelled tasks for chatIds: {', '.join(cancelled)}"}
        return {"result": "No running tasks found to cancel."}
    except Exception as e:
        gemini.logger.error(f"Error in cancel_all_tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel tasks.")

@app.post("/erase_long_term_memory")
@limiter.limit("10/minute")
async def erase_long_term_memory_endpoint(request: Request):
    try:
        await memory_manager.erase_long_term_memory()
        return {"message": "Long-term memory erased successfully."}
    except Exception as e:
        gemini.logger.error(f"Error in erase_long_term_memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to erase long-term memory.")
    
@app.post("/add_documentation")
@limiter.limit("10/minute")
async def add_documentation_endpoint(request: Request, files: Optional[List[UploadFile]] = File(None),documentation_text: Optional[str] = Form(None),documentation_links: Optional[str] = Form(None),description: Optional[str] = Form(None), eraseLongTermMemory: bool = Form(False)):
    try:
        return await add_documentation(
            files=files,
            documentation_text=documentation_text,
            documentation_links=documentation_links,
            description=description,
            eraseLongTermMemory=eraseLongTermMemory,
        )
    except Exception as e:
        gemini.logger.error(f"Error in add_documentation: {e}")
        raise HTTPException(status_code=500, detail="Failed to add documentation.")

@app.get("/get_documentation", response_model=List[ExistingDocument])
@limiter.limit("10/minute")
async def get_documentation_endpoint(request: Request):
    try:
        return await get_documentation()
    except Exception as e:
        gemini.logger.error(f"Error in get_documentation: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve documentation.")

@app.get("/get_document_content/{document_id}")
@limiter.limit("20/minute")
async def get_document_content_endpoint(request: Request, document_id: str):
    try:
        return await get_document_content(document_id)
    except Exception as e:
        gemini.logger.error(f"Error in get_document_content: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document content.")

@app.delete("/remove_documentation", response_model=DeletionResponse)
@limiter.limit("10/minute")
async def delete_documents_endpoint(
    request: Request,
    ids: List[str] = Body(..., embed=True) 
):
    try:
        for document_id in ids:
            await delete_document(document_id)
        return DeletionResponse(message="Documents deleted successfully.", deleted_ids=ids)
    except Exception as e:
        gemini.logger.error(f"Error in delete_document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete documents: {str(e)}")
    
@app.post("/get_api_keys")
@limiter.limit("10/minute")
async def get_api_keys(request: Request, data: ApiKeyRequest):
    try:
       return await get_api_key(data)
    except Exception as e:
        gemini.logger.error(f"Error in get_api_keys: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve API key.")

@app.post("/save_api_keys")
@limiter.limit("10/minute")
async def save_api_keys(request: Request, data: ApiKeyData):
    try:
        return await save_api_key(data)
    except Exception as e:
        gemini.logger.error(f"Error in save_api_keys: {e}")
        raise HTTPException(status_code=500, detail="Failed to save API key.")
    
@app.post("/upload_project/")
@limiter.limit("5/minute")
async def upload_project_endpoint(request: Request, file: UploadFile = File(...)):
    try:
        return await upload_project(request, file)
    except Exception as e:
        gemini.logger.error(f"Error in upload_project: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload project.")
   
@app.post("/upload_folder/")
@limiter.limit("5/minute")
async def upload_folder_endpoint(
    request: Request, 
    files: List[UploadFile] = File(...), 
    folder_structure: str = Form(...)
):
    try:
        return await upload_folder(request, files, folder_structure)
    except Exception as e:
        gemini.logger.error(f"Error in upload_folder: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload folder.")
   
@app.delete("/clear_project/")
@limiter.limit("5/minute")
async def clear_project_endpoint(request: Request):
    try:
        return await clear_project(request)
    except Exception as e:
        gemini.logger.error(f"Error in clear_project: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear project.")

@app.get("/project_status/")
@limiter.limit("60/minute")
async def get_project_status_endpoint(request: Request):
    try:
        return await get_project_status(request)
    except Exception as e:
        gemini.logger.error(f"Error in get_project_status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project status.")
    
@app.get("/index_status/")
@limiter.limit("10/minute")
async def index_status_endpoint(request: Request):
    try:
        return await index_status()
    except Exception as e:
        gemini.logger.error(f"Error in index_status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get index status.")

@app.post("/reindex_project/")
@limiter.limit("10/minute")
async def reindex_project_endpoint(request: Request):
    try:
        return await reindex_project()
    except Exception as e:
        gemini.logger.error(f"Error in reindex_project: {e}")
        raise HTTPException(status_code=500, detail="Failed to reindex project.")
    
@app.get("/get_github_projects")
@limiter.limit("10/minute")
async def list_cloned_repos_endpoint(request: Request):
    try:
        return await list_cloned_repos()
    except Exception as e:
        gemini.logger.error(f"Error in list_cloned_repos: {e}")
        raise HTTPException(status_code=500, detail="Failed to list cloned repos.")
    
@app.delete("/remove_github_project")
@limiter.limit("10/minute")
async def delete_cloned_repos_endpoint(request: Request, repo_names_body: RepoNamesBody):
    results = []
    for repo_name in repo_names_body.ids:
        try:
            success = await delete_cloned_repo(repo_name)
            results.append({"repo_name": repo_name, "success": success, "message": "Operation attempted"})
        except Exception as e:
            gemini.logger.error(f"Error deleting repo '{repo_name}': {e}")
            results.append({"repo_name": repo_name, "success": False, "message": f"Error: {e}"})
    
    return results

@app.post("/clone_personal_github_repo")
@limiter.limit("10/minute")
async def clone_personal_github_repo_endpoint(request: Request, repo_full_name: str, use_token: bool = True):
    try:
        result = await clone_personal_github_repo(repo_full_name, use_token=use_token)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to clone repository")
        
        if not result.get("success", False):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to clone repository"))
            
        return result
    except Exception as e:
        gemini.logger.error(f"Error in clone_personal_github_repo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/erase_all_github_projects")
@limiter.limit("10/minute")
async def delete_all_cloned_repos_endpoint(request: Request):
    try:
        return await delete_all_cloned_repos()
    except Exception as e:
        gemini.logger.error(f"Error in delete_all_cloned_repos: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete all cloned repos.")
    
@app.post("/reindex_github_projects")
@limiter.limit("10/minute")
async def reindex_github_projects_endpoint(request: Request):
    try:
        return await reindex_all_github_projects()
    except Exception as e:
        gemini.logger.error(f"Error in reindex_github_projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to reindex github projects.")
    
@app.get("/get_github_project_structure/{project_id}")
@limiter.limit("20/minute")
async def get_github_project_structure_endpoint(request: Request, project_id: str):
    try:
        return await get_github_project_structure(project_id)
    except Exception as e:
        gemini.logger.error(f"Error in get_github_project_structure: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project structure: {str(e)}")

@app.get("/get_github_project_file/{project_id}")
@limiter.limit("30/minute")
async def get_github_project_file_endpoint(request: Request, project_id: str, file_path: str):
    try:
        return await get_github_project_file_content(project_id, file_path)
    except Exception as e:
        gemini.logger.error(f"Error in get_github_project_file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get file content: {str(e)}")
    
@app.get("/project_files/")
@limiter.limit("20/minute")
async def get_project_files_endpoint(request: Request, path: Optional[str] = None, recursive: bool = True):
    try:
        gemini.logger.info(f"Getting project files. Path: {path}, Recursive: {recursive}")
        items = get_project_files_and_folders(path=path, recursive=recursive)
        
        if not items:
            return []
            
        return items
    except Exception as e:
        gemini.logger.error(f"Error getting project files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project files: {str(e)}")

@app.get("/file_content/")
@limiter.limit("30/minute")
async def get_file_content_endpoint(request: Request, file_path: str):
    try:
        gemini.logger.info(f"Getting content for file: {file_path}")
        content = get_content_of_file(file_path)
        
        if isinstance(content, dict) and not content.get("success", True):
            gemini.logger.warning(f"Error getting file content: {content.get('error')}")
            raise HTTPException(status_code=404, detail=content.get("error", "File not found"))
            
        return {"content": content, "file_path": file_path}
    except HTTPException:
        raise
    except Exception as e:
        gemini.logger.error(f"Error getting file content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get file content: {str(e)}")

@app.post("/save_file_content/")
@limiter.limit("30/minute")
async def save_file_content(request: Request, data: SaveFileRequest):
    try:
        gemini.logger.info(f"Saving content to file: {data.file_path}")
        
        if not data.file_path or not data.content:
            raise HTTPException(status_code=400, detail="File path and content are required")
            
        file_path = data.file_path
        if not file_path.startswith('/'):
            file_path = str(CODESPACE_DIR / file_path)
        else:
            if not Path(file_path).is_relative_to(CODESPACE_DIR):
                file_path = str(CODESPACE_DIR / file_path.lstrip('/'))
                
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(data.content)
            
        gemini.logger.info(f"Successfully saved content to file: {file_path}")
        return {"success": True, "message": f"Content saved to {data.file_path}"}
    except Exception as e:
        gemini.logger.error(f"Error saving file content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file content: {str(e)}")

@app.post("/run_node_tests")
@limiter.limit("10/minute")
async def run_node_tests_endpoint(request: Request, directory: str = None, test_command: str = "test"):
    try:
        return await run_node_tests(directory, test_command)
    except Exception as e:
        gemini.logger.error(f"Error in run_node_tests: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run Node.js tests: {str(e)}")

@app.post("/test_javascript_code")
@limiter.limit("10/minute")
async def test_javascript_code_endpoint(request: Request, test_request: JavaScriptTestRequest):
    try:
        return await test_javascript_code(
            test_request.code,
            test_request.test_code,
            test_request.framework
        )
    except Exception as e:
        gemini.logger.error(f"Error in test_javascript_code: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test JavaScript code: {str(e)}")

@app.post("/run_node_app")
@limiter.limit("10/minute")
async def run_node_app_endpoint(request: Request, app_request: NodeAppRequest):
    try:
        process_id = f"node-app-{int(time.time())}"
        
        return await run_node_app_with_streaming(
            process_id,
            app_request.directory,
            app_request.run_command
        )
    except Exception as e:
        gemini.logger.error(f"Error in run_node_app: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run Node.js application: {str(e)}")

@app.get("/node_app_output/{process_id}")
async def stream_node_app_output(request: Request, process_id: str):
    try:
        return EventSourceResponse(get_process_output(process_id))
    except Exception as e:
        gemini.logger.error(f"Error in stream_node_app_output: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to stream output: {str(e)}")

@app.post("/terminate_node_app/{process_id}")
@limiter.limit("10/minute")
async def terminate_node_app_endpoint(request: Request, process_id: str):
    try:
        result = terminate_process(process_id)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        gemini.logger.error(f"Error in terminate_node_app: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to terminate process: {str(e)}")

@app.post("/init_bash_session")
@limiter.limit("10/minute")
async def init_bash_session_endpoint(request: Request, bash_request: InitBashSessionRequest):
    try:
        return await init_bash_session(request, bash_request)
    except Exception as e:
        gemini.logger.error(f"Error in init_bash_session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize bash session: {str(e)}")

@app.post("/run_bash_command")
@limiter.limit("30/minute")
async def run_bash_command_endpoint(request: Request, bash_request: BashCommandRequest):
    try:
        return await run_bash_command(request, bash_request)
    except Exception as e:
        gemini.logger.error(f"Error in run_bash_command: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run bash command: {str(e)}")
       
@app.post("/close_bash_session")
@limiter.limit("10/minute")
async def close_bash_session_endpoint(request: Request, bash_request: CloseBashSessionRequest):
    try:
        return await close_bash_session(request, bash_request)
    except Exception as e:
        gemini.logger.error(f"Error in close_bash_session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to close bash session: {str(e)}")

@app.post("/get_recommendation")
@limiter.limit("30/minute")
async def get_recommendation_endpoint(request: Request, data: RecommendationRequest):
    try:
        suggestions = await get_recommendation(data.query, data.history, data.recent_messages)
        return {"suggestions": suggestions}
    except Exception as e:
        gemini.logger.error(f"Error in get_recommendation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    console = Console(force_terminal=True, color_system="truecolor")
    print("\n")
    console.print("[bold green]✅ Use [underline blue]https://dwr4zchmi6x24.cloudfront.net[/] to access the UI interface[/]")
    console.print("[yellow]⚠️  This project is actively being improved. Pull the latest image for updates.[/]")
    console.print("[magenta]💡 CodeMasterPro was designed and developed by Stefan Kumarasinghe.[/]")
    console.print("[cyan]🔗 License: [underline]https://github.com/StefanKumarasinghe/CodeMasterPro/blob/main/LICENSE[/]")
    print("\n")
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
