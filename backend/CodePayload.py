from pydantic import BaseModel

class CodePayload(BaseModel):
    session_id: str
    code: str