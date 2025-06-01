from pydantic import BaseModel

class BashCommandResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
