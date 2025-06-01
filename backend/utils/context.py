import ast
import os
import shutil
import tempfile
import zipfile
import asyncio
import concurrent.futures
from pathlib import Path
from functools import lru_cache
from typing import Union, List, Optional
from fastapi import Request, UploadFile, File, HTTPException, BackgroundTasks
from langchain_community.document_loaders import TextLoader, CSVLoader, PyPDFLoader, UnstructuredMarkdownLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
import re
import json
import hashlib
import config.tars as gemini
from git import Repo, GitCommandError
from urllib.parse import quote, urlparse
from datetime import datetime

CODESPACE_DIR = Path("codespace")
FAISS_INDEX_PATH = Path("code_index")
METADATA_PATH = Path("code_metadata")
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_WORKERS = 8

EXCLUDED_FILES = {".env", "yarn.lock", "pnpm-lock.yaml", "package-lock.json", 
                  ".git", "node_modules", "__pycache__", ".pytest_cache", ".venv"}
EXCLUDED_SUFFIXES = {".lock", ".log", ".pyc", ".class", ".jar", ".png", ".jpg", 
                     ".jpeg", ".gif", ".svg", ".ico", ".woff", ".ttf", ".eot"}

FILENAME_TO_PATH_MAP = {}
LOWERCASE_FILENAME_TO_PATH_MAP = {}
FILE_CONTENT_CACHE = {}
INDEX_METADATA = {"last_updated": None, "file_count": 0, "chunk_count": 0}
FILE_HASHES = {}  

FILE_LOADERS = {
    ".py": None,
    ".md": UnstructuredMarkdownLoader,
    ".csv": CSVLoader,
    ".pdf": PyPDFLoader,
}

executor = concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS)


@lru_cache(maxsize=1024)
def get_file_hash(filepath: str) -> str:
    try:
        with open(filepath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception as e:
        gemini.logger.warning(f"Failed to hash file {filepath}: {e}")
        return ""


def save_metadata():
    try:
        metadata = {
            "index_metadata": INDEX_METADATA,
            "file_hashes": FILE_HASHES
        }
        os.makedirs(METADATA_PATH, exist_ok=True)
        with open(METADATA_PATH / "metadata.json", 'w') as f:
            json.dump(metadata, f)
        gemini.logger.info(f"Saved metadata to {METADATA_PATH}")
    except Exception as e:
        gemini.logger.error(f"Failed to save metadata: {e}")


def load_metadata():
    global INDEX_METADATA, FILE_HASHES
    try:
        if (METADATA_PATH / "metadata.json").exists():
            with open(METADATA_PATH / "metadata.json", 'r') as f:
                data = json.load(f)
                INDEX_METADATA = data.get("index_metadata", INDEX_METADATA)
                FILE_HASHES = data.get("file_hashes", FILE_HASHES)
            gemini.logger.info(f"Loaded metadata from {METADATA_PATH}")
    except Exception as e:
        gemini.logger.error(f"Failed to load metadata: {e}")


def build_filename_map():
    global FILENAME_TO_PATH_MAP, LOWERCASE_FILENAME_TO_PATH_MAP
    FILENAME_TO_PATH_MAP = {}
    LOWERCASE_FILENAME_TO_PATH_MAP = {}

    if not CODESPACE_DIR.exists():
        gemini.logger.info("Codespace directory does not exist. Cannot build filename map.")
        return

    gemini.logger.info(f"Building filename map from {CODESPACE_DIR}")
    
    for path in CODESPACE_DIR.rglob("*"):
        if path.is_file() and not any(excluded in str(path) for excluded in EXCLUDED_FILES):
            filename = path.name
            if any(filename.endswith(suffix) for suffix in EXCLUDED_SUFFIXES):
                continue
                
            full_path = str(path)
            lowercase_filename = filename.lower()

            FILENAME_TO_PATH_MAP[filename] = full_path
            
            if lowercase_filename in LOWERCASE_FILENAME_TO_PATH_MAP:
                existing_path = LOWERCASE_FILENAME_TO_PATH_MAP[lowercase_filename]
                if len(full_path.split(os.sep)) < len(existing_path.split(os.sep)):
                    LOWERCASE_FILENAME_TO_PATH_MAP[lowercase_filename] = full_path
            else:
                LOWERCASE_FILENAME_TO_PATH_MAP[lowercase_filename] = full_path

    gemini.logger.info(f"Built filename map with {len(FILENAME_TO_PATH_MAP)} entries (original case).")
    gemini.logger.info(f"Built lowercase filename map with {len(LOWERCASE_FILENAME_TO_PATH_MAP)} entries.")


@lru_cache(maxsize=1024)
def find_file_in_codespace(filename: Union[str, Path]) -> Optional[str]:
    """Find a file in the codespace with caching for performance."""
    filename_str = str(filename).lower()
    
    if filename_str in LOWERCASE_FILENAME_TO_PATH_MAP:
        return LOWERCASE_FILENAME_TO_PATH_MAP[filename_str]
    
    for name, path in LOWERCASE_FILENAME_TO_PATH_MAP.items():
        if filename_str in name:
            return path
            
    for path in FILENAME_TO_PATH_MAP.values():
        if filename_str in path.lower():
            return path
            
    return None


def extract_potential_filenames_from_query(query: str) -> List[str]:
    """Extract potential filenames from a query with enhanced context awareness."""
    if not CODESPACE_DIR.exists() or not FILENAME_TO_PATH_MAP:
        return []

    gemini.logger.info(f"Extracting filenames from query: '{query}'")
    resolved_paths = set()
    query_lower = query.lower()
    
    for full_path in sorted(FILENAME_TO_PATH_MAP.values(), key=len, reverse=True):
        escaped_path = re.escape(full_path)
        path_pattern = r"(?:^|\W)" + escaped_path + r"(?:$|\W)"
        if re.search(path_pattern, query):
            resolved_paths.add(full_path)

    for filename_lower, full_path in LOWERCASE_FILENAME_TO_PATH_MAP.items():
        if filename_lower in query_lower:
            resolved_paths.add(full_path)
            
    patterns = [
        r'(?:in|from|import|require|include)\s+[\'"]?([a-zA-Z0-9_\-\.\/]+)[\'"]?',
        r'(?:class|function|def|module)\s+([a-zA-Z0-9_\-\.]+)',
        r'(?:open|read|write|load)\s*\(?[\'"]([a-zA-Z0-9_\-\.\/]+)[\'"]'
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, query)
        for match in matches:
            if match:
                path = find_file_in_codespace(match)
                if path:
                    resolved_paths.add(path)

    gemini.logger.info(f"Resolved {len(resolved_paths)} paths from query")
    return list(resolved_paths)


def parse_python_code(file_path: Path) -> List[Document]:
    documents = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        full_doc = Document(
            page_content=content, 
            metadata={
                "source": str(file_path), 
                "type": "file",
                "language": "python"
            }
        )
        documents.append(full_doc)
        
        tree = ast.parse(content)
        lines = content.splitlines()
        
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                start_line = node.lineno - 1
                end_line = getattr(node, 'end_lineno', start_line + 1)
                import_content = "\n".join(lines[start_line:end_line])
                imports.append(import_content)
        
        imports_text = "\n".join(imports)
        
        for node in ast.walk(tree):
            metadata = {
                "source": str(file_path),
                "type": "unknown",
                "language": "python"
            }

            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                start_line = node.lineno - 1
                end_line = node.end_lineno
                
                docstring = ast.get_docstring(node)
                
                decorators = []
                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Name):
                        decorators.append(f"@{decorator.id}")
                    elif isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name):
                        decorators.append(f"@{decorator.func.id}")
                
                doc_content = imports_text + "\n\n" + "\n".join(lines[start_line:end_line])
                
                metadata.update({
                    "type": "function",
                    "name": node.name,
                    "lineno": node.lineno,
                    "end_lineno": node.end_lineno,
                    "is_async": isinstance(node, ast.AsyncFunctionDef),
                    "decorators": decorators,
                    "docstring": docstring if docstring else None
                })

            elif isinstance(node, ast.ClassDef):
                start_line = node.lineno - 1
                end_line = node.end_lineno
                
                docstring = ast.get_docstring(node)
                
                bases = []
                for base in node.bases:
                    if isinstance(base, ast.Name):
                        bases.append(base.id)
                
                doc_content = imports_text + "\n\n" + "\n".join(lines[start_line:end_line])
                
                metadata.update({
                    "type": "class",
                    "name": node.name,
                    "lineno": node.lineno,
                    "end_lineno": node.end_lineno,
                    "bases": bases,
                    "docstring": docstring if docstring else None
                })
                
            else:
                continue
                
            documents.append(Document(page_content=doc_content, metadata=metadata))

    except Exception as e:
        gemini.logger.warning(f"Failed to parse Python file {file_path} using AST: {e}", exc_info=True)
        try:
            loader = TextLoader(str(file_path))
            docs = loader.load()
            for doc in docs:
                if 'source' not in doc.metadata:
                    doc.metadata['source'] = str(file_path)
                if 'type' not in doc.metadata:
                    doc.metadata['type'] = 'text_chunk'
                if 'language' not in doc.metadata:
                    doc.metadata['language'] = 'python'
            documents.extend(docs)
        except Exception as load_err:
            gemini.logger.warning(f"Failed to load Python file {file_path} as text: {load_err}")

    return documents


async def process_file(file_path: Path, text_splitter: RecursiveCharacterTextSplitter) -> List[Document]:
    """Process a single file with the appropriate loader."""
    documents = []
    try:
        file_hash = get_file_hash(str(file_path))
        if str(file_path) in FILE_HASHES and FILE_HASHES[str(file_path)] == file_hash:
            gemini.logger.info(f"File {file_path} unchanged, skipping processing")
            return []
            
        FILE_HASHES[str(file_path)] = file_hash
        
        if file_path.suffix == ".py":
            loop = asyncio.get_event_loop()
            parsed_docs = await loop.run_in_executor(executor, parse_python_code, file_path)
            documents.extend(parsed_docs)
            gemini.logger.info(f"Parsed {file_path} into {len(parsed_docs)} structured documents")
            
        elif file_path.suffix in FILE_LOADERS and FILE_LOADERS[file_path.suffix] is not None:
            loader_cls = FILE_LOADERS[file_path.suffix]
            loader = loader_cls(str(file_path))
            docs = await asyncio.get_event_loop().run_in_executor(executor, loader.load)
            for doc in docs:
                if 'source' not in doc.metadata:
                    doc.metadata['source'] = str(file_path)
                if 'type' not in doc.metadata:
                    doc.metadata['type'] = 'text_chunk'
                if 'language' not in doc.metadata:
                    doc.metadata['language'] = file_path.suffix[1:]
            documents.extend(docs)
            gemini.logger.info(f"Loaded {file_path} with specialized loader")
            
        else:
            loader = TextLoader(str(file_path))
            docs = await asyncio.get_event_loop().run_in_executor(executor, loader.load)
            for doc in docs:
                if 'source' not in doc.metadata:
                    doc.metadata['source'] = str(file_path)
                if 'type' not in doc.metadata:
                    doc.metadata['type'] = 'text_chunk'
                if 'language' not in doc.metadata:
                    doc.metadata['language'] = 'text'
            documents.extend(docs)
            gemini.logger.info(f"Loaded {file_path} as text")

    except Exception as e:
        gemini.logger.warning(f"Failed to process {file_path}: {e}")
        
    return documents


async def build_index(background_task: bool = False):
    """Build the search index with enhanced performance and reliability."""
    try:
        gemini.logger.info("Starting index build process")
        if not CODESPACE_DIR.exists():
            gemini.logger.info("Codespace directory does not exist. Skipping index build.")
            return
            
        load_metadata()

        if not FAISS_INDEX_PATH.exists():
            FAISS_INDEX_PATH.mkdir(parents=True, exist_ok=True)

        build_filename_map()
        if not FILENAME_TO_PATH_MAP:
            gemini.logger.warning("No files found in codespace")
            return

        valid_files = []
        for path in CODESPACE_DIR.rglob("*"):
            if path.is_file() and path.name not in EXCLUDED_FILES and \
               not any(path.name.endswith(suffix) for suffix in EXCLUDED_SUFFIXES) and \
               not any(excluded in str(path) for excluded in EXCLUDED_FILES):
                valid_files.append(path)
                
        gemini.logger.info(f"Found {len(valid_files)} valid files for indexing")
        INDEX_METADATA["file_count"] = len(valid_files)

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE, 
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", " ", ""]
        )

        documents = []
        tasks = []
        for file in valid_files:
            tasks.append(process_file(file, text_splitter))
            
        results = await asyncio.gather(*tasks)
        for result in results:
            documents.extend(result)

        gemini.logger.info(f"Processed {len(documents)} documents")

        if not documents:
            gemini.logger.warning("No documents loaded. Skipping indexing.")
            return

        docs_to_split = [doc for doc in documents if doc.metadata.get('type') in ['file', 'text_chunk']]
        already_chunked_docs = [doc for doc in documents if doc.metadata.get('type') in ['function', 'class']]

        gemini.logger.info(f"Splitting {len(docs_to_split)} documents")
        chunked_docs = await asyncio.get_event_loop().run_in_executor(
            executor, text_splitter.split_documents, docs_to_split
        )
         
        all_indexed_docs = already_chunked_docs + chunked_docs
        
        INDEX_METADATA["chunk_count"] = len(all_indexed_docs)
        INDEX_METADATA["last_updated"] = datetime.now().isoformat()
        
        gemini.logger.info(f"Final document count for indexing: {len(all_indexed_docs)} chunks")

        if not hasattr(gemini, 'embedding_model') or gemini.embedding_model is None:
            gemini.logger.error("Embedding model not initialized")
            raise RuntimeError("Embedding model not initialized")

        embeddings = gemini.embedding_model
        gemini.logger.info("Creating FAISS index")
        
        batch_size = 500
        for i in range(0, len(all_indexed_docs), batch_size):
            batch = all_indexed_docs[i:i+batch_size]
            gemini.logger.info(f"Processing batch {i//batch_size + 1}/{(len(all_indexed_docs)-1)//batch_size + 1}")
            
            if i == 0:
                db = FAISS.from_documents(batch, embeddings)
            else:
                db.add_documents(batch)
                
        gemini.logger.info(f"Saving FAISS index to {FAISS_INDEX_PATH}")
        db.save_local(FAISS_INDEX_PATH)
        
        save_metadata()
        
        gemini.logger.info("Index build completed successfully")
        return True

    except Exception as e:
        gemini.logger.error(f"Error building index: {e}", exc_info=True)
        raise e


async def upload_project(request: Request, file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    try:
        gemini.logger.info("Received project upload request")
        
        if CODESPACE_DIR.exists():
            gemini.logger.info(f"Removing existing codespace at {CODESPACE_DIR}")
            shutil.rmtree(CODESPACE_DIR)
            
        CODESPACE_DIR.mkdir(exist_ok=True)
        gemini.logger.info(f"Created codespace directory at {CODESPACE_DIR}")
        
        temp_dir = Path(tempfile.gettempdir())
        temp_zip_path = temp_dir / f"uploaded_project_{os.getpid()}_{os.urandom(4).hex()}.zip"

        gemini.logger.info(f"Saving uploaded file to {temp_zip_path}")
        
        try:
            with open(temp_zip_path, "wb") as temp_file:
                while content := await file.read(1024 * 1024): 
                    temp_file.write(content)
            gemini.logger.info("File saved successfully")
        except Exception as write_error:
            gemini.logger.error(f"Error saving temporary zip file: {write_error}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(write_error)}")

        gemini.logger.info(f"Extracting zip file to {CODESPACE_DIR}")
        try:
            if not zipfile.is_zipfile(temp_zip_path):
                gemini.logger.error("Uploaded file is not a valid zip file")
                raise zipfile.BadZipFile("File is not a zip file")

            with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                for file_info in zip_ref.infolist():
                    if '..' in file_info.filename or file_info.filename.startswith('/'):
                        gemini.logger.error(f"Security alert: Invalid path '{file_info.filename}'")
                        raise ValueError("Zip file contains invalid paths")
                        
                    if file_info.file_size > (100 * 1024 * 1024):  # 100MB
                        gemini.logger.error(f"Security alert: File too large '{file_info.filename}'")
                        raise ValueError("Zip file contains suspiciously large files")
                
                zip_ref.extractall(CODESPACE_DIR)
                
            gemini.logger.info("Zip file extracted successfully")
        except zipfile.BadZipFile:
            gemini.logger.error("Invalid zip file")
            raise HTTPException(status_code=400, detail="Uploaded file is not a valid zip file")
        except ValueError as val_error:
            gemini.logger.error(f"Zip extraction security error: {val_error}")
            raise HTTPException(status_code=400, detail=f"Zip file validation failed: {str(val_error)}")
        except Exception as extract_error:
            gemini.logger.error(f"Error extracting zip file: {extract_error}")
            cleanup_codespace()
            raise HTTPException(status_code=500, detail=f"Failed to extract zip file: {str(extract_error)}")
        finally:
            if temp_zip_path.exists():
                try:
                    os.unlink(temp_zip_path)
                except OSError as cleanup_err:
                    gemini.logger.warning(f"Failed to remove temporary zip file: {cleanup_err}")

        if background_tasks:
            gemini.logger.info("Triggering background index build")
            background_tasks.add_task(build_index, True)
            return {"message": "Project uploaded successfully. Indexing in progress..."}
        else:
            gemini.logger.info("Triggering immediate index build")
            await build_index()
            return {"message": "Project uploaded and indexed successfully"}
            
    except HTTPException as http_exc:
        gemini.logger.error(f"HTTP Exception: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        gemini.logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upload project: {str(e)}")


def cleanup_codespace():
    """Clean up codespace directory after errors."""
    try:
        if CODESPACE_DIR.exists():
            shutil.rmtree(CODESPACE_DIR)
            gemini.logger.info("Cleaned up codespace directory")
    except Exception as e:
        gemini.logger.error(f"Failed to clean up codespace: {e}")


async def clear_project(request: Request):
    """Clear the project and all associated data."""
    try:
        gemini.logger.info("Received clear project request")
        
        for path in [CODESPACE_DIR, FAISS_INDEX_PATH, METADATA_PATH]:
            if path.exists():
                gemini.logger.info(f"Removing {path}")
                shutil.rmtree(path)
                
        global FILENAME_TO_PATH_MAP, LOWERCASE_FILENAME_TO_PATH_MAP, FILE_CONTENT_CACHE, FILE_HASHES
        FILENAME_TO_PATH_MAP = {}
        LOWERCASE_FILENAME_TO_PATH_MAP = {}
        FILE_CONTENT_CACHE = {}
        FILE_HASHES = {}
        
        global INDEX_METADATA
        INDEX_METADATA = {"last_updated": None, "file_count": 0, "chunk_count": 0}
        
        find_file_in_codespace.cache_clear()
        get_file_hash.cache_clear()
        
        gemini.logger.info("Project cleared successfully")
        return {"message": "Project cleared successfully"}
    except Exception as e:
        gemini.logger.error(f"Error clearing project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear project: {str(e)}")


async def get_project_status(request: Request):
    try:
        gemini.logger.info("Received project status request")
        has_project_files = CODESPACE_DIR.exists() and any(p for p in CODESPACE_DIR.iterdir() if not p.name.startswith('.'))
        has_index = FAISS_INDEX_PATH.exists() and any(p for p in FAISS_INDEX_PATH.iterdir() if p.suffix in {'.faiss', '.pkl'})
        file_count = len(FILENAME_TO_PATH_MAP) if has_project_files else 0
        if has_index and not INDEX_METADATA["last_updated"]:
            load_metadata()
            
        gemini.logger.info(f"Project status: has_files={has_project_files}, has_index={has_index}, file_count={file_count}")
        
        return {
            "has_project": has_project_files,
            "has_index": has_index,
            "file_count": file_count,
            "index_metadata": INDEX_METADATA
        }
    except Exception as e:
        gemini.logger.error(f"Error getting project status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project status: {str(e)}")


async def query_index(query: str, k: int = 5, rerank: bool = True):
    if not query or not query.strip():
        gemini.logger.warning("Empty query string")
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    if CODESPACE_DIR.exists() and not LOWERCASE_FILENAME_TO_PATH_MAP:
        gemini.logger.info("Building filename maps")
        build_filename_map()

    if not FAISS_INDEX_PATH.exists():
        gemini.logger.error(f"FAISS index not found at {FAISS_INDEX_PATH}")
        raise HTTPException(status_code=404, detail="FAISS index not found. Please upload and index a project first")

    try:
        if not hasattr(gemini, 'embedding_model') or gemini.embedding_model is None:
            gemini.logger.error("Embedding model not initialized")
            raise RuntimeError("Embedding model not initialized")

        embeddings = gemini.embedding_model
        gemini.logger.info(f"Loading FAISS index from {FAISS_INDEX_PATH}")
        
        try:
            db = FAISS.load_local(FAISS_INDEX_PATH, embeddings, allow_dangerous_deserialization=True)
            gemini.logger.info("FAISS index loaded successfully")
        except Exception as load_err:
            gemini.logger.error(f"Failed to load FAISS index: {load_err}")
            if FAISS_INDEX_PATH.exists():
                try:
                    shutil.rmtree(FAISS_INDEX_PATH)
                    gemini.logger.info("Cleaned up corrupted index")
                except Exception as cleanup_err:
                    gemini.logger.error(f"Error cleaning up index: {cleanup_err}")
            raise HTTPException(status_code=500, detail=f"Failed to load FAISS index: {str(load_err)}")

        # Extract potential file paths from the query
        file_paths_to_filter = extract_potential_filenames_from_query(query)
        
        # Look for pinned files in the query (in format "pinnedFile:[path]")
        pinned_file_pattern = r"pinnedFile:\s*([^\s]+)"
        pinned_file_matches = re.findall(pinned_file_pattern, query)
        
        if pinned_file_matches:
            gemini.logger.info(f"Found pinned file references in query: {pinned_file_matches}")
            for pinned_path in pinned_file_matches:
                # Check if this is a full path or just a filename
                if "/" in pinned_path or "\\" in pinned_path:
                    # Try to resolve the full path within the codespace
                    full_path = CODESPACE_DIR / Path(pinned_path)
                    if full_path.exists():
                        file_paths_to_filter.append(str(full_path))
                    else:
                        # Try to handle repo-based paths
                        for root_dir in CODESPACE_DIR.iterdir():
                            if root_dir.is_dir():
                                potential_path = root_dir / pinned_path
                                if potential_path.exists():
                                    file_paths_to_filter.append(str(potential_path))
                                    break
                else:
                    # Just a filename, try to find it in the codespace
                    found_path = find_file_in_codespace(pinned_path)
                    if found_path:
                        file_paths_to_filter.append(found_path)

        file_filter = None
        if file_paths_to_filter:
            # Convert all paths to strings and normalize them
            string_paths_to_filter = []
            for p in file_paths_to_filter:
                if isinstance(p, Path):
                    string_paths_to_filter.append(str(p))
                else:
                    string_paths_to_filter.append(str(p))
                    
                # Also add the relative path (from codespace dir) as a filter option
                try:
                    path_obj = Path(p)
                    if path_obj.is_absolute() and path_obj.exists():
                        rel_path = path_obj.relative_to(CODESPACE_DIR)
                        string_paths_to_filter.append(str(rel_path))
                except (ValueError, TypeError):
                    pass  # Not a valid path or not within codespace
            
            # Remove duplicates
            string_paths_to_filter = list(set(string_paths_to_filter))
            file_filter = {"source": {"$in": string_paths_to_filter}}
            gemini.logger.info(f"Applying filter for {len(string_paths_to_filter)} paths: {string_paths_to_filter}")
        else:
            gemini.logger.info("Searching without filter")

        if file_filter:
            search_k = k * 3 if rerank else k
            results = db.similarity_search(query, k=search_k, filter=file_filter)
            gemini.logger.info(f"Filtered search returned {len(results)} results")
        else:
            search_k = k * 3 if rerank else k
            results = db.similarity_search(query, k=search_k)
            gemini.logger.info(f"Unfiltered search returned {len(results)} results")

        if rerank and results:
            def get_rank_score(doc):
                if doc.metadata.get('type') == 'function':
                    return 100
                elif doc.metadata.get('type') == 'class':
                    return 90
                elif doc.metadata.get('type') == 'file':
                    return 80
                else:
                    return 0
            results = sorted(results, key=lambda x: get_rank_score(x), reverse=True)
            gemini.logger.info(f"Reranked results: {len(results)}")

        return [
            {
                "filename": result.metadata.get('source'),
                "content": result.page_content,
                "metadata": result.metadata
            }
            for result in results
        ]
    except Exception as e:
        gemini.logger.error(f"Error querying index: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to query index: {str(e)}")
    
async def reindex_project():
    try:
        gemini.logger.info("Starting project reindexing")
        
        if not CODESPACE_DIR.exists():
            gemini.logger.error("Codespace directory does not exist")
            raise HTTPException(status_code=404, detail="No project found to reindex. Please upload a project first.")
            
        if not any(p for p in CODESPACE_DIR.iterdir() if not p.name.startswith('.')):
            gemini.logger.error("No files found in codespace")
            raise HTTPException(status_code=404, detail="No files found in project to reindex")

        if FAISS_INDEX_PATH.exists():
            gemini.logger.info("Removing existing FAISS index for re-indexing")
            shutil.rmtree(FAISS_INDEX_PATH)
            
        if METADATA_PATH.exists():
            gemini.logger.info("Clearing existing metadata")
            shutil.rmtree(METADATA_PATH)
            
        global FILE_HASHES, INDEX_METADATA
        FILE_HASHES = {}
        INDEX_METADATA = {"last_updated": None, "file_count": 0, "chunk_count": 0}
        
        build_filename_map()
        
        gemini.logger.info("Building new index")
        await build_index()
        
        gemini.logger.info("Project reindexing completed successfully")
        return {
            "message": "Project reindexed successfully",
            "file_count": INDEX_METADATA["file_count"],
            "chunk_count": INDEX_METADATA["chunk_count"],
            "last_updated": INDEX_METADATA["last_updated"]
        }
        
    except HTTPException as http_exc:
        gemini.logger.error(f"HTTP error during reindexing: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        gemini.logger.error(f"Error in reindex_project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to reindex project: {str(e)}")
    
async def index_status():
    if FAISS_INDEX_PATH.exists():
        return {"status": "indexed"}
    else:
        return {"status": "not indexed"}
    
PROJECT_ROOT = Path(__file__).resolve().parent.parent 

def get_project_files_and_folders(path=None, recursive=True):
    """
    Get files and folders in the project directory, with proper support for nested folders.
    Folders are listed first, followed by files, both sorted alphabetically.
    
    Args:
        path: Optional path relative to CODESPACE_DIR to list contents of a specific directory
        recursive: Whether to traverse directories recursively
    
    Returns:
        List of dictionaries representing files and folders with their metadata
    """
    base_dir = CODESPACE_DIR
    if path:
        # Handle both absolute and relative paths
        if isinstance(path, str) and path.startswith('/'):
            # Convert absolute path to a path relative to CODESPACE_DIR
            try:
                abs_path = Path(path)
                if abs_path.is_absolute():
                    rel_path = abs_path.relative_to(CODESPACE_DIR)
                    path = str(rel_path)
            except ValueError:
                # Path is not relative to CODESPACE_DIR
                gemini.logger.warning(f"Path not within codespace: {path}")
                return []
        
        target_dir = base_dir / path
        if not target_dir.exists() or not target_dir.is_dir():
            gemini.logger.warning(f"Directory not found: {path}")
            return []
        base_dir = target_dir
    
    gemini.logger.info(f"Retrieving files from {base_dir} with recursive={recursive}")

    exclude_dirs = {'.git', 'node_modules', '__pycache__', '.venv', 'env', '.next'}
    
    exclude_extensions = {'.pyc', '.pyo', '.pyd', '.class', '.so', '.dll', '.exe', '.o', '.a', '.lib'}
    
    if not recursive:
        folders = []
        files = []
        
        try:
            for file in base_dir.iterdir():
                if file.name.startswith('.') or (file.is_dir() and file.name in exclude_dirs):
                    continue
                    
                if file.is_file() and file.suffix in exclude_extensions:
                    continue
                    
                if file.is_dir():
                    has_children = False
                    try:
                        for child in file.iterdir():
                            if not child.name.startswith('.'):
                                has_children = True
                                break
                    except (PermissionError, OSError) as e:
                        gemini.logger.warning(f"Error checking directory {file}: {e}")
                        
                    folders.append({
                        "name": file.name,
                        "path": str(file.relative_to(CODESPACE_DIR)),
                        "type": "directory",
                        "children": [],
                        "hasChildren": has_children
                    })
                else:
                    files.append({
                        "name": file.name,
                        "path": str(file.relative_to(CODESPACE_DIR)),
                        "type": "file"
                    })
        except (PermissionError, OSError) as e:
            gemini.logger.error(f"Error accessing directory {base_dir}: {e}")
        
        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())
        
        return folders + files
    
    def process_directory(dir_path):
        folders = []
        files = []
        
        try:
            for file in dir_path.iterdir():
                if file.name.startswith('.') or (file.is_dir() and file.name in exclude_dirs):
                    continue
                    
                if file.is_file() and file.suffix in exclude_extensions:
                    continue
                    
                if file.is_dir():
                    try:
                        children = process_directory(file)
                        folder_item = {
                            "name": file.name,
                            "path": str(file.relative_to(CODESPACE_DIR)),
                            "type": "directory",
                            "children": children,
                            "hasChildren": len(children) > 0
                        }
                        folders.append(folder_item)
                    except (PermissionError, OSError) as e:
                        gemini.logger.warning(f"Error processing directory {file}: {e}")
                else:
                    file_item = {
                        "name": file.name,
                        "path": str(file.relative_to(CODESPACE_DIR)),
                        "type": "file"
                    }
                    files.append(file_item)
        except (PermissionError, OSError) as e:
            gemini.logger.error(f"Error accessing directory {dir_path}: {e}")

        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())
        return folders + files
    
    try:
        return process_directory(base_dir)
    except Exception as e:
        gemini.logger.error(f"Error in get_project_files_and_folders: {e}")
        return []

def get_content_of_file(file_path: str):
    try:
        gemini.logger.info(f"Getting content for file: {file_path}")
        

        if isinstance(file_path, Path):
            file_path = str(file_path)
            

        full_path = CODESPACE_DIR / file_path
        if full_path.exists() and full_path.is_file():
            gemini.logger.info(f"Reading file at: {full_path}")
            with open(full_path, "r", encoding="utf-8") as f:
                return f.read()
        if not file_path.startswith('/'):
            for root_dir in CODESPACE_DIR.iterdir():
                if root_dir.is_dir():
                    potential_path = root_dir / file_path
                    if potential_path.exists() and potential_path.is_file():
                        gemini.logger.info(f"Found file in repo dir: {potential_path}")
                        with open(potential_path, "r", encoding="utf-8") as f:
                            return f.read()
            
            if "/" in file_path:
                path_parts = file_path.split("/", 1)
                if len(path_parts) == 2:
                    repo_name_prefix = path_parts[0]
                    file_path_within_repo = path_parts[1]
                    
                    # Look for directories that start with the repo name prefix
                    for root_dir in CODESPACE_DIR.iterdir():
                        if root_dir.is_dir() and root_dir.name.startswith(repo_name_prefix):
                            potential_path = root_dir / file_path_within_repo
                            if potential_path.exists() and potential_path.is_file():
                                gemini.logger.info(f"Found file in repo dir with prefix match: {potential_path}")
                                with open(potential_path, "r", encoding="utf-8") as f:
                                    return f.read()
        
        # Case 3: Try to find the file by name only (last resort)
        filename = Path(file_path).name
        found_path = find_file_in_codespace(filename)
        if found_path:
            gemini.logger.info(f"Found file by name lookup: {found_path}")
            with open(found_path, "r", encoding="utf-8") as f:
                return f.read()
        
        gemini.logger.warning(f"File not found after all resolution attempts: {file_path}")
        return {"success": False, "error": f"File '{file_path}' not found in codespace."}
    except Exception as e:
        gemini.logger.error(f"Error reading file '{file_path}': {e}")
        return {"success": False, "error": f"Error reading file: {str(e)}"}


async def extract_owner_repo(repo_input: str) -> str:
    repo_input = repo_input.strip()
    if repo_input.startswith("http://") or repo_input.startswith("https://"):
        parsed = urlparse(repo_input)
        if "github.com" not in parsed.netloc:
            raise ValueError("Invalid GitHub URL.")
        parts = parsed.path.strip("/").split("/")
        if len(parts) < 2:
            raise ValueError("GitHub URL must be in the format https://github.com/owner/repo")
        return f"{parts[0]}/{parts[1].replace('.git', '')}"
    
    if "/" not in repo_input:
        raise ValueError("Invalid repository format. Use 'owner/repo' or GitHub URL.")
    
    return repo_input.replace(".git", "")

async def clone_personal_github_repo(repo_input: str, dest: Path = CODESPACE_DIR, use_token: bool = True) -> dict:
    try:
        repo_full_name = await extract_owner_repo(repo_input)
    except ValueError as ve:
        return {"success": False, "error": str(ve)}

    repo_name = repo_full_name.split("/")[-1]
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    repo_dir = os.path.join(dest, f"{repo_name}_{timestamp}")

    if os.path.exists(CODESPACE_DIR):
        shutil.rmtree(CODESPACE_DIR)

    clone_url = f"https://github.com/{repo_full_name}.git"

    if not use_token:
        try:
            Repo.clone_from(clone_url, repo_dir)
            await build_index()

            return {"success": True, "repo_dir": repo_dir}
        except GitCommandError as e:
            if "Authentication" in str(e):
                return {"success": False, "error": "Authentication failed. Try with a token."}
            if "Repository not found" in str(e):
                return {"success": False, "error": "Repository not found. Check repo name or permissions."}
            return {"success": False, "error": f"Public clone failed: {e}"}

    token = os.environ.get("GITHUB_API_KEY")
    if not token:
        return {"success": False, "error": "GitHub token not found in environment variables."}

    token_encoded = quote(token)
    token_clone_url = f"https://{token_encoded}:x-oauth-basic@github.com/{repo_full_name}.git"

    try:
        Repo.clone_from(token_clone_url, repo_dir)
        await build_index()
        return {"success": True, "repo_dir": repo_dir}
    except GitCommandError as e:
        if "Authentication" in str(e):
            return {"success": False, "error": "Authentication failed. Invalid GitHub token?"}
        if "Repository not found" in str(e):
            return {"success": False, "error": "Repository not found or access denied."}
        return {"success": False, "error": f"Clone failed: {e}"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}
    

async def read_file_content(filename: str):
    filename_str = filename.split("/")[-1]
    
    gemini.logger.info(f"Attempting to read file: {filename}")
    file_path = find_file_in_codespace(filename_str)
    
    if not file_path:
        gemini.logger.warning(f"File '{filename}' not found in codespace map.")
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found in codespace.")

    try:
        full_path = Path(file_path)
        if not full_path.is_file():
            gemini.logger.error(f"Resolved path {file_path} is not a file.")
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found or is not a file.")

        if not full_path.is_relative_to(CODESPACE_DIR):
            gemini.logger.error(f"Security alert: Resolved path {file_path} is outside codespace directory {CODESPACE_DIR}.")
            raise HTTPException(status_code=400, detail="Invalid file path.")

        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        gemini.logger.info(f"Successfully read file: {file_path}")
        return {"filename": file_path, "content": content}
    except FileNotFoundError:
        gemini.logger.error(f"File not found at resolved path: {file_path}")
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found.")
    except Exception as e:
        gemini.logger.error(f"Failed to read file '{file_path}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to read file '{filename}': {str(e)}")
    

async def upload_folder(request: Request, uploaded_files: List[UploadFile], folder_structure: str, background_tasks: BackgroundTasks = None):
    try:
        gemini.logger.info("Received folder upload request")
        
        if CODESPACE_DIR.exists():
            gemini.logger.info(f"Removing existing codespace at {CODESPACE_DIR}")
            shutil.rmtree(CODESPACE_DIR)
            
        CODESPACE_DIR.mkdir(exist_ok=True)
        gemini.logger.info(f"Created codespace directory at {CODESPACE_DIR}")
        
        folder_data = json.loads(folder_structure)
        gemini.logger.info(f"Parsed folder structure with {len(folder_data)} files")
        
        file_map = {}
        for i, file in enumerate(uploaded_files):
            file_map[i] = file
            gemini.logger.info(f"Mapped file {i}: {file.filename}")
        
        for i, file_info in enumerate(folder_data):
            if i >= len(file_map):
                gemini.logger.warning(f"No uploaded file found for index {i}")
                continue
                
            file_obj = file_map[i]
            relative_path = file_info.get("path", "")
            
            gemini.logger.info(f"Processing file {i}: {relative_path}")
            
            target_dir = CODESPACE_DIR / os.path.dirname(relative_path)
            target_dir.mkdir(parents=True, exist_ok=True)
            
            target_path = CODESPACE_DIR / relative_path
            try:
                contents = await file_obj.read()
                with open(target_path, "wb") as f:
                    f.write(contents)
                gemini.logger.info(f"Saved file to {target_path}")
                
                await file_obj.seek(0)
            except Exception as e:
                gemini.logger.error(f"Error saving file {relative_path}: {e}")
                
        if background_tasks:
            gemini.logger.info("Triggering background index build")
            background_tasks.add_task(build_index, True)
            return {"message": "Folder uploaded successfully. Indexing in progress..."}
        else:
            gemini.logger.info("Triggering immediate index build")
            await build_index()
            return {"message": "Folder uploaded and indexed successfully"}
            
    except json.JSONDecodeError as json_err:
        gemini.logger.error(f"Invalid folder structure JSON: {json_err}")
        raise HTTPException(status_code=400, detail=f"Invalid folder structure format: {str(json_err)}")
    except HTTPException as http_exc:
        gemini.logger.error(f"HTTP Exception: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        gemini.logger.error(f"Unexpected error in folder upload: {e}", exc_info=True)
        cleanup_codespace()
        raise HTTPException(status_code=500, detail=f"Failed to upload folder: {str(e)}")

