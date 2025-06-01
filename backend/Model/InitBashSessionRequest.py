from pydantic import BaseModel
from typing import Optional

class InitBashSessionRequest(BaseModel):
    working_directory: Optional[str] = None
