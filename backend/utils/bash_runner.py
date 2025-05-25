import os
import tempfile
import subprocess
from utils.invoke_retry import invoke_with_retry
from ai.model_switcher import self_bash_correction_chain
from typing import Dict
import config.tars as gemini

async def run_bash_command_async(command: str) -> Dict[str, str]:
    """Safely run a bash command asynchronously using a temporary shell script."""
    dangerous_keywords = ['rm -rf', ':(){:|:&};:', 'mkfs', 'dd if=', 'shutdown', 'reboot']
    if any(keyword in command for keyword in dangerous_keywords):
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": "Command contains dangerous keywords and was blocked for safety."
        }

    try:
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".sh", delete=False) as temp_script:
            temp_script.write("#!/bin/bash\n")
            temp_script.write("set -euo pipefail\n")
            temp_script.write(command)
            temp_script.flush()
            os.chmod(temp_script.name, 0o700)

        result = subprocess.run(
            [temp_script.name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    finally:
        if os.path.exists(temp_script.name):
            os.remove(temp_script.name)

    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr
    }

async def self_correction_loop_bash(command: str, recent_messages: list, max_attempts: int = 3) -> Dict[str, str]:
    """Attempt to run a bash command and self-correct it if it fails."""
    attempt = 0
    while attempt < max_attempts:
        recent_messages_str = str(recent_messages[-1])
        result = await run_bash_command_async(command)
        print(f"Result: {result}")
        if result["exit_code"] == 0:
            return {
                "exit_code": result["exit_code"],
                "stdout": result["stdout"],
                "stderr": result["stderr"]
            }

        response = await invoke_with_retry(
            self_bash_correction_chain(
                model_type=gemini.modelType,
                provider_type=gemini.providerName
            ),
            {
                "command": command,
                "recent_messages": recent_messages_str,
                "error": result["stderr"],
                "exit_code": result["exit_code"],
                "stdout": result["stdout"]
            }
        )

        print(f"Response: {response}")
        print(f"Response Content: {response.content}")


        command = response.content.strip()
        command = command.replace("```bash", "").replace("```", "").strip()
        attempt += 1

    return {
        "exit_code": -1,
        "stdout": "",
        "stderr": "Command failed after maximum attempts."
    }
