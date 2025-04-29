# Developed by Stefan Ralph Kumarasinghe
from utils.faiss import build_index
from ai.process import process_message
from utils.updates import event_generator
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form, Body
from typing import List, Optional
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi import UploadFile, File, Form, HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI
from ai.task import TaskManager
from pathlib import Path
from Model.SessionPayload import SessionPayload
from Model.TogglePayload import TogglePayload
from Model.ModelRequest import ModelRequest
from Model.CodePayload import CodePayload
from Model.MemoryPayload import MemoryRequest
from Model.DeleteResponse import DeletionResponse
from Model.ExistingDocument import ExistingDocument
import asyncio
import config.tars as gemini
from utils.shell import run_python_code, init_python_session, close_python_session
import os
import langchain
from ai.memory import reset_chat_memory, give_memory, erase_long_term_memory
from utils.documentation import add_documentation, get_documentation, delete_document
from sse_starlette.sse import EventSourceResponse
from contextlib import asynccontextmanager

RESOURCES_DIR = Path("resources")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
langchain.llm_cache = gemini.langchain.llm_cache
task_manager = TaskManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await build_index()
        yield
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
async def stream_endpoint():
    return EventSourceResponse(event_generator())

@app.post("/process/")
@limiter.limit("5/minute")
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
async def clear_memory(request: Request):
    try:
        reset_chat_memory("default")
        return {"message": "Cleared all chat memories."}
    except Exception as e:
        gemini.logger.error(f"Error in clear_memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear chat memories.")

@app.post("/give_memory/")
@limiter.limit("10/minute")
async def give_memory_endpoint(request: Request, payload: MemoryRequest):
   try:
       await give_memory(payload)
       return {"message": "Memory updated successfully."}
   except Exception as e:
       gemini.logger.error(f"Error in give_memory: {e}")
       raise HTTPException(status_code=500, detail="Failed to update memory.")
    
@app.post("/reindex/")
@limiter.limit("10/minute")
async def reindex(request: Request):
    try:
        await build_index()
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

@app.post("/change_model/")
@limiter.limit("10/minute")
async def change_model(request: Request, req: ModelRequest):
    try:
        if req.model.lower() == "fast":
            gemini.gemini_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.9)
            gemini.RETRY_CHAIN = 1
            return {"message": "Switched to fast model (gemini-2.0-flash)"}
        elif req.model.lower() == "advanced":
            gemini.gemini_llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-preview-04-17", temperature=0.6)
            gemini.RETRY_CHAIN = 3
            return {"message": "Switched to advanced model (gemini-2.5-flash-preview-04-17)"}
        elif req.model.lower() == "pro":
            gemini.gemini_llm = ChatGoogleGenerativeAI(model="gemini-2.5-pro-exp-03-25", temperature=0.9)
            gemini.RETRY_CHAIN = 1
            return {"message": "Switched to pro model (gemini-2.5-pro-exp-03-25)"}
        else:
            gemini.logger.error(f"Invalid model specified: {req.model}")
            raise HTTPException(status_code=400, detail="Invalid model specified. Use 'fast' or 'advanced'.")
    except Exception as e:
        gemini.logger.error(f"Error in change_model: {e}")
        raise HTTPException(status_code=500, detail="Failed to change model.")

@app.get("/current_model")
@limiter.limit("10/minute")
async def get_current_model(request: Request):
    try:
        model_name = gemini.gemini_llm.model
        return {"current_model": model_name}
    except Exception as e:
        gemini.logger.error(f"Error in get_current_model: {e}")
        raise HTTPException(status_code=500, detail=f"Could not retrieve current model: {e}")

@app.post("/run_python_code")
@limiter.limit("60/minute")
async def run_code(request: Request, payload: CodePayload):
    try:
        return await run_python_code(payload)
    except Exception as e:
        gemini.logger.error(f"Error in run_code: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute Python code.")

@app.post("/init_python_session")
@limiter.limit("60/minute")
async def init_session(request: Request):
    try:
        return await init_python_session(request)
    except Exception as e:
        gemini.logger.error(f"Error in init_session: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize Python session.")

@app.post("/close_python_session")
@limiter.limit("60/minute")
async def close_session(request: Request, payload: SessionPayload):
    try:
        return await close_python_session(payload)
    except Exception as e:
        gemini.logger.error(f"Error in close_session: {e}")
        raise HTTPException(status_code=500, detail="Failed to close Python session.")
    
@app.get("/check_web")
@limiter.limit("10/minute")
async def check_web(request: Request):
    try:
        return {"enabled": gemini.web_flag_state["enabled"]}
    except Exception as e:
        gemini.logger.error(f"Error in check_flag: {e}")
        raise HTTPException(status_code=500, detail="Failed to check web flag state.")
    
@app.get("/check_internal")
@limiter.limit("10/minute")
async def check_internal(request: Request):
    try:
        return {"enabled": gemini.internal_stack_state["enabled"]}
    except Exception as e:
        gemini.logger.error(f"Error in check_internal: {e}")
        raise HTTPException(status_code=500, detail="Failed to check internal flag state.")
    
@app.get("/check_stack_flow")
@limiter.limit("10/minute")
async def check_stack(request: Request):
    try:
        return {"enabled": gemini.web_stack_state["enabled"]}
    except Exception as e:
        gemini.logger.error(f"Error in stack_flag: {e}")
        raise HTTPException(status_code=500, detail="Failed to check stack flag state.")

@app.post("/change_stack_flow")
@limiter.limit("10/minute")
async def change_web(request: Request, payload: TogglePayload):
    try:
        gemini.web_stack_state["enabled"] = payload.enabled
        return {"status": "success", "enabled": gemini.web_stack_state["enabled"]}
    except Exception as e:
        gemini.logger.error(f"Error in change_web: {e}")
        raise HTTPException(status_code=500, detail="Failed to change web stack state.")

@app.post("/change_web")
@limiter.limit("10/minute")
async def change_web(request: Request, payload: TogglePayload):
    try:
        gemini.web_flag_state["enabled"] = payload.enabled
        return {"status": "success", "enabled": gemini.web_flag_state["enabled"]}
    except Exception as e:
        gemini.logger.error(f"Error in change_web: {e}")
        raise HTTPException(status_code=500, detail="Failed to change web flag state.")

@app.post("/change_internal")
@limiter.limit("10/minute")
async def change_internal(request: Request, payload: TogglePayload):
    try:
        gemini.internal_stack_state["enabled"] = payload.enabled
        return {"status": "success", "enabled": gemini.internal_stack_state["enabled"]}
    except Exception as e:
        gemini.logger.error(f"Error in change_internal: {e}")
        raise HTTPException(status_code=500, detail="Failed to change internal stack state.")

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
        await erase_long_term_memory()
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
