from pydantic import BaseModel

class ApiKeyRequest(BaseModel):
    serviceId: str
    