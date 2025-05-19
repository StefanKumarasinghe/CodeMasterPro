import os
import sqlite3
import asyncio
import hashlib
import json
import time
import concurrent.futures
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from functools import lru_cache
from contextlib import contextmanager
from utils.faiss import build_index, search_resources_local
from ai.model_switcher import file_index_chain, memory_analyzer_chain
from utils.invoke_retry import invoke_with_retry
from ai.memory import ChatMemoryManager
import utils.deep_think as deep_thinking
import config.tars as gemini

POOL_SIZE = os.cpu_count() or 4
DB_POOL_SIZE = min(8, POOL_SIZE)  
THREAD_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=POOL_SIZE)
PROCESS_POOL = concurrent.futures.ProcessPoolExecutor(max_workers=POOL_SIZE)

DB_PATH = './cache/resources.db'
RESOURCE_FOLDER = "resources"
ASSESSMENT_INTERVAL = 60
MEMORY_ANALYSIS_INTERVAL = 5  
MAX_BATCH_SIZE = 10  

memory_manager = ChatMemoryManager(gemini)

last_memory_hash = {}
analysis_metrics = {
    "processed_files": 0,
    "analysis_count": 0,
    "start_time": time.time()
}

class DBManager:
    _connection_pool = []
    _max_connections = DB_POOL_SIZE
    
    @classmethod
    @contextmanager
    def get_connection(cls):
        if not cls._connection_pool:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row  
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA temp_store = MEMORY")
            conn.execute("PRAGMA cache_size = 10000")
        else:
            conn = cls._connection_pool.pop()
            
        try:
            yield conn
        finally:
            if len(cls._connection_pool) < cls._max_connections:
                cls._connection_pool.append(conn)
            else:
                conn.close()
    
    @classmethod
    def setup_db(cls):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        with cls.get_connection() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS assessments (
                    filename TEXT PRIMARY KEY,
                    last_modified TIMESTAMP,
                    assessed BOOLEAN DEFAULT 0,
                    content_hash TEXT,
                    priority INTEGER DEFAULT 0,
                    last_analysis_duration REAL
                )
            ''')
            
            conn.execute('CREATE INDEX IF NOT EXISTS idx_assessed ON assessments(assessed)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_priority ON assessments(priority)')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            ''')
            conn.commit()

import os
import hashlib
from datetime import datetime
from typing import List, Dict, Any

MAX_BATCH_SIZE = 10  # Or whatever your default is

class FileManager:
    @staticmethod
    def compute_file_hash(filepath: str) -> str:
        hasher = hashlib.sha256()
        with open(filepath, 'rb') as file:
            while chunk := file.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def register_untracked_files(resource_folder: str) -> int:
        new_files = 0
        if not os.path.exists(resource_folder):
            os.makedirs(resource_folder, exist_ok=True)
            return 0

        with DBManager.get_connection() as conn:
            for filename in os.listdir(resource_folder):
                filepath = os.path.join(resource_folder, filename)
                if not os.path.isfile(filepath):
                    continue

                last_modified = datetime.fromtimestamp(os.path.getmtime(filepath))
                file_hash = FileManager.compute_file_hash(filepath)

                cursor = conn.execute(
                    'SELECT content_hash, assessed FROM assessments WHERE filename = ?', 
                    (filename,)
                )
                result = cursor.fetchone()

                if not result:

                    conn.execute('''
                        INSERT INTO assessments 
                        (filename, last_modified, assessed, content_hash, priority)
                        VALUES (?, ?, 1, ?, 5)
                    ''', (filename, last_modified.strftime("%Y-%m-%d %H:%M:%S"), file_hash))
                    new_files += 1

                else:

                    old_hash = result['content_hash']
                    was_assessed = result['assessed']

                    if old_hash != file_hash:
                        print(f"[INFO] Detected modified file: {filename}")
                        conn.execute('''
                            UPDATE assessments 
                            SET last_modified = ?, assessed = 0, content_hash = ?, priority = 5
                            WHERE filename = ?
                        ''', (last_modified.strftime("%Y-%m-%d %H:%M:%S"), file_hash, filename))
                        new_files += 1
                    else:
                        pass


            conn.commit()
        return new_files

    @staticmethod
    def get_unassessed_files(limit: int = MAX_BATCH_SIZE) -> List[Dict[str, Any]]:
        with DBManager.get_connection() as conn:
            cursor = conn.execute('''
                SELECT filename, last_modified, priority 
                FROM assessments 
                WHERE assessed = 0
                ORDER BY priority DESC, last_modified DESC
                LIMIT ?
            ''', (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def mark_file_assessed(filename: str, timestamp: str, duration: float):
        file_path = os.path.join(RESOURCE_FOLDER, filename)
        if not os.path.exists(file_path):
            return

        new_hash = FileManager.compute_file_hash(file_path)

        with DBManager.get_connection() as conn:
            conn.execute('''
                UPDATE assessments 
                SET assessed = 1, last_analysis_duration = ?, last_modified = ?, content_hash = ?
                WHERE filename = ?
            ''', (duration, timestamp, new_hash, filename))
            conn.commit()


class AIEngine:
    _model_cache = {}
    
    @staticmethod
    @lru_cache(maxsize=128)
    def get_cached_response(content_hash: str) -> Optional[str]:
        with DBManager.get_connection() as conn:
            cursor = conn.execute(
                'SELECT value FROM metadata WHERE key = ?', 
                (f"ai_response_{content_hash}",)
            )
            result = cursor.fetchone()
            return result['value'] if result else None
    
    @staticmethod
    def cache_response(content_hash: str, response: str):
        with DBManager.get_connection() as conn:
            conn.execute(
                'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
                (f"ai_response_{content_hash}", response)
            )
            conn.commit()
    
    @staticmethod
    async def analyze_file_content(file_content: str) -> Tuple[str, float]:
        start_time = time.time()
        
        content_hash = hashlib.sha256(file_content.encode('utf-8')).hexdigest()
        
        cached = AIEngine.get_cached_response(content_hash)
        if cached:
            return cached, 0.0  
            
        gemini_response = await invoke_with_retry(
            file_index_chain(
                model_type=gemini.modelType, 
                provider_type=gemini.providerName
            ), 
            {"content": file_content}
        )

        cleaned = gemini_response.content.strip()
        
        AIEngine.cache_response(content_hash, cleaned)
        
        duration = time.time() - start_time
        return cleaned, duration
    
    @staticmethod
    async def analyze_memory(chat_id: str, recent_messages: List[Dict], history: List[Dict], resources: str) -> str:
        if not recent_messages:
            return None
            
        last_message = recent_messages[-1]

        if hasattr(last_message, 'content'):
            msg_content = last_message.content
        elif isinstance(last_message, dict):
            msg_content = last_message.get('content', '')
        else:
            return None
            
        current_hash = hashlib.sha256(msg_content.encode('utf-8')).hexdigest()
        
        if chat_id in last_memory_hash and last_memory_hash[chat_id] == current_hash:
            return None
        
        condensed_history = AIEngine._condense_history(history)
        
        response = await invoke_with_retry(
            memory_analyzer_chain(
                model_type="thinking", 
                provider_type=gemini.providerName
            ), 
            {
                "recent_messages": recent_messages,
                "history": condensed_history,
                "resources": str(resources)
            }
        )
        
        last_memory_hash[chat_id] = current_hash
        return response.content
        
    @staticmethod
    def _condense_history(history: List[Dict]) -> List[Dict]:
        if not history:
            return []
            
        if len(history) <= 10:
            return history
            
        processed_history = []
        for msg in history:
            if hasattr(msg, 'content') and hasattr(msg, 'type'):
                processed_history.append({
                    'type': msg.type,
                    'content': msg.content
                })
            elif isinstance(msg, dict):
                processed_history.append(msg)
                
        if not processed_history:
            return history
            
        history = processed_history
        
        recent = history[-5:] if len(history) >= 5 else history
        
        condensed = []
        current_speaker = None
        current_group = []
        
        for msg in history[:-5] if len(history) > 5 else []:
            speaker = msg.get('type', 'unknown')
            
            if speaker != current_speaker and current_group:
                condensed.append({
                    'type': current_speaker,
                    'content': f"[{len(current_group)} messages about similar topics]"
                })
                current_group = []
                
            current_speaker = speaker
            current_group.append(msg)
            
        if current_group:
            condensed.append({
                'type': current_speaker,
                'content': f"[{len(current_group)} messages about similar topics]"
            })
            
        return condensed + recent

async def process_file(filename: str, resource_folder: str) -> bool:
    filepath = os.path.join(resource_folder, filename)
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            file_content = f.read()
        
        cleaned, duration = await AIEngine.analyze_file_content(file_content)
        
        save_cleaned_content(filepath, cleaned)
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        FileManager.mark_file_assessed(filename, timestamp, duration)
        
        analysis_metrics["processed_files"] += 1
        
        return True
    except Exception as e:
        gemini.logger.error(f"Error processing file {filename}: {e}")
        return False

def save_cleaned_content(filepath: str, content: str):
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        gemini.logger.error(f"Error saving cleaned content for {filepath}: {e}")

async def assess_files_batch(batch: List[Dict[str, Any]], resource_folder: str = RESOURCE_FOLDER) -> int:
    if not batch:
        return 0
    
    tasks = []
    for file_info in batch:
        task = process_file(file_info['filename'], resource_folder)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    success_count = 0
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            gemini.logger.error(f"Error processing file {batch[i]['filename']}: {result}")
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            FileManager.mark_file_assessed(batch[i]['filename'], timestamp, 0.0)
        elif result is True:
            success_count += 1
    
    if success_count > 0:
        await build_index()
        
    return success_count

async def assess_unassessed_files(resource_folder: str = RESOURCE_FOLDER):
    batch = FileManager.get_unassessed_files()
    if not batch:
        return 0
    
    gemini.logger.info(f"Processing batch of {len(batch)} files")
    processed = await assess_files_batch(batch, resource_folder)
    
    if processed > 0:
        gemini.logger.info(f"Successfully processed {processed} files")
    
    return processed

async def memory_analyzer_loop():
    global last_memory_hash
    
    while True:
        try:
            start_time = time.time()
            active_chats = memory_manager.get_active_chats()
            
            for chat_id in active_chats:
                memory = memory_manager.get_chat_memory(chat_id)
                
                if not hasattr(memory, 'chat_memory') or not hasattr(memory.chat_memory, 'messages'):
                    continue
                
                messages = memory.chat_memory.messages

                if len(messages) < 2:
                    continue
                
                try:
                    recent_messages = messages[-10:] if len(messages) >= 10 else messages
                    resources = await search_resources_local(str(messages), k=1)
                    try:
                        history = memory.load_memory_variables({}).get("history", [])
                    except:
                        history = recent_messages
                    
                    analysis = await AIEngine.analyze_memory(chat_id, recent_messages, history, resources)
                    
                    if analysis:
                        deep_thinking.set_deep_thinking(chat_id, analysis)
                        analysis_metrics["analysis_count"] += 1
                    
                except Exception as e:
                    gemini.logger.error(f"[Memory Analysis Error for chat {chat_id}] {e}")
            
            processing_time = time.time() - start_time
            sleep_time = max(MEMORY_ANALYSIS_INTERVAL - processing_time, 1)
            await asyncio.sleep(sleep_time)
            
        except Exception as e:
            gemini.logger.error(f"[Memory Analysis Loop Error] {e}")
            await asyncio.sleep(MEMORY_ANALYSIS_INTERVAL)

async def metrics_reporter():
    while True:
        try:
            with DBManager.get_connection() as conn:
                conn.execute(
                    'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
                    ('metrics', json.dumps(analysis_metrics))
                )
                conn.commit()
                
        except Exception as e:
            gemini.logger.error(f"[Metrics Reporter Error] {e}")
            
        await asyncio.sleep(60)  

async def run_memory_task():
    memory_task = asyncio.create_task(memory_analyzer_loop())
    metrics_task = asyncio.create_task(metrics_reporter())
    
    await asyncio.gather(memory_task, metrics_task)
        
async def periodic_assessment_task():
    DBManager.setup_db()
    
    while True:
        try:
            batch = FileManager.get_unassessed_files(limit=1)
            has_unassessed_files = len(batch) > 0
            new_files = 0
            if not has_unassessed_files:
                new_files = FileManager.register_untracked_files(RESOURCE_FOLDER)
                if new_files > 0:
                    pass

            processed = await assess_unassessed_files()

            if processed == 0 and new_files == 0:
                await asyncio.sleep(ASSESSMENT_INTERVAL)
            else:
                sleep_time = max(ASSESSMENT_INTERVAL / (processed + new_files + 1), 10)
                await asyncio.sleep(sleep_time)
                
        except Exception as e:
            gemini.logger.error(f"[Assessment Task Error] {e}")
            await asyncio.sleep(ASSESSMENT_INTERVAL)