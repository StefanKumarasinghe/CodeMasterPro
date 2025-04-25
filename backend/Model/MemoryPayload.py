from pydantic import BaseModel
class MemoryRequest(BaseModel):
    chatId: str
    input: str
    result: str