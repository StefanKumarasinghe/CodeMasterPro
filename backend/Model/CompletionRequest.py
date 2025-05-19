
from typing import Optional
from pydantic import BaseModel

class CompletionRequest(BaseModel):
    code: str
    language: str
    cursor_position: int
    context: Optional[str] = None
    max_tokens: Optional[int] = 50
