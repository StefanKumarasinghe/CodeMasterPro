
from fastapi import HTTPException
from Model.CompletionRequest import CompletionRequest
from Model.CompletionResponse import CompletionResponse
from utils.invoke_retry import invoke_with_retry
from ai.model_switcher import autocomplete_chain
import config.tars as gemini

async def get_code_completion(request: CompletionRequest):
    try:
        lines = request.code.split('\n')
        cursor_line = 0
        cursor_col = 0
        current_pos = 0
        
        for i, line in enumerate(lines):
            if current_pos + len(line) + 1 > request.cursor_position:
                cursor_line = i
                cursor_col = request.cursor_position - current_pos
                break
            current_pos += len(line) + 1

        context_start = max(0, cursor_line - 3)
        context_end = min(len(lines), cursor_line + 3)
        context_lines = lines[context_start:context_end]

        current_line = lines[cursor_line][:cursor_col]

        response = await invoke_with_retry(autocomplete_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
            "language": request.language,
            "code_context": "\n".join(context_lines),
            "current_line": current_line,
            "cursor_position": cursor_col
        })
        response = response.content

        completions = response.split('\n')[:3]  
        
        return CompletionResponse(
            completions=completions,
            explanation="AI-generated code completions based on context"
        )
        
    except Exception as e:
        gemini
        raise HTTPException(status_code=500, detail=str(e)) 