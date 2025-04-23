from pydantic import BaseModel
class ExistingDocument(BaseModel):
    id: str
    name: str
    size: int
