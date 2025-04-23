from pydantic import BaseModel
class TogglePayload(BaseModel):
    enabled: bool
