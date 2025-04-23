from pydantic import BaseModel
class DeletionResponse(BaseModel):
    message: str
    deleted_id: str
