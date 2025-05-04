from pydantic import BaseModel
class MessageRequest(BaseModel):
    message: str
    language: str
    mcp: str
    outputFormat: str
    customPrompt: str = ""
    personalInfo: str = ""
    clientInfo: dict
    chatId: str = "default"