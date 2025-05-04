import random
import string
import hashlib
import codecs
from pathlib import Path
from Prompts.prompts import convert_to_markdown_chain
from utils.invoke_retry import invoke_with_retry
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
from PIL import Image
import pytesseract
import io
import base64
from fastapi import HTTPException, status
import json
import re
import config.tars as gemini

def generate_random_filename(extension: str = ".txt", length: int = 10) -> str:
  return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length)) + extension

def get_content_hash(content: str) -> str:
  return hashlib.sha256(content.encode('utf-8')).hexdigest()

async def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    try:
        if ext == ".pdf":
            reader = PdfReader(io.BytesIO(file_bytes))
            return "\n".join([page.extract_text() or "" for page in reader.pages])
        elif ext == ".docx":
            doc = DocxDocument(io.BytesIO(file_bytes))
            return "\n".join([para.text for para in doc.paragraphs])
        elif ext in [".png", ".jpg", ".jpeg", ".bmp"]:
            image = Image.open(io.BytesIO(file_bytes))
            return pytesseract.image_to_string(image)
        else:
            return file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text from file: {e}")

async def save_resource(content: str, folder_name: str, filename: str = "raw.txt", is_base64: bool = False) -> dict:
    try:
        if len(content) > 20000:
            content = content[:20000]
        if is_base64:
            try:
                file_bytes = base64.b64decode(content)
                extracted_text = await extract_text_from_file(file_bytes, filename)
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Base64 decode or extract failed: {e}")
        else:
            try:
                extracted_text = codecs.decode(content, "unicode_escape").replace("\r\n", "\n").replace("\r", "\n")
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Text decode failed: {e}")
        if not extracted_text.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Extracted content is empty.")
        indented_content = "\n".join(f"  {line.rstrip()}" for line in extracted_text.split("\n"))
        content_hash = get_content_hash(indented_content)
        resource_folder = Path(folder_name)
        resource_folder.mkdir(parents=True, exist_ok=True)
        for existing_file in resource_folder.glob("*.txt"):
            if get_content_hash(existing_file.read_text(encoding="utf-8")) == content_hash:
                return {"message": "Similar content already exists, not adding it again."}
        markdown_output = await invoke_with_retry(convert_to_markdown_chain, {"documentation": indented_content})
        raw_md = markdown_output.content
        json_str = raw_md.replace("```json", "").replace("```", "").strip()
        try:
            json_output = json.loads(json_str)
        except json.JSONDecodeError:
            gemini.logger.error("Failed to parse JSON from markdown output. Using alternative method.")
            json_output = {
                "title": generate_random_filename(),
                "content": indented_content,
                "hash": content_hash,
            }
    
        name = json_output.get("title", generate_random_filename())
        name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", name) 
        file_path = resource_folder / f"{name}.md"
        file_path.write_text(str(json_output), encoding="utf-8")
        return {"message": f"Resource '{name}' saved successfully."}
    except Exception as e:
        gemini.logger.error(f"Error in save_resource: {e}")
        raise HTTPException(status_code=500, detail=str(e))