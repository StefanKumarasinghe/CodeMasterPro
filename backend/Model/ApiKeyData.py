from pydantic import BaseModel
class ApiKeyData(BaseModel):
    serviceId: str
    apiKey: str