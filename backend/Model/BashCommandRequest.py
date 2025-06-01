from pydantic import BaseModel

class BashCommandRequest(BaseModel):
    command: str
    session_id: str
