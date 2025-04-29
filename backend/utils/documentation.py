import json
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import File, Form, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse
from utils.faiss import build_index
from utils.local_save import save_resource
from utils.search import extract_article_data
import config.tars as gemini
import langchain
from ai.memory import reset_chat_memory
from Model.ExistingDocument import ExistingDocument

RESOURCES_DIR = Path("resources")

async def add_documentation(
    files: Optional[List[UploadFile]] = File(None),
    documentation_text: Optional[str] = Form(None),
    documentation_links: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    eraseLongTermMemory: bool = Form(False),
):
    try:
        if eraseLongTermMemory:
            reset_chat_memory("default")
            resources_dir = Path("resources")
            if resources_dir.exists() and resources_dir.is_dir():
                for entry in resources_dir.iterdir():
                    if entry.is_dir():
                        shutil.rmtree(entry)
                    else:
                        entry.unlink()
            langchain.llm_cache.clear()
            if gemini.resource_vectorstore:
                gemini.resource_vectorstore = None

        saved_files = []
        if files:
            for upload in files:
                content_bytes = await upload.read()
                await save_resource(content=content_bytes, folder_name="resources")
                saved_files.append(upload.filename)
        if documentation_text:
            await save_resource(content=documentation_text, folder_name="resources")
        if documentation_links:
            try:
                links = json.loads(json.dumps(json.loads(documentation_links)))
                if not isinstance(links, list):
                    raise ValueError("documentation_links must be a list of URLs.")
                for link in links:
                    try:
                        html_markdown =  extract_article_data(link)
                        await save_resource(content=str(html_markdown), folder_name="resources")
                    except Exception as inner_e:
                        gemini.logger.warning(f"Failed to extract/save from link {link}: {inner_e}")

            except json.JSONDecodeError:
                gemini.logger.error("Invalid JSON format for documentation_links.")
                raise HTTPException(status_code=400, detail="Invalid JSON format for documentation_links")
            except Exception as e:
                gemini.logger.error(f"Error processing documentation_links: {e}")
                raise HTTPException(status_code=400, detail=str(e))
            
        if description:
            await save_resource(content=f"Description:\n{description}", folder_name="resources")

        await build_index()
        return {
            "result": "Documentation added successfully.",
            "saved_files": saved_files,
            "erased": eraseLongTermMemory,
        }

    except Exception as e:
        gemini.logger.error(f"Error in add_documentation: {e}")
        raise HTTPException(status_code=500, detail="Failed to add documentation.")
    
async def get_documentation():
    documents = []
    if not RESOURCES_DIR.is_dir():
         gemini.logger.error(f"Resources directory '{RESOURCES_DIR}' not found or is not a directory.")
         return JSONResponse(content=[], status_code=200)
    try:
        for item in RESOURCES_DIR.iterdir():
            if item.is_file():
                try:
                    file_size = item.stat().st_size
                    doc_id = item.name
                    documents.append(ExistingDocument(
                        id=doc_id,
                        name=item.name,
                        size=file_size
                    ))
                except OSError as e:
                    gemini.logger.error(f"Error accessing file '{item}': {e}")
    except Exception as e:
        gemini.logger.error(f"Error retrieving documentation list: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve documentation list.")

    return documents



async def delete_document(document_id: str):
    if not document_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document ID cannot be empty.")

    if "/" in document_id or "\\" in document_id or ".." in document_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID format.")
    file_path = RESOURCES_DIR / document_id
    if not RESOURCES_DIR.is_dir():
        gemini.logger.error(f"Resources directory '{RESOURCES_DIR}' not found or is not a directory.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server configuration error: Resource directory not found.")

    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document '{document_id}' not found.")

    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"'{document_id}' is not a file.")
    try:
        file_path.unlink()
        await build_index()
        gemini.logger.info(f"Document '{document_id}' deleted successfully.")
    except OSError as e:
        gemini.logger.error(f"Error deleting file '{file_path}': {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not delete document '{document_id}'.")
    except Exception as e:
        gemini.logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")