import subprocess
import threading
import time
import asyncio
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
import json
import tempfile
from typing import Dict, Any, AsyncGenerator
from pathlib import Path
from ai.model_switcher import node_reflection_chain
import config.tars as gemini
from utils.invoke_retry import invoke_with_retry
CODESPACE_DIR = Path("codespace")

active_processes: Dict[str, Dict[str, Any]] = {}

async def stream_output_async(process_id: str, stream, stream_type: str) -> None:
    """Stream output from a process asynchronously and store in a queue."""
    if process_id not in active_processes:
        active_processes[process_id] = {
            "process": None,
            "output_queue": asyncio.Queue(),
            "is_running": True
        }
    
    while True:
        line = await stream.readline()
        if not line:
            break
            
        await active_processes[process_id]["output_queue"].put({
            "type": stream_type,
            "content": line.decode('utf-8', errors='replace').strip()
        })
    
    stream.close()

def stream_output(stream, name=""):
    for line in iter(stream.readline, ''):
        print(f"[{name}] {line.strip()}")
    stream.close()

def run_app_and_test():
    app_process = None
    try:
        if not os.path.exists("package.json"):
            raise FileNotFoundError("package.json not found in the current directory.")

        print("Installing npm dependencies...")
        subprocess.run(["npm", "install"], check=True, text=False)
        print("npm install completed successfully.")

        print("Starting the development server...")
        app_process = subprocess.Popen(
            ["npm", "run", "dev", "--", "--port", "3000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
            bufsize=1,
            universal_newlines=False
        )

        # Stream stdout and stderr in real time
        threading.Thread(target=stream_output, args=(app_process.stdout, "stdout")).start()
        threading.Thread(target=stream_output, args=(app_process.stderr, "stderr")).start()

        print("Waiting for the development server to start...")
        time.sleep(5)  # Give the dev server time to start

        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")

        driver = webdriver.Chrome(options=chrome_options)
        driver.set_page_load_timeout(30)

        try:
            print("Navigating to http://localhost:3000")
            driver.get("http://localhost:3000")
            WebDriverWait(driver, 20).until(EC.title_contains("Your App Title"))
            assert "Your App Title" in driver.title
            print("App title verified successfully!")

            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            print("Page loaded successfully!")

        except Exception as e:
            print(f"Selenium test failed: {e}")

        finally:
            print("Quitting the Selenium WebDriver...")
            driver.quit()

    except FileNotFoundError as e:
        print(f"Error: {e}")
    except subprocess.CalledProcessError as e:
        print(f"Subprocess failed during npm install:\n{e}")
    except AssertionError:
        print("Assertion failed: The title doesn't match!")
    except Exception as e:
        print(f"Unexpected error: {e}")
    finally:
        if app_process:
            print("Terminating the development server...")
            app_process.terminate()
            try:
                app_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                app_process.kill()

async def run_node_app_with_streaming(process_id: str, directory: str = None, run_command: str = "start") -> Dict[str, Any]:
    if process_id in active_processes and active_processes[process_id]["process"]:
        try:
            active_processes[process_id]["process"].terminate()
            active_processes[process_id]["process"].wait(timeout=2)
        except:
            try:
                active_processes[process_id]["process"].kill()
            except:
                pass
    
    active_processes[process_id] = {
        "process": None,
        "output_queue": asyncio.Queue(),
        "is_running": True,
        "exit_code": None
    }
    
    try:
        working_dir = directory if directory else os.getcwd()
        working_dir = CODESPACE_DIR / working_dir
        
        if not os.path.exists(os.path.join(working_dir, "package.json")):
            await active_processes[process_id]["output_queue"].put({
                "type": "error",
                "content": "package.json not found in the specified directory."
            })
            active_processes[process_id]["is_running"] = False
            return {
                "success": False,
                "process_id": process_id,
                "error": "package.json not found in the specified directory."
            }

        try:
            with open(os.path.join(working_dir, "package.json"), 'r') as f:
                package_data = json.load(f)

                
            if "scripts" not in package_data or run_command not in package_data["scripts"]:
                await active_processes[process_id]["output_queue"].put({
                    "type": "error",
                    "content": f"No '{run_command}' script found in package.json"
                })
                active_processes[process_id]["is_running"] = False
                return {
                    "success": False,
                    "process_id": process_id,
                    "error": f"No '{run_command}' script found in package.json"
                }
        except json.JSONDecodeError:
            await active_processes[process_id]["output_queue"].put({
                "type": "error",
                "content": "Invalid package.json file"
            })
            active_processes[process_id]["is_running"] = False
            return {
                "success": False,
                "process_id": process_id,
                "error": "Invalid package.json file"
            }
            
        if not os.path.exists(os.path.join(working_dir, "node_modules")):
            await active_processes[process_id]["output_queue"].put({
                "type": "command",
                "content": "Installing dependencies..."
            })
            
            install_process = await asyncio.create_subprocess_exec(
                "npm", "install",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                text=False,
                universal_newlines=False
            )
            
            asyncio.create_task(stream_output_async(process_id, install_process.stdout, "stdout"))
            asyncio.create_task(stream_output_async(process_id, install_process.stderr, "stderr"))
            
            await install_process.wait()
            
            if install_process.returncode != 0:
                await active_processes[process_id]["output_queue"].put({
                    "type": "error",
                    "content": "Failed to install dependencies"
                })
                active_processes[process_id]["is_running"] = False
                return {
                    "success": False,
                    "process_id": process_id,
                    "error": "Failed to install dependencies"
                }
        
        await active_processes[process_id]["output_queue"].put({
            "type": "command",
            "content": f"Running 'npm run {run_command}'..."
        })
        
        process = await asyncio.create_subprocess_exec(
            "npm", "run", run_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=working_dir,
            text=False,
            universal_newlines=False
        )
        
        active_processes[process_id]["process"] = process
        
        asyncio.create_task(stream_output_async(process_id, process.stdout, "stdout"))
        asyncio.create_task(stream_output_async(process_id, process.stderr, "stderr"))
        
        asyncio.create_task(monitor_process_completion(process_id, process))
        
        return {
            "success": True,
            "process_id": process_id,
            "message": f"Started npm run {run_command}"
        }
        
    except Exception as e:
        await active_processes[process_id]["output_queue"].put({
            "type": "error",
            "content": str(e)
        })
        active_processes[process_id]["is_running"] = False
        return {
            "success": False,
            "process_id": process_id,
            "error": str(e)
        }

async def monitor_process_completion(process_id: str, process) -> None:
    """Monitor a process for completion and update its status."""
    exit_code = await process.wait()
    
    if process_id in active_processes:
        active_processes[process_id]["is_running"] = False
        active_processes[process_id]["exit_code"] = exit_code
        
        await active_processes[process_id]["output_queue"].put({
            "type": "system",
            "content": f"Process exited with code {exit_code}"
        })

async def get_process_output(process_id: str) -> AsyncGenerator[Dict[str, str], None]:
    """
    Get streaming output from a process
    
    Args:
        process_id: The process ID to get output from
        
    Yields:
        dict: Output messages from the process
    """
    if process_id not in active_processes:
        yield {
            "event": "error",
            "data": json.dumps({"content": "Process not found"})
        }
        return
    
    while not active_processes[process_id]["output_queue"].empty():
        message = await active_processes[process_id]["output_queue"].get()
        yield {
            "event": message["type"],
            "data": json.dumps({"content": message["content"]})
        }
    
    while active_processes[process_id]["is_running"]:
        try:
            message = await asyncio.wait_for(active_processes[process_id]["output_queue"].get(), timeout=1.0)
            yield {
                "event": message["type"],
                "data": json.dumps({"content": message["content"]})
            }
        except asyncio.TimeoutError:
            yield {
                "event": "heartbeat",
                "data": json.dumps({"content": ""})
            }
    
    while not active_processes[process_id]["output_queue"].empty():
        message = await active_processes[process_id]["output_queue"].get()
        yield {
            "event": message["type"],
            "data": json.dumps({"content": message["content"]})
        }
    
    yield {
        "event": "complete",
        "data": json.dumps({"content": f"Process completed with exit code {active_processes[process_id]['exit_code']}"})
    }

def terminate_process(process_id: str) -> Dict[str, Any]:
    """
    Terminate a running process
    
    Args:
        process_id: The ID of the process to terminate
        
    Returns:
        dict: Result of the termination attempt
    """
    if process_id not in active_processes:
        return {
            "success": False,
            "error": "Process not found"
        }
    
    if not active_processes[process_id]["is_running"]:
        return {
            "success": True,
            "message": "Process already completed"
        }
    
    try:
        process = active_processes[process_id]["process"]
        if process:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                
        active_processes[process_id]["is_running"] = False
        return {
            "success": True,
            "message": "Process terminated"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to terminate process: {str(e)}"
        }

async def run_node_tests(directory: str = None, test_command: str = "test"):

    try:
        working_dir = directory if directory else os.getcwd()
        working_dir = CODESPACE_DIR / working_dir
        if not os.path.exists(os.path.join(working_dir, "package.json")):
            return {
                "success": False,
                "error": "package.json not found in the specified directory.",
                "stdout": "",
                "stderr": "Error: package.json not found in the specified directory."
            }
        
        try:
            with open(os.path.join(working_dir, "package.json"), 'r') as f:
                package_data = json.load(f)
                
            if "scripts" not in package_data or test_command not in package_data["scripts"]:
                return {
                    "success": False,
                    "error": f"No '{test_command}' script found in package.json",
                    "stdout": "",
                    "stderr": f"Error: No '{test_command}' script found in package.json"
                }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Invalid package.json file",
                "stdout": "",
                "stderr": "Error: Invalid package.json file"
            }
            
        if not os.path.exists(os.path.join(working_dir, "node_modules")):
            install_process = await asyncio.create_subprocess_exec(
                "npm", "install",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir
            )
            install_stdout, install_stderr = await install_process.communicate()
            
            if install_process.returncode != 0:
                return {
                    "success": False,
                    "error": "Failed to install dependencies",
                    "stdout": install_stdout.decode('utf-8', errors='replace'),
                    "stderr": install_stderr.decode('utf-8', errors='replace')
                }
        
        test_process = await asyncio.create_subprocess_exec(
            "npm", "run", test_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=working_dir
        )
        
        stdout, stderr = await test_process.communicate()
        
        return {
            "success": test_process.returncode == 0,
            "exit_code": test_process.returncode,
            "stdout": stdout.decode('utf-8', errors='replace'),
            "stderr": stderr.decode('utf-8', errors='replace')
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "stdout": "",
            "stderr": f"Error: {str(e)}"
        }

async def test_javascript_code(code: str, test_code: str = None, framework: str = "jest"):
    """
    Test JavaScript code snippets without requiring package.json or node_modules
    
    Args:
        code: The JavaScript code to test
        test_code: The test code (if not provided, will try to generate basic tests)
        framework: The test framework to use (default is jest)
        
    Returns:
        dict: A dictionary containing the test results
    """
    try: 
        with tempfile.TemporaryDirectory() as temp_dir:
            package_json = {
                "name": "code-test",
                "version": "1.0.0",
                "description": "Temporary project for testing code",
                "scripts": {
                    "test": f"npx {framework} --no-cache"
                }
            }
            
            with open(os.path.join(temp_dir, "package.json"), 'w') as f:
                json.dump(package_json, f)
                
            with open(os.path.join(temp_dir, "code.js"), 'w') as f:
                f.write(code)
                
            if test_code:
                test_content = test_code
            else:
                test_content = f"""
                const code = require('./code');

                test('Code should run without errors', () => {{
                  expect(() => {{
                    // Just checking if the code runs without errors
                    const exportedItems = Object.keys(code);
                    if (exportedItems.length > 0) {{
                      expect(code).toBeDefined();
                    }}
                  }}).not.toThrow();
                }});
                """
                
            with open(os.path.join(temp_dir, "code.test.js"), 'w') as f:
                f.write(test_content)
                
            install_process = await asyncio.create_subprocess_exec(
                "npm", "install", "--no-package-lock", "--no-save", framework,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir
            )
            
            install_stdout, install_stderr = await install_process.communicate()
            
            if install_process.returncode != 0:
                return {
                    "success": False,
                    "error": f"Failed to install {framework}",
                    "stdout": install_stdout.decode('utf-8', errors='replace'),
                    "stderr": install_stderr.decode('utf-8', errors='replace')
                }
                
            test_process = await asyncio.create_subprocess_exec(
                "npm", "test",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir
            )
            
            stdout, stderr = await test_process.communicate()
            
            return {
                "success": test_process.returncode == 0,
                "exit_code": test_process.returncode,
                "stdout": stdout.decode('utf-8', errors='replace'),
                "stderr": stderr.decode('utf-8', errors='replace')
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "stdout": "",
            "stderr": f"Error: {str(e)}"
        }


async def run_with_self_correction_loop(
    code: str,
    recent_messages: list
):
    string_messages = str(recent_messages[-1])  
    attempt = 0
    last_result = {}
    current_code = code + string_messages
    max_attempts = 5
    framework = "jest"
    current_test_code = None

    install_process = await asyncio.create_subprocess_exec(
        "npm", "install",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=os.getcwd()
    )
    await install_process.wait()

    while attempt < max_attempts:
        result = await test_javascript_code(current_code, current_test_code, framework)
        last_result = result

        if result.get("success"):
            return {
                "success": True,
                "code": current_code,
                "stdout": result.get("stdout"),
                "stderr": result.get("stderr"),
            }

        reflection_input = {
            "code": current_code,
            "test_code": current_test_code or "",
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "exit_code": result.get("exit_code", -1),
        }

        try:
            reflection = await invoke_with_retry(
                node_reflection_chain(
                    model_type=gemini.modelType,
                    provider_type=gemini.providerName
                ),
                reflection_input
            )

            updated = reflection.code.strip()
            updated = updated.replace("```javascript", "").replace("```", "").strip()
            current_code = updated
            
        except Exception as reflection_error:
            gemini.logger.warning(f"[Self-Correction] Reflection failed: {reflection_error}")
            break

        attempt += 1

    return {
        "success": False,
        "final_code": current_code,
        "last_result": last_result
    }

  
    