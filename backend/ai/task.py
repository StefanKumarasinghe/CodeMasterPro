from typing import Dict
import asyncio

class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, asyncio.Task] = {}

    def register(self, chat_id: str, task: asyncio.Task):
        self.tasks[chat_id] = task

    def cancel(self, chat_id: str) -> bool:
        task = self.tasks.get(chat_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    def unregister(self, chat_id: str):
        if chat_id in self.tasks:
            del self.tasks[chat_id]

    def get_task(self, chat_id: str):
        return self.tasks.get(chat_id)
