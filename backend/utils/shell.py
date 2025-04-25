import os
import shutil
import subprocess
import tempfile
import time
import uuid
import asyncio
import threading
from pathlib import Path
from typing import Dict
from fastapi import HTTPException, Request

from utils.invoke_retry import invoke_with_retry
from Model.SessionPayload import SessionPayload
from Model.CodePayload import CodePayload
from Prompts.prompts import pip_install_chain, runnable_code_chain, feedback_chain_python
import config.tars as gemini

SESSION_TIMEOUT_SECONDS = gemini.SHELL_TIMEOUT_SECONDS
SESSION_MAP: Dict[str, dict] = {}

def session_cleanup_loop():
    while True:
        now = time.time()
        expired = [sid for sid, info in SESSION_MAP.items()
                   if now - info["created_at"] > SESSION_TIMEOUT_SECONDS]
        for sid in expired:
            try:
                shutil.rmtree(SESSION_MAP[sid]["temp_dir"], ignore_errors=True)
                del SESSION_MAP[sid]
            except Exception:
                continue
        time.sleep(60)

threading.Thread(target=session_cleanup_loop, daemon=True).start()

async def run_code_in_shell(cmd: list, timeout: int = 10, cwd: str = None, env: dict = None):
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=cwd, env=env
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode(), stderr.decode()
    except asyncio.TimeoutError:
        return "", "Execution timed out."
    except Exception as e:
        return "", f"Execution failed: {str(e)}"


async def init_python_session(request: Request):
    client_ip = request.client.host
    for session_id, info in SESSION_MAP.items():
        if info.get("client_ip") == client_ip:
            info["created_at"] = time.time()
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

    def update_env():
        env = os.environ.copy()
        env["PATH"] = f"{venv_bin}:{env.get('PATH', '')}"
        return env

    async def install_requirements(code: str):
        try:
            result = await invoke_with_retry(pip_install_chain, {"code": code})
            install_command = result.get("text", "").strip()
        except Exception:
            return []

        installed = []
        if install_command.startswith("pip install"):
            packages = list({pkg.strip() for pkg in install_command.split()[2:] if pkg.strip()})
            for pkg in packages:
                try:
                    out, err = await run_code_in_shell([pip_exec, "install", pkg], timeout=60)
                    if not err:
                        installed.append(pkg)
                except Exception:
                    continue
        return installed

    async def write_and_run(code: str):
        script_path = os.path.join(temp_dir, "script.py")
        Path(script_path).write_text(code)
        return await run_code_in_shell([python_exec, script_path], timeout=300, cwd=temp_dir, env=update_env())

    try:
        result = await invoke_with_retry(runnable_code_chain, {"code": payload.code})
        runnable_code = result.get("text", "").replace("```python", "").replace("```", "").strip()
    except Exception:
        runnable_code = payload.code

    installed_packages = await install_requirements(runnable_code)

    max_attempts = 5
    attempt = 0
    stdout, stderr = await write_and_run(runnable_code)

    while stderr and attempt < max_attempts:
        try:
            feedback_result = await invoke_with_retry(
                feedback_chain_python,
                {"code": runnable_code, "error": stderr}
            )
            fixed_code = feedback_result.get("text", "").replace("```python", "").replace("```", "").strip()
            if not fixed_code or fixed_code == runnable_code:
                break
            runnable_code = fixed_code
            installed_packages += await install_requirements(runnable_code)
            stdout, stderr = await write_and_run(runnable_code)
        except Exception:
            break
        attempt += 1

    return {
        "stdout": stdout,
        "stderr": stderr,
        "corrected_code": runnable_code,
        "installed_packages": list(set(installed_packages))
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
