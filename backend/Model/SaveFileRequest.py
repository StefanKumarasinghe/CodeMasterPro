from pydantic import BaseModel
from typing import Optional

class SaveFileRequest(BaseModel):
    file_path: str
    content: str
    overwrite: Optional[bool] = True 