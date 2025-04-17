from pydantic import BaseModel
class SessionPayload(BaseModel):
    session_id: str
