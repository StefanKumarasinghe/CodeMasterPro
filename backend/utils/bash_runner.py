import os
import tempfile
import subprocess
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from utils.invoke_retry import invoke_with_retry
from ai.model_switcher import self_bash_correction_chain
from typing import Dict, Set
import config.tars as gemini

DANGEROUS_KEYWORDS: Set[str] = frozenset([
    'rm -rf', ':(){:|:&};:', 'mkfs', 'dd if=', 'shutdown', 'reboot',
    'format', '> /dev/', 'chmod 777', 'chown -R'
])

SCRIPT_TEMPLATE = "#!/bin/bash\nset -euo pipefail\ncd '{}'\n{}\n"
CODESPACE_DIR = Path("codespace")
full_path = CODESPACE_DIR.resolve()
_executor = ThreadPoolExecutor(max_workers=4)

def _get_codespace_root() -> str:
    if full_path.exists():
        return str(full_path)
    else:
        return os.getcwd()

def _run_subprocess(script_path: str, working_dir: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [script_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=30,
        cwd=working_dir
    )

def _create_temp_script(command: str, working_dir: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".sh", prefix="cmd_", dir=working_dir)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(SCRIPT_TEMPLATE.format(working_dir, command))
        os.chmod(path, 0o700)
        return path
    except:
        os.unlink(path)
        raise

async def run_bash_command_async(command: str) -> Dict[str, str]:
    if any(kw in command for kw in DANGEROUS_KEYWORDS):
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": "Command blocked: contains dangerous patterns"
        }
    
    working_dir = _get_codespace_root()
    script_path = None
    
    try:
        script_path = _create_temp_script(command, working_dir)
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _executor, _run_subprocess, script_path, working_dir
        )
        
        return {
            "exit_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    
    except subprocess.TimeoutExpired:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": "Command timed out after 30 seconds"
        }
    except Exception as e:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Execution error: {str(e)}"
        }
    finally:
        if script_path and os.path.exists(script_path):
            os.unlink(script_path)

def _extract_command(response_content: str) -> str:
    content = response_content.strip()
    if content.startswith("```bash"):
        content = content[7:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()

async def self_correction_loop_bash(command: str, recent_messages: list, max_attempts: int = 3) -> Dict[str, str]:
    current_command = command
    
    for attempt in range(max_attempts):
        result = await run_bash_command_async(current_command)
        
        if result["exit_code"] == 0:
            return result
        
        if attempt == max_attempts - 1:
            break
            
        try:
            response = await invoke_with_retry(
                self_bash_correction_chain(
                    model_type=gemini.modelType,
                    provider_type=gemini.providerName
                ),
                {
                    "command": current_command,
                    "recent_messages": str(recent_messages[-1]),
                    "error": result["stderr"],
                    "exit_code": result["exit_code"],
                    "stdout": result["stdout"]
                }
            )
            
            current_command = _extract_command(response.content)
            
        except Exception:
            break
    
    return {
        "exit_code": -1,
        "stdout": "",
        "stderr": f"Command failed after {max_attempts} attempts"
    }