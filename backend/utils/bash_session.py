from fastapi import Request, HTTPException
from Model.InitBashSessionRequest import InitBashSessionRequest
from Model.BashCommandRequest import BashCommandRequest
from Model.CloseBashSessionRequest import CloseBashSessionRequest
from Model.BashCommandResponse import BashCommandResponse
import config.tars as gemini
from utils.bash_session_manager import bash_session_manager
import traceback

async def close_bash_session(request: Request, bash_request: CloseBashSessionRequest):
    try:
        if not bash_request.session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
            
        success = bash_session_manager.close_session(bash_request.session_id)
        if not success:
            return {"status": "warning", "message": "Session was already closed or not found"}
        return {"status": "success"}
    except Exception as e:
        gemini.logger.error(f"Failed to close session: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to close session: {str(e)}")

async def init_bash_session(request: Request, bash_request: InitBashSessionRequest):
    try:
        session_id = bash_session_manager.create_session(bash_request.working_directory)
        if not session_id:
            raise HTTPException(status_code=500, detail="Failed to create bash session: No session ID returned")
            
        session = bash_session_manager.get_session(session_id)
        if not session or not session.is_alive():
            raise HTTPException(status_code=500, detail="Failed to initialize bash session: Session creation failed")
            
        return {"session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to create bash session: {str(e)}"
        gemini.logger.error(f"{error_msg}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)

async def run_bash_command(request: Request, bash_request: BashCommandRequest):
    try:
        if not bash_request.session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
            
        if not bash_request.command or not bash_request.command.strip():
            raise HTTPException(status_code=400, detail="Command cannot be empty")
            
        session = bash_session_manager.get_session(bash_request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or has expired")
            
        if not session.is_alive():
            raise HTTPException(status_code=400, detail="Session is no longer active")
        
        result = session.execute_command(bash_request.command)
        return BashCommandResponse(
            stdout=result["stdout"],
            stderr=result["stderr"],
            exit_code=result["exit_code"]
        )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to execute command: {str(e)}"
        gemini.logger.error(f"{error_msg}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)