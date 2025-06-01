from pydantic import BaseModel
from typing import Optional

class StreamResponse(BaseModel):
    content: str
    type: str = "content"  # content, draft, refine, delete
    iteration: Optional[int] = None
    is_final: bool = False 