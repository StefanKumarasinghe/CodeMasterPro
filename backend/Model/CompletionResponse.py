
from pydantic import BaseModel
from typing import List, Optional

class CompletionResponse(BaseModel):
    completions: List[str]
    explanation: Optional[str] = None