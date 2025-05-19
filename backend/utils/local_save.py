import random
import string
import hashlib
import codecs
from pathlib import Path
from typing import Dict, Optional
from concurrent.futures import ThreadPoolExecutor
import io
import base64
from functools import lru_cache
from fastapi import HTTPException, status
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
from PIL import Image
import pytesseract
from ai.model_switcher import convert_to_markdown_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini

MAX_CONTENT_LENGTH = 20000
VALID_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp"}

def generate_random_filename(extension: str = ".txt", length: int = 10) -> str:
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length)) + extension

@lru_cache(maxsize=128)
def get_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

async def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join([page.extract_text() or "" for page in reader.pages])

async def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = DocxDocument(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs])

async def extract_text_from_image(file_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(file_bytes))
    return pytesseract.image_to_string(image)

async def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    
    extractors = {
        ".pdf": extract_text_from_pdf,
        ".docx": extract_text_from_docx,
        **{img_ext: extract_text_from_image for img_ext in VALID_IMAGE_EXTENSIONS}
    }
    
    try:
        if ext in extractors:
            return await extractors[ext](file_bytes)
        return file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Failed to extract text from file: {str(e)}"
        )

async def check_existing_content(resource_folder: Path, content_hash: str) -> Optional[Dict]:
    with ThreadPoolExecutor() as executor:
        existing_files = list(resource_folder.glob("*.txt")) + list(resource_folder.glob("*.md"))
        
        def check_file(file_path):
            file_hash = get_content_hash(file_path.read_text(encoding="utf-8"))
            return file_path if file_hash == content_hash else None
        
        for result in executor.map(check_file, existing_files):
            if result:
                return {"message": "Similar content already exists, not adding it again."}
    
    return None

async def process_content(content: str, is_base64: bool, filename: str) -> str:
    if is_base64:
        try:
            file_bytes = base64.b64decode(content)
            return await extract_text_from_file(file_bytes, filename)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Base64 decode or extract failed: {str(e)}"
            )
    
    try:
        return codecs.decode(content, "unicode_escape").replace("\r\n", "\n").replace("\r", "\n")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Text decode failed: {str(e)}"
        )


async def save_resource(
    content: str, 
    folder_name: str, 
    filename: str = "raw.txt", 
    is_base64: bool = False
) -> Dict[str, str]:
    try:
        if len(content) > MAX_CONTENT_LENGTH:
            content = content[:MAX_CONTENT_LENGTH]
        
        extracted_text = await process_content(content, is_base64, filename)
        
        if not extracted_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Extracted content is empty."
            )
        
        content_hash = get_content_hash(extracted_text)

        resource_folder = Path(folder_name)
        resource_folder.mkdir(parents=True, exist_ok=True)
        
        existing = await check_existing_content(resource_folder, content_hash)
        if existing:
            return existing
        
        markdown_output = await invoke_with_retry(
                convert_to_markdown_chain(
                    model_type=gemini.modelType, 
                    provider_type=gemini.providerName
                ), 
                {"documentation": extracted_text}
            )
        
        name = markdown_output.title
        content = markdown_output.content
        
        file_path = resource_folder / f"{name}.md"
        file_path.write_text(content, encoding="utf-8")
        
        return {"message": f"Resource '{name}' saved successfully."}

    except Exception as e:
        gemini.logger.error(f"Error in save_resource: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=str(e)
        )