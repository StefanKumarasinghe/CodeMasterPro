import os
import uuid
import subprocess
from typing import Dict, Optional, List
import signal
import time
import pty
import fcntl
import select
import threading
import queue
import errno
import concurrent.futures
import shlex
from pathlib import Path

CODESPACE_DIR = Path("codespace")

class BashSession:
    def __init__(self, working_directory: Optional[str] = None):
        self.session_id = str(uuid.uuid4())
        self.working_directory = self._get_codespace_directory(working_directory)
        self.master_fd, self.slave_fd = pty.openpty()
        self.process = None
        self.output_queue = queue.Queue(maxsize=10000)
        self.is_running = False
        self.last_activity = time.time()
        self.command_lock = threading.RLock()
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        
        self._configure_pty()
        self.start_process()
        
    def _get_codespace_directory(self, working_directory: Optional[str] = None) -> str:
        if working_directory:
            return os.path.abspath(working_directory)
        
        if CODESPACE_DIR.exists():
            return str(CODESPACE_DIR)
            
        return os.getcwd()
        
    def _configure_pty(self):
        try:
            flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
            fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            import termios
            attrs = termios.tcgetattr(self.master_fd)
            attrs[0] &= ~(termios.ICRNL | termios.IXON)
            attrs[1] &= ~(termios.OPOST)
            attrs[3] &= ~(termios.ECHO | termios.ICANON | termios.IEXTEN | termios.ISIG)
            attrs[6][termios.VMIN] = 1
            attrs[6][termios.VTIME] = 0
            termios.tcsetattr(self.master_fd, termios.TCSANOW, attrs)
        except Exception as e:
            print(f"Warning: PTY configuration failed: {e}")
        
    def start_process(self):
        try:
            env = os.environ.copy()
            env.update({
                "TERM": "xterm-256color",
                "SHELL": "/bin/bash",
                "PATH": f"/usr/local/bin:/usr/bin:/bin:{env.get('PATH', '')}",
                "PS1": "\\u@\\h:\\w$ ",
                "DEBIAN_FRONTEND": "noninteractive",
                "PYTHONUNBUFFERED": "1",
                "LANG": "en_US.UTF-8",
                "LC_ALL": "en_US.UTF-8"
            })
            
            self.process = subprocess.Popen(
                ["/bin/bash", "--login"],
                stdin=self.slave_fd,
                stdout=self.slave_fd,
                stderr=self.slave_fd,
                cwd=self.working_directory,
                env=env,
                start_new_session=True
            )
            
            try:
                os.setpgid(self.process.pid, self.process.pid)
            except OSError:
                pass
                
            self.is_running = True
            
            self.reader_thread = threading.Thread(target=self._read_output, daemon=True)
            self.reader_thread.start()
            
            self._initialize_session()
            
        except Exception as e:
            self.is_running = False
            self._cleanup_fds()
            raise RuntimeError(f"Failed to start bash process: {str(e)}")

    def _initialize_session(self):
        init_commands = [
            f"cd {shlex.quote(self.working_directory)}",
            "export PYTHONPATH=$PYTHONPATH:.",
            "alias ll='ls -la'",
            "alias la='ls -A'",
            "alias l='ls -CF'",
            "set +H",
            "export HISTFILE=/dev/null",
            "export HISTSIZE=0"
        ]
        
        for cmd in init_commands:
            try:
                os.write(self.master_fd, (cmd + "\n").encode())
                time.sleep(0.1)
            except Exception as e:
                print(f"Warning: Failed to initialize command {cmd}: {e}")

    def _cleanup_fds(self):
        for fd in [self.master_fd, self.slave_fd]:
            try:
                os.close(fd)
            except (OSError, Exception):
                pass

    def _read_output(self):
        buffer = b""
        
        while self.is_running:
            try:
                ready, _, _ = select.select([self.master_fd], [], [], 0.05)
                if not ready:
                    continue
                    
                try:
                    chunk = os.read(self.master_fd, 8192)
                    if not chunk:
                        break
                        
                    buffer += chunk
                    
                    while b'\n' in buffer:
                        line, buffer = buffer.split(b'\n', 1)
                        try:
                            decoded_line = line.decode('utf-8', errors='replace')
                            if not self.output_queue.full():
                                self.output_queue.put(decoded_line + '\n')
                        except:
                            continue
                            
                except OSError as e:
                    if e.errno in (errno.EAGAIN, errno.EWOULDBLOCK):
                        continue
                    else:
                        break
                        
            except Exception:
                break
                
        if buffer:
            try:
                decoded_line = buffer.decode('utf-8', errors='replace')
                if not self.output_queue.full():
                    self.output_queue.put(decoded_line)
            except:
                pass

    def execute_command(self, command: str, timeout: float = 30.0) -> Dict[str, str]:
        if not self.is_running or not self.process:
            return {
                "stdout": "",
                "stderr": "Session is not running",
                "exit_code": -1,
                "execution_time": 0.0
            }
            
        with self.command_lock:
            start_time = time.time()
            self.last_activity = start_time
            
            try:
                while not self.output_queue.empty():
                    try:
                        self.output_queue.get_nowait()
                    except queue.Empty:
                        break
                
                marker = f"CMD_START_{int(time.time() * 1000000)}"
                end_marker = f"CMD_END_{int(time.time() * 1000000)}"
                
                full_command = f"echo '{marker}'; {command}; echo $? > /tmp/exit_code_$$; echo '{end_marker}'"
                
                os.write(self.master_fd, (full_command + "\n").encode())
                
                output_lines = []
                collecting = False
                exit_code = 0
                deadline = start_time + timeout
                
                while time.time() < deadline:
                    try:
                        line = self.output_queue.get(timeout=0.1)
                        
                        if marker in line:
                            collecting = True
                            continue
                        elif end_marker in line:
                            break
                        elif collecting:
                            output_lines.append(line.rstrip('\n\r'))
                            
                    except queue.Empty:
                        if self.process.poll() is not None:
                            break
                        continue
                
                try:
                    with open(f'/tmp/exit_code_{self.process.pid}', 'r') as f:
                        exit_code = int(f.read().strip())
                    os.unlink(f'/tmp/exit_code_{self.process.pid}')
                except:
                    exit_code = 0
                
                output_text = '\n'.join(output_lines)
                stdout_lines = []
                stderr_lines = []
                
                for line in output_lines:
                    if any(indicator in line.lower() for indicator in ['error:', 'bash:', 'command not found', 'permission denied']):
                        stderr_lines.append(line)
                    else:
                        stdout_lines.append(line)
                
                execution_time = time.time() - start_time
                
                return {
                    "stdout": '\n'.join(stdout_lines) if stdout_lines else "",
                    "stderr": '\n'.join(stderr_lines) if stderr_lines else "",
                    "exit_code": exit_code,
                    "execution_time": round(execution_time, 3)
                }
                
            except Exception as e:
                execution_time = time.time() - start_time
                return {
                    "stdout": "",
                    "stderr": f"Error executing command: {str(e)}",
                    "exit_code": -1,
                    "execution_time": round(execution_time, 3)
                }

    def execute_async(self, command: str, timeout: float = 30.0):
        return self.executor.submit(self.execute_command, command, timeout)

    def get_working_directory(self) -> str:
        result = self.execute_command("pwd", timeout=5.0)
        if result["exit_code"] == 0 and result["stdout"]:
            return result["stdout"].strip()
        return self.working_directory

    def change_directory(self, path: str) -> bool:
        result = self.execute_command(f"cd {shlex.quote(path)} && pwd")
        if result["exit_code"] == 0:
            self.working_directory = result["stdout"].strip()
            return True
        return False

    def is_alive(self) -> bool:
        return self.is_running and self.process and self.process.poll() is None

    def close(self):
        self.is_running = False
        
        if self.process:
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
                
                try:
                    self.process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    os.killpg(self.process.pid, signal.SIGKILL)
                    try:
                        self.process.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        pass
            except (ProcessLookupError, OSError):
                pass
            except Exception as e:
                print(f"Warning: Error terminating process: {e}")
                
        self.executor.shutdown(wait=False)
        self._cleanup_fds()

class BashSessionManager:
    def __init__(self, max_sessions: int = 50, cleanup_interval: int = 30):
        self.sessions: Dict[str, BashSession] = {}
        self.max_sessions = max_sessions
        self.cleanup_interval = cleanup_interval
        self.session_lock = threading.RLock()
        self._start_cleanup_thread()
        
    def _start_cleanup_thread(self):
        self.cleanup_thread = threading.Thread(target=self._cleanup_inactive_sessions, daemon=True)
        self.cleanup_thread.start()
        
    def create_session(self, working_directory: Optional[str] = None) -> str:
        with self.session_lock:
            if len(self.sessions) >= self.max_sessions:
                oldest_session_id = min(
                    self.sessions.keys(),
                    key=lambda sid: self.sessions[sid].last_activity
                )
                self.close_session(oldest_session_id)
            
            try:
                session = BashSession(working_directory)
                self.sessions[session.session_id] = session
                return session.session_id
            except Exception as e:
                raise RuntimeError(f"Failed to create session: {str(e)}")
        
    def get_session(self, session_id: str) -> Optional[BashSession]:
        with self.session_lock:
            session = self.sessions.get(session_id)
            if session and not session.is_alive():
                self.close_session(session_id)
                return None
            return session
        
    def close_session(self, session_id: str) -> bool:
        with self.session_lock:
            session = self.sessions.pop(session_id, None)
            if session:
                try:
                    session.close()
                    return True
                except Exception as e:
                    print(f"Error closing session {session_id}: {e}")
            return False
            
    def list_sessions(self) -> List[Dict[str, str]]:
        with self.session_lock:
            return [
                {
                    "session_id": sid,
                    "working_directory": session.working_directory,
                    "last_activity": time.ctime(session.last_activity),
                    "is_alive": session.is_alive()
                }
                for sid, session in self.sessions.items()
            ]
            
    def _cleanup_inactive_sessions(self):
        while True:
            time.sleep(self.cleanup_interval)
            current_time = time.time()
            
            with self.session_lock:
                inactive_sessions = [
                    session_id
                    for session_id, session in list(self.sessions.items())
                    if (current_time - session.last_activity > 600 or not session.is_alive())
                ]
                
                for session_id in inactive_sessions:
                    self.close_session(session_id)

    def close_all_sessions(self):
        with self.session_lock:
            session_ids = list(self.sessions.keys())
            for session_id in session_ids:
                self.close_session(session_id)

bash_session_manager = BashSessionManager()

def create_bash_session(working_directory: Optional[str] = None) -> str:
    return bash_session_manager.create_session(working_directory)

def execute_bash_command(session_id: str, command: str, timeout: float = 30.0) -> Dict[str, str]:
    session = bash_session_manager.get_session(session_id)
    if not session:
        return {
            "stdout": "",
            "stderr": "Session not found or inactive",
            "exit_code": -1,
            "execution_time": 0.0
        }
    return session.execute_command(command, timeout)