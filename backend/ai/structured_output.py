from pydantic import BaseModel, Field
from typing import List

class ValidationChainOutput(BaseModel):
    score: int = Field(description="The score of the response between 0 and 10 and 10 is the best score")
    improvements: str = Field(description="The improvements of the response in detail")
    feedback: str = Field(description="The feedback of the response in detail")
    tool_calls: List[str] = Field(description="The tool calls of the response in a list of strings")

class DocumentationChainOutput(BaseModel):
    title: str = Field(description="The title of the documentation")
    content: str = Field(description="The content of the documentation")

class Question(BaseModel):
    question_id: str = Field(..., description="The ID of the question")
    title: str = Field(..., description="The title of the question")

class RankedQuestionsOutput(BaseModel):
    ranked_questions: List[Question] = Field(..., description="The ranked questions")

class LinkCategoriesOutput(BaseModel):
    documentation: List[str] = Field(..., description="The documentation links")
    example: List[str] = Field(..., description="The example links")

class RefineLocalSearchOutput(BaseModel):
    expanded_query: str = Field(..., description="The expanded query")
    keywords: List[str] = Field(..., description="The keywords")
    domain: str = Field(..., description="The domain")

class NodeReflectionOutput(BaseModel):
    code: str = Field(..., description="The corrected code")
    bash_commands:  List[str] = Field(..., description="The bash commands to run")
    file_changes: List[dict] = Field(..., description="The file changes to make")
    explanation: str = Field(..., description="The explanation of the changes")

class UserBehaviorOutput(BaseModel):
    behavior: str = Field(..., description="The behavior of the user either 'negative' or 'positive' or 'neutral'")
    model_type: str = Field(..., description="The model type to use either 'fast' or 'advanced' or 'quick-think'")
    temperature: float = Field(..., description="The temperature to use between 0 and 2")