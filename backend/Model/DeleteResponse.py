from pydantic import BaseModel
from typing import List
class DeletionResponse(BaseModel):
    message: str
    deleted_ids: List[str] 