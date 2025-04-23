
import os
import shutil
import subprocess
import tempfile
import time
import uuid
import asyncio
from pathlib import Path
from Model.SessionPayload import SessionPayload
from Model.CodePayload import CodePayload
from typing import Dict
from Prompts.prompts import pip_install_chain
import threading
import config.tars as gemini
from fastapi import HTTPException, Request

SESSION_TIMEOUT_SECONDS = gemini.SHELL_TIMEOUT_SECONDS
SESSION_MAP: Dict[str, dict] = {}

def session_cleanup_loop():
    while True:
        now = time.time()
        expired_sessions = [sid for sid, info in SESSION_MAP.items()
                            if now - info["created_at"] > SESSION_TIMEOUT_SECONDS]
        for sid in expired_sessions:
            try:
                shutil.rmtree(SESSION_MAP[sid]["temp_dir"], ignore_errors=True)
                del SESSION_MAP[sid]
            except Exception:
                continue
        time.sleep(60)

threading.Thread(target=session_cleanup_loop, daemon=True).start()

async def run_code_in_shell(cmd: list, timeout: int = 10, cwd: str = None):
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode(), stderr.decode()
    except asyncio.TimeoutError:
        return "", "Execution timed out"
    except Exception as e:
        return "", f"Execution failed: {str(e)}"

async def init_python_session(request: Request):
    client_ip = request.client.host
    for session_id, info in SESSION_MAP.items():
        if info.get("client_ip") == client_ip:
            SESSION_MAP[session_id]["created_at"] = time.time()
            return {"session_id": session_id, "reused": True}
    try:
        temp_dir = tempfile.mkdtemp()
        venv_path = os.path.join(temp_dir, "venv")
        subprocess.run(["python3", "-m", "venv", venv_path], check=True)
        session_id = str(uuid.uuid4())

        SESSION_MAP[session_id] = {
            "temp_dir": temp_dir,
            "venv_path": venv_path,
            "created_at": time.time(),
            "client_ip": client_ip
        }
        return {"session_id": session_id, "reused": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")
    
async def run_python_code(payload: CodePayload):
    session = SESSION_MAP.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    session["created_at"] = time.time()
    temp_dir = session["temp_dir"]
    venv_bin = os.path.join(session["venv_path"], "bin")
    python_exec = os.path.join(venv_bin, "python")
    pip_exec = os.path.join(venv_bin, "pip")
    code = payload.code
    code_file = os.path.join(temp_dir, "script.py")
    Path(code_file).write_text(code)
    install_command = await pip_install_chain.ainvoke(code)
    install_command = install_command["text"].strip()
    packages = []
    if install_command.startswith("pip install"):
        packages = install_command.replace("pip install", "").strip().split()
    installed_packages = []
    for pkg in sorted(set(packages)):
        try:
            await run_code_in_shell([pip_exec, "install", pkg], timeout=30)
            installed_packages.append(pkg)
        except Exception:
            continue
    stdout, stderr = await run_code_in_shell(
        [python_exec, code_file], timeout=50, cwd=temp_dir
    )
    return {
        "stdout": stdout,
        "stderr": stderr,
        "installed_packages": installed_packages,
    }

async def close_python_session(payload: SessionPayload):
    session = SESSION_MAP.pop(payload.session_id, None)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    try:
        shutil.rmtree(session["temp_dir"], ignore_errors=True)
        return {"message": f"Session {payload.session_id} closed and cleaned up successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup session: {str(e)}")
 