from pydantic import BaseModel
from typing import Optional, Dict, List

class PinnedFile(BaseModel):
    path: str
    name: str

class ClientInfo(BaseModel):
    timezone: str
    locale: str
    userAgent: str
    screenSize: Dict[str, int]  

class MessageRequest(BaseModel):
    message: str
    language: str
    mcp: str
    outputFormat: str
    syntaxHighlighting: bool
    showLineNumbers: bool
    autoComplete: bool
    customPrompt: Optional[str] = ""
    personalInfo: Optional[str] = ""
    chatId: str = "default"
    modelType: str
    providerName: str
    clientInfo: ClientInfo
    free_model: Optional[str] = None
    pinnedFiles: Optional[List[PinnedFile]] = None