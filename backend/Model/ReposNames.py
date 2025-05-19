
from typing import List
from pydantic import BaseModel

class RepoNamesBody(BaseModel):
    ids: List[str]