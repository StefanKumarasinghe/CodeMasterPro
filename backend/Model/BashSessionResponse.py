from pydantic import BaseModel
class BashSessionResponse(BaseModel):
    session_id: str
