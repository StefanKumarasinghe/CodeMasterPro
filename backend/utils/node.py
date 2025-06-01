import subprocess
import threading
import time
import asyncio
import os
import json
import tempfile
from typing import Dict, Any, AsyncGenerator
from pathlib import Path
from ai.model_switcher import node_reflection_chain
import config.tars as gemini
from utils.invoke_retry import invoke_with_retry
import socket
from contextlib import closing

CODESPACE_DIR = Path("codespace")
active_processes: Dict[str, Dict[str, Any]] = {}

async def stream_output_async(process_id: str, stream, stream_type: str) -> None:
    if process_id not in active_processes:
        active_processes[process_id] = {
            "process": None,
            "output_queue": asyncio.Queue(),
            "is_running": True
        }
    
    try:
        while True:
            line = await stream.readline()
            if not line:
                break
                
            try:
                decoded_line = line.decode('utf-8', errors='replace').strip()
                if decoded_line:
                    await active_processes[process_id]["output_queue"].put({
                        "type": stream_type,
                        "content": decoded_line
                    })
            except Exception as e:
                gemini.logger.error(f"Error decoding output line: {e}")
                continue
    except Exception as e:
        gemini.logger.error(f"Error in stream_output_async: {e}")
    finally:
        stream.close()

def stream_output(stream, name="", process_id=None, auto_fix=False):
    try:
        error_buffer = []
        for line in iter(stream.readline, b''):
            try:
                decoded_line = line.strip().decode('utf-8', errors='replace')
                if decoded_line:
                    print(f"[{name}] {decoded_line}")
                    
                    if process_id and process_id in active_processes:
                        asyncio.run_coroutine_threadsafe(
                            active_processes[process_id]["output_queue"].put({
                                "type": name,
                                "content": decoded_line
                            }),
                            asyncio.get_event_loop()
                        )
                    
                    if auto_fix and name == "stderr":
                        error_buffer.append(decoded_line)
                        if len(error_buffer) > 0 and any(error_indicator in decoded_line.lower() for error_indicator in [
                            "error", "exception", "failed", "crash", "undefined", "cannot", "invalid"
                        ]):
                            asyncio.run_coroutine_threadsafe(
                                handle_runtime_error(error_buffer, process_id),
                                asyncio.get_event_loop()
                            )
                            error_buffer = []
                            
            except Exception as e:
                print(f"Error processing output line: {e}")
                continue
    except Exception as e:
        print(f"Error in stream {name}: {e}")
    finally:
        stream.close()

async def handle_runtime_error(error_messages, process_id):
    """Handle runtime errors by analyzing them and attempting fixes."""
    if not process_id or process_id not in active_processes:
        return
        
    process_info = active_processes[process_id]
    if not process_info.get("is_running"):
        return

    error_text = "\n".join(error_messages)
    print(f"Detected runtime error:\n{error_text}")
    
    try:
        reflection_input = {
            "code": "",
            "test_code": "",
            "stdout": "",
            "stderr": error_text,
            "exit_code": 1,
            "explanation": "Runtime error detected"
        }
        
        reflection = await invoke_with_retry(
            node_reflection_chain(
                model_type=gemini.modelType,
                provider_type=gemini.providerName
            ),
            reflection_input
        )
        
        if reflection and reflection.bash_commands:
            await process_info["output_queue"].put({
                "type": "system",
                "content": "Attempting to fix runtime error..."
            })
            
            working_dir = Path(process_info["process"].cwd)
            
            for cmd in reflection.bash_commands:
                try:
                    process = await asyncio.create_subprocess_exec(
                        *cmd.split(),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        cwd=working_dir
                    )
                    stdout, stderr = await process.communicate()
                    
                    await process_info["output_queue"].put({
                        "type": "system",
                        "content": f"Fix command executed: {cmd}"
                    })
                    
                    if stdout:
                        await process_info["output_queue"].put({
                            "type": "stdout",
                            "content": stdout.decode('utf-8', errors='replace')
                        })
                    if stderr:
                        await process_info["output_queue"].put({
                            "type": "stderr",
                            "content": stderr.decode('utf-8', errors='replace')
                        })
                        
                except Exception as e:
                    await process_info["output_queue"].put({
                        "type": "error",
                        "content": f"Error executing fix command: {e}"
                    })
            
            await process_info["output_queue"].put({
                "type": "system",
                "content": "Restarting application after fixes..."
            })
            
            old_process = process_info["process"]
            old_cwd = old_process.cwd
            old_args = old_process.args
            
            old_process.terminate()
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, old_process.wait, 5
                )
            except subprocess.TimeoutExpired:
                old_process.kill()
                await asyncio.get_event_loop().run_in_executor(
                    None, old_process.wait
                )
            
            new_process = subprocess.Popen(
                old_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=False,
                bufsize=1,
                universal_newlines=False,
                cwd=old_cwd
            )
            
            process_info["process"] = new_process
            
            stdout_thread = threading.Thread(
                target=stream_output,
                args=(new_process.stdout, "stdout", process_id, True)
            )
            stderr_thread = threading.Thread(
                target=stream_output,
                args=(new_process.stderr, "stderr", process_id, True)
            )
            stdout_thread.daemon = True
            stderr_thread.daemon = True
            stdout_thread.start()
            stderr_thread.start()
            
    except Exception as e:
        await process_info["output_queue"].put({
            "type": "error",
            "content": f"Error during auto-fix attempt: {e}"
        })

def find_free_port():
    """Find a free port on the system."""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
        return port

def run_app_and_test(directory: str = None, run_command: str = "dev", auto_fix: bool = False):
    app_process = None
    max_retries = 5
    retry_count = 0
    port = find_free_port()
    last_error = None
    stdout_thread = None
    stderr_thread = None
    process_id = f"node-app-{int(time.time())}"
    
    try:
        working_dir = directory if directory else os.getcwd()
        if isinstance(working_dir, str):
            working_dir = Path(working_dir)
        if not working_dir.is_absolute():
            working_dir = CODESPACE_DIR / working_dir
        working_dir = working_dir.resolve()
        
        if not working_dir.exists() or not working_dir.is_dir():
            raise FileNotFoundError(f"Directory {working_dir} not found or is not a directory.")

        if not (working_dir / "package.json").exists():
            raise FileNotFoundError("package.json not found in the specified directory.")

        print("Installing npm dependencies...")
        try:
            subprocess.run(["npm", "install", "--legacy-peer-deps"], check=True, text=False, cwd=working_dir)
            print("npm install completed successfully with legacy-peer-deps.")
        except subprocess.CalledProcessError:
            try:
                subprocess.run(["npm", "install"], check=True, text=False, cwd=working_dir)
                print("npm install completed successfully.")
            except subprocess.CalledProcessError as e:
                print(f"Both install attempts failed: {e}")
                if auto_fix:
                    reflection_input = {
                        "code": "",
                        "test_code": "",
                        "stdout": "",
                        "stderr": str(e),
                        "exit_code": e.returncode,
                        "explanation": "npm install failed"
                    }
                    try:
                        reflection = invoke_with_retry(
                            node_reflection_chain(
                                model_type=gemini.modelType,
                                provider_type=gemini.providerName
                            ),
                            reflection_input
                        )
                        if reflection and reflection.bash_commands:
                            print("Attempting to fix npm install issues...")
                            for cmd in reflection.bash_commands:
                                try:
                                    subprocess.run(cmd.split(), check=True, text=True, cwd=working_dir)
                                    print(f"Successfully ran: {cmd}")
                                except subprocess.CalledProcessError as cmd_error:
                                    print(f"Failed to run command {cmd}: {cmd_error}")
                                    last_error = cmd_error
                    except Exception as reflection_error:
                        print(f"Error during npm install fix attempt: {reflection_error}")
                        last_error = reflection_error
                raise

        while retry_count < max_retries:
            print(f"Attempt {retry_count + 1} of {max_retries}")
            print(f"Starting the development server on port {port}...")
            
            env = os.environ.copy()
            env["PORT"] = str(port)
            
            if app_process:
                app_process.terminate()
                try:
                    app_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    app_process.kill()
                    app_process.wait()

            app_process = subprocess.Popen(
                ["npm", "run", run_command, "--", "--port", str(port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=False,
                bufsize=1,
                universal_newlines=False,
                cwd=working_dir,
                env=env
            )

            active_processes[process_id] = {
                "process": app_process,
                "output_queue": asyncio.Queue(),
                "is_running": True
            }

            if stdout_thread and stdout_thread.is_alive():
                stdout_thread.join(timeout=1)
            if stderr_thread and stderr_thread.is_alive():
                stderr_thread.join(timeout=1)

            stdout_thread = threading.Thread(
                target=stream_output,
                args=(app_process.stdout, "stdout", process_id, auto_fix)
            )
            stderr_thread = threading.Thread(
                target=stream_output,
                args=(app_process.stderr, "stderr", process_id, auto_fix)
            )
            stdout_thread.daemon = True
            stderr_thread.daemon = True
            stdout_thread.start()
            stderr_thread.start()

            print("Waiting for the development server to start...")
            start_time = time.time()
            max_wait_time = 30
            is_running = False
            connection_attempts = 0
            max_connection_attempts = 10

            while time.time() - start_time < max_wait_time and connection_attempts < max_connection_attempts:
                app_process.poll()
                if app_process.returncode is not None:
                    break
                
                try:
                    with socket.create_connection(("localhost", port), timeout=1):
                        is_running = True
                        print(f"Application successfully started on port {port}")
                        return {
                            "success": True,
                            "message": f"Application running on port {port}",
                            "port": port,
                            "process_id": process_id
                        }
                except (socket.error, socket.timeout):
                    connection_attempts += 1
                    time.sleep(1)
                    continue

            app_process.poll()
            if app_process.returncode is not None:
                error_output = []
                try:
                    while True:
                        line = app_process.stderr.readline()
                        if not line:
                            break
                        decoded_line = line.decode('utf-8', errors='replace').strip()
                        if decoded_line:
                            error_output.append(decoded_line)
                except Exception:
                    pass
                
                error_text = "\n".join(error_output) if error_output else "No error output available"
                print(f"Server failed to start. Error output:\n{error_text}")
                last_error = error_text
                
                if auto_fix and retry_count < max_retries - 1:
                    reflection_input = {
                        "code": "",
                        "test_code": "",
                        "stdout": "",
                        "stderr": error_text,
                        "exit_code": app_process.returncode,
                        "explanation": "Server failed to start"
                    }
                    
                    try:
                        reflection = invoke_with_retry(
                            node_reflection_chain(
                                model_type=gemini.modelType,
                                provider_type=gemini.providerName
                            ),
                            reflection_input
                        )
                        
                        if reflection and reflection.bash_commands:
                            print("Attempting to fix issues with suggested commands...")
                            for cmd in reflection.bash_commands:
                                try:
                                    subprocess.run(cmd.split(), check=True, text=True, cwd=working_dir)
                                    print(f"Successfully ran: {cmd}")
                                except subprocess.CalledProcessError as e:
                                    print(f"Failed to run command {cmd}: {e}")
                                    last_error = e
                    except Exception as e:
                        print(f"Error during automatic fix attempt: {e}")
                        last_error = e
                
                retry_count += 1
                if retry_count < max_retries:
                    print("Retrying after applying fixes...")
                    port = find_free_port()
                    continue
                else:
                    print("Max retries reached. Unable to start the server.")
                    return {
                        "success": False,
                        "error": f"Failed to start server after {max_retries} attempts. Last error: {last_error}",
                        "port": None
                    }

            if not is_running:
                print(f"Server did not start within {max_wait_time} seconds")
                retry_count += 1
                if retry_count < max_retries:
                    port = find_free_port()
                    continue
                return {
                    "success": False,
                    "error": f"Server did not start within {max_wait_time} seconds after {max_retries} attempts",
                    "port": None
                }

    except Exception as e:
        print(f"Unexpected error: {e}")
        if process_id in active_processes:
            del active_processes[process_id]
        return {
            "success": False,
            "error": str(e),
            "port": None
        }
    finally:
        if app_process and not is_running:
            print("Terminating the development server due to error...")
            app_process.terminate()
            try:
                app_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                app_process.kill()
                app_process.wait()
            
            if stdout_thread and stdout_thread.is_alive():
                stdout_thread.join(timeout=1)
            if stderr_thread and stderr_thread.is_alive():
                stderr_thread.join(timeout=1)
                
            if process_id in active_processes:
                del active_processes[process_id]

async def run_node_app_with_streaming(process_id: str, directory: str = None, run_command: str = "start") -> Dict[str, Any]:
    active_processes[process_id] = {
        "process": None,
        "output_queue": asyncio.Queue(),
        "is_running": True, 
        "exit_code": None
    }
    print(f"Running {run_command} in {directory}")
    current_working_dir_str = ""

    try:
        if directory:
            if Path(directory).is_absolute():
                if not str(Path(directory).resolve()).startswith(str(CODESPACE_DIR.resolve())):
                    error_msg = f"Security: Absolute directory '{directory}' is outside the allowed codespace."
                    gemini.logger.error(error_msg)
                    await active_processes[process_id]["output_queue"].put({"type": "error", "content": error_msg})
                    active_processes[process_id]["is_running"] = False
                    return {"success": False, "process_id": process_id, "error": error_msg}
                resolved_directory = Path(directory).resolve()
            else:
                resolved_directory = (CODESPACE_DIR / directory).resolve()
        else:
            resolved_directory = CODESPACE_DIR.resolve()
        
        current_working_dir = resolved_directory
        current_working_dir_str = str(current_working_dir)
        print(f"Current working directory: {current_working_dir_str}")

        if not str(current_working_dir).startswith(str(CODESPACE_DIR.resolve())):
            error_msg = f"Security: Resolved directory '{current_working_dir}' is outside the allowed codespace '{CODESPACE_DIR.resolve()}'."
            gemini.logger.error(error_msg)
            await active_processes[process_id]["output_queue"].put({"type": "error", "content": error_msg})
            active_processes[process_id]["is_running"] = False
            return {"success": False, "process_id": process_id, "error": error_msg}

        if not current_working_dir.exists() or not current_working_dir.is_dir():
            error_msg = f"Working directory '{current_working_dir}' does not exist or is not a directory."
            gemini.logger.error(error_msg)
            await active_processes[process_id]["output_queue"].put({"type": "error", "content": error_msg})
            active_processes[process_id]["is_running"] = False
            return {"success": False, "process_id": process_id, "error": error_msg}
        
        package_json_path = current_working_dir / "package.json"
        if not package_json_path.exists() or not package_json_path.is_file():
            error_msg = f"package.json not found or is not a file in '{current_working_dir}'."
            gemini.logger.error(error_msg)
            await active_processes[process_id]["output_queue"].put({"type": "error", "content": error_msg})
            active_processes[process_id]["is_running"] = False
            return {"success": False, "process_id": process_id, "error": error_msg}

        try:
            with open(package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
            if "scripts" not in package_data or run_command not in package_data["scripts"]:
                available_scripts = list(package_data.get('scripts', {}).keys())
                error_msg = f"Script '{run_command}' not found in scripts section of '{package_json_path}'. Available: {available_scripts}"
                gemini.logger.error(error_msg)
                await active_processes[process_id]["output_queue"].put({"type": "error", "content": error_msg})
                active_processes[process_id]["is_running"] = False
                return {"success": False, "process_id": process_id, "error": error_msg}
        except (json.JSONDecodeError, UnicodeDecodeError, IOError) as e:
            error_msg = f"Invalid or unreadable package.json file at '{package_json_path}'. Error: {e}"
            gemini.logger.error(error_msg)
            await active_processes[process_id]["output_queue"].put({"type": "error", "content": error_msg})
            active_processes[process_id]["is_running"] = False
            return {"success": False, "process_id": process_id, "error": error_msg}
            
        node_modules_path = current_working_dir / "node_modules"
        if not node_modules_path.exists() or not node_modules_path.is_dir():
            await active_processes[process_id]["output_queue"].put({
                "type": "command",
                "content": f"node_modules not found in '{current_working_dir}'. Installing dependencies..."
            })
            
            install_process = await asyncio.create_subprocess_exec(
                "npm", "install",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=current_working_dir, 
                text=False
            )
            
            asyncio.create_task(stream_output_async(process_id, install_process.stdout, "stdout"))
            asyncio.create_task(stream_output_async(process_id, install_process.stderr, "stderr"))
            
            await install_process.wait()
            
            if install_process.returncode != 0:
                install_process = await asyncio.create_subprocess_exec(
                    "npm", "install", "--legacy-peer-deps",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=current_working_dir, 
                    text=False
                )

                await install_process.wait()
                
                if install_process.returncode != 0:
                    error_msg = f"Failed to install dependencies in '{current_working_dir}'. npm install --legacy-peer-deps exit code: {install_process.returncode}"
                    gemini.logger.error(error_msg)
                    active_processes[process_id]["is_running"] = False
                    active_processes[process_id]["exit_code"] = install_process.returncode
                    return {"success": False, "process_id": process_id, "error": error_msg}
                
            await active_processes[process_id]["output_queue"].put({
                "type": "system",
                "content": "Dependencies installed successfully."
            })

        await active_processes[process_id]["output_queue"].put({
            "type": "command",
            "content": f"Running 'npm run {run_command}' in '{current_working_dir}'..."
        })
        
        process = await asyncio.create_subprocess_exec(
            "npm", "run", run_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=current_working_dir,
            text=False,
            bufsize=0
        )
        
        active_processes[process_id]["process"] = process
        
        asyncio.create_task(stream_output_async(process_id, process.stdout, "stdout"))
        asyncio.create_task(stream_output_async(process_id, process.stderr, "stderr"))
        asyncio.create_task(monitor_process_completion(process_id, process))
        
        gemini.logger.info(f"Successfully started 'npm run {run_command}' for process {process_id} in {current_working_dir}")
        return {
            "success": True,
            "process_id": process_id,
            "message": f"Started 'npm run {run_command}' in '{current_working_dir}'. Streaming output..."
        }
        
    except Exception as e:
        error_msg_critical = f"Critical error in run_node_app_with_streaming for dir '{current_working_dir_str}': {str(e)}"
        gemini.logger.error(error_msg_critical, exc_info=True)
        
        if process_id in active_processes:
            if active_processes[process_id].get("output_queue"):
                try:
                    await active_processes[process_id]["output_queue"].put({
                        "type": "error",
                        "content": error_msg_critical
                    })
                except Exception:
                    pass
            active_processes[process_id]["is_running"] = False
            
        return {
            "success": False,
            "process_id": process_id, 
            "error": error_msg_critical
        }

async def monitor_process_completion(process_id: str, process) -> None:
    exit_code = await process.wait()
    
    if process_id in active_processes:
        active_processes[process_id]["is_running"] = False
        active_processes[process_id]["exit_code"] = exit_code
        
        await active_processes[process_id]["output_queue"].put({
            "type": "system",
            "content": f"Process exited with code {exit_code}"
        })
        
async def get_process_output(process_id: str) -> AsyncGenerator[Dict[str, str], None]:
    gemini.logger.info(f"SSE STREAM: Attempting to stream output for process_id: {process_id}")

    if process_id not in active_processes:
        gemini.logger.warning(f"SSE STREAM: Process_id {process_id} not found in active_processes for streaming.")
        yield {
            "event": "error",
            "data": json.dumps({"content": f"Process with ID {process_id} not found or already terminated."})
        }
        return
    
    if not active_processes[process_id].get("output_queue"):
        gemini.logger.error(f"SSE STREAM: Output queue not found for process_id {process_id}.")
        yield {
            "event": "error",
            "data": json.dumps({"content": f"Output queue misconfiguration for process {process_id}."})
        }
        active_processes[process_id]["is_running"] = False
        return

    gemini.logger.info(f"SSE STREAM: Starting stream for process_id: {process_id}. is_running: {active_processes[process_id].get('is_running')}")
    active_processes[process_id]["client_connected"] = True

    try:
        while not active_processes[process_id]["output_queue"].empty():
            try:
                message = active_processes[process_id]["output_queue"].get_nowait()
                gemini.logger.debug(f"SSE STREAM [{process_id}] Yielding pre-loop message: {message}")
                yield {
                    "event": message.get("type", "system"),
                    "data": json.dumps({"content": message.get("content", "")})
                }
            except asyncio.QueueEmpty:
                break
        
        heartbeat_counter = 0
        while active_processes[process_id].get("is_running", False) and active_processes[process_id].get("client_connected", False):
            try:
                message = await asyncio.wait_for(
                    active_processes[process_id]["output_queue"].get(), 
                    timeout=1.0
                )
                heartbeat_counter = 0
                gemini.logger.debug(f"SSE STREAM [{process_id}] Yielding active-loop message: {message}")
                yield {
                    "event": message.get("type", "system"),
                    "data": json.dumps({"content": message.get("content", "")})
                }
            except asyncio.TimeoutError:
                heartbeat_counter += 1
                if heartbeat_counter >= 5:
                    heartbeat_counter = 0
                    yield {
                        "event": "heartbeat",
                        "data": json.dumps({"content": "alive"})
                    }
                continue
            except Exception as e:
                gemini.logger.error(f"SSE STREAM [{process_id}] Error during active stream loop: {e}", exc_info=True)
                yield {
                    "event": "error",
                    "data": json.dumps({"content": f"Error in stream: {str(e)}"})
                }
                break
        
        gemini.logger.info(f"SSE STREAM [{process_id}] Process marked as not running or loop exited. Processing remaining messages.")
        remaining_messages = 0
        while remaining_messages < 100:
            try:
                message = active_processes[process_id]["output_queue"].get_nowait()
                gemini.logger.debug(f"SSE STREAM [{process_id}] Yielding post-loop message: {message}")
                yield {
                    "event": message.get("type", "system"),
                    "data": json.dumps({"content": message.get("content", "")})
                }
                remaining_messages += 1
            except asyncio.QueueEmpty:
                break
        
        exit_code_info = active_processes[process_id].get('exit_code')
        if exit_code_info is not None:
            exit_message = f"Process completed with exit code {exit_code_info}"
        else:
            exit_message = "Process completed"
            
        gemini.logger.info(f"SSE STREAM [{process_id}] Sending complete event. Exit code: {exit_code_info}")
        yield {
            "event": "complete",
            "data": json.dumps({"content": exit_message})
        }
        
    except GeneratorExit:
        gemini.logger.info(f"SSE STREAM [{process_id}] Client disconnected (GeneratorExit)")
        if process_id in active_processes:
            active_processes[process_id]["client_connected"] = False
            active_processes[process_id]["is_running"] = False
        raise
    except Exception as e:
        gemini.logger.error(f"SSE STREAM [{process_id}] Critical error in get_process_output: {e}", exc_info=True)
        try:
            yield {
                "event": "error",
                "data": json.dumps({"content": f"Critical streaming error: {str(e)}"})
            }
        except Exception:
            pass
    finally:
        gemini.logger.info(f"SSE STREAM [{process_id}] Stream function finally block reached.")
        if process_id in active_processes:
            active_processes[process_id]["client_connected"] = False

def terminate_process(process_id: str) -> Dict[str, Any]:
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
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    gemini.logger.error(f"Failed to kill process {process_id} after multiple attempts")
                    
        active_processes[process_id]["is_running"] = False
        active_processes[process_id]["exit_code"] = process.returncode if process else None
        
        if active_processes[process_id].get("output_queue"):
            try:
                asyncio.create_task(
                    active_processes[process_id]["output_queue"].put({
                        "type": "system",
                        "content": "Process terminated by user"
                    })
                )
            except Exception as e:
                gemini.logger.error(f"Error adding termination message to queue: {e}")

        async def delayed_cleanup():
            await asyncio.sleep(2)
            if process_id in active_processes:
                del active_processes[process_id]
                
        asyncio.create_task(delayed_cleanup())
        
        return {
            "success": True,
            "message": "Process terminated successfully"
        }
    except Exception as e:
        gemini.logger.error(f"Error terminating process {process_id}: {e}")
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

async def run_with_self_correction_loop(code: str, recent_messages: list):
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

async def run_bash_commands(working_dir: Path, commands: list) -> dict:
    results = []
    working_dir = CODESPACE_DIR / working_dir
    for cmd in commands:
        process = await asyncio.create_subprocess_exec(
            *cmd.split(),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=working_dir
        )
        stdout, stderr = await process.communicate()
        results.append({
            "command": cmd,
            "success": process.returncode == 0,
            "stdout": stdout.decode("utf-8", errors="replace"),
            "stderr": stderr.decode("utf-8", errors="replace")
        })
    return results
