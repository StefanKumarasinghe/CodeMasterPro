from pydantic import BaseModel

class CloseBashSessionRequest(BaseModel):
    session_id: str