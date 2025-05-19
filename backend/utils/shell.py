import os
import shutil
import tempfile
import time
import uuid
import asyncio
import threading
from pathlib import Path
from typing import Dict, Optional, Tuple, List, Any
from concurrent.futures import ThreadPoolExecutor
from fastapi import HTTPException, Request, status
from functools import lru_cache
from utils.invoke_retry import invoke_with_retry
from Model.SessionPayload import SessionPayload
from Model.CodePayload import CodePayload
from ai.model_switcher import pip_install_chain, runnable_code_chain, feedback_chain_python
import config.tars as gemini

SESSION_TIMEOUT_SECONDS = gemini.SHELL_TIMEOUT_SECONDS
SESSION_MAP: Dict[str, dict] = {}
EXECUTOR = ThreadPoolExecutor(max_workers=4)
SESSION_LOCK = threading.RLock()

def session_cleanup_loop():
    while True:
        now = time.time()
        expired_sessions = []
        
        with SESSION_LOCK:
            expired_sessions = [sid for sid, info in SESSION_MAP.items()
                      if now - info["created_at"] > SESSION_TIMEOUT_SECONDS]
            
            for sid in expired_sessions:
                try:
                    temp_dir = SESSION_MAP[sid]["temp_dir"]
                    EXECUTOR.submit(shutil.rmtree, temp_dir, True)
                    del SESSION_MAP[sid]
                except KeyError:
                    pass
                except Exception:
                    continue
        
        time.sleep(60)

threading.Thread(target=session_cleanup_loop, daemon=True).start()

async def run_code_in_shell(cmd: list, timeout: int = 10, cwd: str = None, env: dict = None) -> Tuple[str, str]:
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=cwd, env=env
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode('utf-8', errors='replace'), stderr.decode('utf-8', errors='replace')
    except asyncio.TimeoutError:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        return "", "Execution timed out."
    except Exception as e:
        return "", f"Execution failed: {str(e)}"

@lru_cache(maxsize=128)
def get_client_session_id(client_ip: str) -> Optional[str]:
    for session_id, info in SESSION_MAP.items():
        if info.get("client_ip") == client_ip:
            return session_id
    return None

async def init_python_session(request: Optional[Request] = None, client_ip: Optional[str] = None) -> dict:
    if request:
        client_ip = request.client.host
    elif not client_ip:
        raise ValueError("Either `request` or `client_ip` must be provided.")

    with SESSION_LOCK:
        session_id = get_client_session_id(client_ip)
        if session_id and session_id in SESSION_MAP:
            SESSION_MAP[session_id]["created_at"] = time.time()
            return {"session_id": session_id, "reused": True}

        try:
            temp_dir = tempfile.mkdtemp()
            venv_path = os.path.join(temp_dir, "venv")
            
            proc = await asyncio.create_subprocess_exec(
                "python3", "-m", "venv", venv_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            _, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                raise RuntimeError(f"Failed to create virtual environment: {stderr.decode()}")

            session_id = str(uuid.uuid4())
            SESSION_MAP[session_id] = {
                "temp_dir": temp_dir,
                "venv_path": venv_path,
                "created_at": time.time(),
                "client_ip": client_ip,
                "installed_packages": set()
            }
            get_client_session_id.cache_clear()
            return {"session_id": session_id, "reused": False}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"Failed to create session: {str(e)}"
            )

async def run_python_code(payload: CodePayload) -> dict:
    with SESSION_LOCK:
        session = SESSION_MAP.get(payload.session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Invalid session_id"
            )
        
        session["created_at"] = time.time()
    
    temp_dir = session["temp_dir"]
    venv_bin = os.path.join(session["venv_path"], "bin")
    python_exec = os.path.join(venv_bin, "python")
    pip_exec = os.path.join(venv_bin, "pip")

    def update_env() -> dict:
        env = os.environ.copy()
        env["PATH"] = f"{venv_bin}:{env.get('PATH', '')}"
        return env

    async def install_packages(packages: List[str]) -> List[str]:
        if not packages:
            return []
            
        installed = []
        unique_packages = set(packages) - session.get("installed_packages", set())
        
        if not unique_packages:
            return []
            
        install_tasks = []
        for pkg in unique_packages:
            install_tasks.append(run_code_in_shell(
                [pip_exec, "install", "--no-cache-dir", pkg], 
                timeout=60
            ))
            
        results = await asyncio.gather(*install_tasks, return_exceptions=True)
        
        for i, (out, err) in enumerate(r for r in results if not isinstance(r, Exception)):
            pkg = list(unique_packages)[i]
            if not err or "Successfully installed" in out:
                installed.append(pkg)
                with SESSION_LOCK:
                    session.setdefault("installed_packages", set()).add(pkg)
                    
        return installed

    async def extract_requirements(code: str) -> List[str]:
        try:
            result = await invoke_with_retry(
                pip_install_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
                {"code": code}
            )
            install_command = result.content.strip()
            
            return [
                pkg.strip()
                for pkg in install_command.split()
                if pkg.strip() and not pkg.startswith("pip") and not pkg.startswith("install")
            ]
        except Exception:
            return []

    async def write_and_run(code: str) -> Tuple[str, str]:
        script_path = os.path.join(temp_dir, f"script_{int(time.time())}.py")
        Path(script_path).write_text(code)
        return await run_code_in_shell(
            [python_exec, script_path], 
            timeout=300, 
            cwd=temp_dir, 
            env=update_env()
        )

    try:
        result = await invoke_with_retry(
            runnable_code_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
            {"code": payload.code}
        )
        runnable_code = result.content.replace("```python", "").replace("```", "").strip()
    except Exception:
        runnable_code = payload.code

    packages = await extract_requirements(runnable_code)
    installed_packages = await install_packages(packages)
    
    stdout, stderr = await write_and_run(runnable_code)

    max_attempts = 3
    attempt = 0

    while stderr and attempt < max_attempts:
        try:
            feedback_result = await invoke_with_retry(
                feedback_chain_python(model_type=gemini.modelType, provider_type=gemini.providerName),
                {"code": runnable_code, "error": stderr}
            )
            fixed_code = feedback_result.content.replace("```python", "").replace("```", "").strip()

            if not fixed_code or fixed_code == runnable_code:
                break

            runnable_code = fixed_code
            new_packages = await extract_requirements(runnable_code)
            installed_packages.extend(await install_packages(new_packages))
            stdout, stderr = await write_and_run(runnable_code)

            if "terminated" in stdout.lower() or not stderr:
                break

        except Exception:
            break

        attempt += 1

    return {
        "stdout": stdout,
        "stderr": stderr,
        "corrected_code": runnable_code,
        "installed_packages": sorted(set(installed_packages))
    }

async def close_python_session(payload: SessionPayload) -> dict:
    with SESSION_LOCK:
        session = SESSION_MAP.pop(payload.session_id, None)
        
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Invalid session_id"
        )
        
    try:
        temp_dir = session["temp_dir"]
        EXECUTOR.submit(shutil.rmtree, temp_dir, True)
        get_client_session_id.cache_clear()
        return {"message": f"Session {payload.session_id} closed and cleaned up successfully."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to cleanup session: {str(e)}"
        )