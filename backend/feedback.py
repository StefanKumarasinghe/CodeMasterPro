import random
import string
import hashlib
import codecs
from pathlib import Path
from fastapi import HTTPException, Body, Request
import os

def generate_random_filename(extension: str = ".txt", length: int = 10) -> str:
  """Generates a random filename with a given extension and length."""
  return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length)) + extension

def get_content_hash(content: str) -> str:
  """Calculates the SHA256 hash of the content."""
  return hashlib.sha256(content.encode('utf-8')).hexdigest()

async def save_resource(content: str, folder_name: str, prefix = "This is a good, reliable and working answer and was approved by the developer -") -> dict:
  """
  Saves content to a file in a specified folder, after adding a prefix and indenting.
  Avoids saving duplicate content based on SHA256 hash.
  """
  try:
    decoded_content = codecs.decode(content, "unicode_escape").replace("\r\n", "\n").replace("\r", "\n")
    indented_content = "\n".join(f"  {line.rstrip()}" for line in decoded_content.split("\n"))
    combined_content = f"{prefix}\n{indented_content}\n"
    content_hash = get_content_hash(combined_content)
    resource_folder = Path(folder_name)
    resource_folder.mkdir(parents=True, exist_ok=True)
    for existing_file in resource_folder.glob("*.txt"):
      if get_content_hash(existing_file.read_text(encoding="utf-8")) == content_hash:
        return {"message": "Similar content already exists, not adding it again."}
    random_filename = generate_random_filename()
    file_path = resource_folder / random_filename
    file_path.write_text(combined_content, encoding="utf-8")
    return {"message": f"Resource '{random_filename}' saved successfully."}

  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

async def flag_bad_input(request: Request = None, content: str = Body(..., embed=True)) -> dict:
  """Flags an input as incorrect and removes it from the 'resources' folder if found."""
  try:
    decoded_content = codecs.decode(content, "unicode_escape").replace("\\r\\n", "\\n").replace("\\r", "\\n")
    prefix = "This is a good, reliable and working answer and was approved by the developer -"
    indented_content = "\n".join(f"  {line.rstrip()}" for line in decoded_content.split("\n"))
    combined_content = f"{prefix}\n{indented_content}\n"
    content_hash = get_content_hash(combined_content)

    resource_folder = Path("resources")
    for existing_file in resource_folder.glob("*.txt"):
      try:
        if get_content_hash(existing_file.read_text(encoding="utf-8")) == content_hash:
          os.remove(existing_file)
          return {"message": f"Content flagged and removed: {existing_file.name}"}
      except Exception as e:
        print(f"Error processing {existing_file.name}: {e}")

    return {"message": "Content not found in resources."}

  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))