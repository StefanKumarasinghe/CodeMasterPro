from pydantic import BaseModel

class ModelRequest(BaseModel):
    model: str
