from pydantic import BaseModel
from typing import Optional, Dict, List, Any

class PinnedFile(BaseModel):
    path: str
    name: str

class ClientInfo(BaseModel):
    timezone: str
    locale: str
    userAgent: str
    screenSize: Dict[str, int]

class MessagePayload(BaseModel):
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
    freeModel: Optional[str] = None
    pinnedFiles: Optional[List[PinnedFile]] = None
    taskId: Optional[str] = None
    
    def dict(self, *args, **kwargs) -> Dict[str, Any]:
        result = super().dict(*args, **kwargs)
        return result
        
    class Config:
        extra = "allow" 