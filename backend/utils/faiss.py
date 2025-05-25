import aiofiles
import glob
import os
import json
import asyncio
from typing import List, Any, Optional, Tuple
from aiomultiprocess import Pool
from contextlib import asynccontextmanager
import config.tars as gemini
from Model.MessageBody import MessageRequest
from utils.invoke_retry import invoke_with_retry
from utils.search import brave_search, extract_all_articles
from utils.local_save import save_resource
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from utils.updates import set_update
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from ai.model_switcher import refine_search_local_chain, cleaned_search_result_chain, reference_check_chain, link_chain
import threading
import time
import hashlib
from fastapi import BackgroundTasks

# Configuration constants
INDEX_STORE_PATH = "index_store/"
RESOURCES_FOLDER = "resources"
MIN_QUERY_LENGTH = 3
MAX_QUERY_LENGTH = 500
DOCUMENT_PATTERNS = (
    "*.txt", "*.md", "*.html", "*.csv", "*.py", "*.js", "*.ts",
    "*.java", "*.cpp", "*.c", "*.cs", "*.go", "*.rs", "*.json",
    "*.yaml", "*.yml", "*.toml", "*.conf", "*.sh", "*.rb"
)

CHUNK_SIZES = {
    50000: (8000, 1600), 
    30000: (6000, 1200),
    20000: (5000, 800),   
    10000: (4000, 500), 
    0: (2500, 400)        
}


SCORING_WEIGHTS = {
    "semantic": 0.60,
    "keyword": 0.20,
    "structure": 0.12,
    "quality": 0.08
}


class LRUCache:
    def __init__(self, capacity: int = 100, ttl: int = 3600):
        self.cache = {}
        self.capacity = capacity
        self.ttl = ttl
        self.lock = threading.Lock()
        
    def get(self, key: str) -> Any:
        with self.lock:
            if key not in self.cache:
                return None
            value, timestamp = self.cache[key]
            if time.time() - timestamp > self.ttl:
                del self.cache[key]
                return None
            self.cache[key] = (value, time.time())
            return value
            
    def put(self, key: str, value: Any) -> None:
        with self.lock:
            if len(self.cache) >= self.capacity and key not in self.cache:
                oldest_key = min(self.cache.items(), key=lambda x: x[1][1])[0]
                del self.cache[oldest_key]
            self.cache[key] = (value, time.time())

query_cache = LRUCache(capacity=200, ttl=7200)  

class VectorDBManager:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(VectorDBManager, cls).__new__(cls)
                cls._instance.db = None
                cls._instance.last_loaded = 0
                cls._instance.index_metadata = {}
                cls._instance.reload_interval = 3600 
            return cls._instance
    
    def get_db(self, force_reload=False):
        current_time = time.time()
        if (not self.db or 
            force_reload or 
            current_time - self.last_loaded > self.reload_interval):
            try:
                self.db = FAISS.load_local(
                    INDEX_STORE_PATH, 
                    gemini.embedding_model, 
                    allow_dangerous_deserialization=True
                )
                self.last_loaded = current_time
                # Load metadata
                meta_path = os.path.join(INDEX_STORE_PATH, "metadata.json")
                if os.path.exists(meta_path):
                    with open(meta_path, 'r') as f:
                        self.index_metadata = json.load(f)
            except Exception as e:
                gemini.logger.error(f"Failed to load vector store: {e}")
                return None
        return self.db
    
    def save_metadata(self):
        try:
            meta_path = os.path.join(INDEX_STORE_PATH, "metadata.json")
            with open(meta_path, 'w') as f:
                json.dump(self.index_metadata, f)
        except Exception as e:
            gemini.logger.error(f"Failed to save index metadata: {e}")

vector_db_manager = VectorDBManager()

@asynccontextmanager
async def log_execution_time(operation_name: str):
    start_time = time.time()
    try:
        yield
    finally:
        elapsed = time.time() - start_time
        gemini.logger.info(f"{operation_name} completed in {elapsed:.2f} seconds")

async def compute_semantic_scores(pairs: List[Tuple[str, str]]) -> np.ndarray:
    if not pairs:
        return np.array([])
        
    queries = [q for q, d in pairs]
    docs = [d for q, d in pairs]
    all_texts = queries + docs
    
    vectorizer = TfidfVectorizer(
        max_features=10000,
        min_df=2,
        max_df=0.85,
        ngram_range=(1, 2),
        sublinear_tf=True
    )
    
    try:
        vectors = vectorizer.fit_transform(all_texts)
        query_vectors = vectors[:len(queries)]
        doc_vectors = vectors[len(queries):]
        semantic_scores_matrix = cosine_similarity(query_vectors, doc_vectors)
        return np.diag(semantic_scores_matrix)
    except Exception as e:
        gemini.logger.error(f"Error computing semantic scores: {e}")
        return np.array([0.5] * len(pairs))

async def load_documents_from_folder(folder_path: str, file_types: tuple = DOCUMENT_PATTERNS) -> list[Document]:
    docs: list[Document] = []
    encodings = ["utf-8", "latin-1", "cp1252", "iso-8859-1"]
    
    for pattern in file_types:
        file_paths = glob.glob(os.path.join(folder_path, pattern))
        for path in file_paths:
            content = None
            
            for encoding in encodings:
                try:
                    async with aiofiles.open(path, "r", encoding=encoding) as f:
                        content = await f.read()
                        if content.strip():
                            break
                except Exception:
                    continue
            
            if content is None and any(path.endswith(ext) for ext in ['.pdf', '.docx', '.xlsx']):
                try:
                    gemini.logger.info(f"Binary file detected: {path}")
                    continue 
                except Exception as e:
                    gemini.logger.error(f"Failed to read binary file {path}: {e}")
                    continue
            
            if content and content.strip():
                file_hash = hashlib.md5(content.encode()).hexdigest()
                docs.append(Document(
                    page_content=content,
                    metadata={
                        "source": path,
                        "file_hash": file_hash,
                        "last_indexed": time.time(),
                        "file_size": len(content)
                    }
                ))
            else:
                gemini.logger.warning(f"Empty or unreadable file: {path}")
                
    gemini.logger.info(f"Loaded {len(docs)} documents from {folder_path}")
    return docs

async def _split_document(doc: Document) -> list[Document]:
    text_len = len(doc.page_content)
    source = doc.metadata.get('source', '')
    file_ext = os.path.splitext(source)[1][1:] if '.' in source else ''

    is_code = file_ext in ['py', 'js', 'ts', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'rb']
    
    chunk_size, chunk_overlap = next(
        (size, overlap) for threshold, (size, overlap) in sorted(
            CHUNK_SIZES.items(), reverse=True
        ) if text_len > threshold
    )

    if is_code:
        chunk_size = int(chunk_size * 0.8) 
        chunk_overlap = int(chunk_overlap * 1.5)  
    
    separators = ["\n\n", "\n", " ", ""]
    if is_code:
        separators = [
            "\n\nclass ", "\n\ndef ", "\nfunction ", 
            "\n\n// ", "\n/**", "\nimport ", 
            "\n\n", "\n", " ", ""
        ]
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=separators
    )
    
    chunks = splitter.split_documents([doc])

    for i, chunk in enumerate(chunks):
        chunk.metadata.update(doc.metadata)
        chunk.metadata["chunk_id"] = i
        chunk.metadata["total_chunks"] = len(chunks)
    
    return chunks

def get_vectorstore(force_reload=False) -> Optional[FAISS]:
    return vector_db_manager.get_db(force_reload)

async def build_index(background_tasks: Optional[BackgroundTasks] = None) -> str:
    async def _build_index_task():
        gemini.logger.info("Building vector index...")
        set_update("Starting document indexing process...")
        
        try:
            os.makedirs(INDEX_STORE_PATH, exist_ok=True)
            docs = await load_documents_from_folder(RESOURCES_FOLDER)
            if not docs:
                set_update("No documents found to index.")
                return "No documents to index."
            
            set_update(f"Processing {len(docs)} documents...")
            
            async with Pool() as pool:
                chunks_lists = await pool.map(_split_document, docs)
            
            chunks = [chunk for sublist in chunks_lists for chunk in sublist]
            gemini.logger.info(f"Created {len(chunks)} chunks from {len(docs)} documents")
            set_update(f"Created {len(chunks)} chunks for indexing...")
            
            code_chunks = [c for c in chunks if any(
                c.metadata.get('source', '').endswith(ext) 
                for ext in ['.py', '.js', '.java', '.cpp', '.ts', '.go', '.rs']
            )]
            text_chunks = [c for c in chunks if c not in code_chunks]
            
            gemini.logger.info(f"Split into {len(code_chunks)} code chunks and {len(text_chunks)} text chunks")
            
            index_strategies = [
                ("FAISS IVF", lambda docs: FAISS.from_documents(docs, gemini.embedding_model), 
                 lambda idx: setattr(idx.index, "nprobe", 64)),
                ("FAISS HNSW", lambda docs: FAISS.from_documents(docs, gemini.embedding_model), 
                 lambda idx: getattr(idx.index, "hnsw", None) and setattr(idx.index.hnsw, "efSearch", 512)),
                ("FAISS Flat", lambda docs: FAISS.from_documents(docs, gemini.embedding_model), 
                 lambda _: None)
            ]
            
            for name, create_fn, optimize_fn in index_strategies:
                try:
                    gemini.logger.info(f"Attempting to create {name} index...")
                    set_update(f"Creating {name} index...")
                    gemini.resource_vectorstore = create_fn(chunks)
                    optimize_fn(gemini.resource_vectorstore)
                    gemini.logger.info(f"Successfully created {name} index")
                    break
                except Exception as e:
                    gemini.logger.error(f"Failed to create {name} index: {e}")
            
            if gemini.resource_vectorstore is None:
                set_update("Failed to build index with any strategy.")
                return "Failed to build index with any strategy."
            
            try:
                gemini.resource_vectorstore.save_local(INDEX_STORE_PATH)
                index_metadata = {
                    "created_at": time.time(),
                    "document_count": len(docs),
                    "chunk_count": len(chunks),
                    "code_chunk_count": len(code_chunks),
                    "text_chunk_count": len(text_chunks),
                    "indexed_files": [d.metadata.get('source') for d in docs]
                }
                
                vector_db_manager.index_metadata = index_metadata
                vector_db_manager.save_metadata()
                
                gemini.logger.info(f"Index saved to {INDEX_STORE_PATH}")
                set_update("Indexing completed successfully.")
                return f"Index built successfully with {len(chunks)} chunks"
            except Exception as e:
                gemini.logger.error(f"Failed to save index: {e}")
                set_update("Index built but could not be saved to disk.")
                return "Index built but could not be saved to disk."
        except Exception as e:
            gemini.logger.error(f"Indexing failed: {e}")
            set_update(f"Indexing failed: {str(e)}")
            return f"Indexing failed: {str(e)}"
    
    if background_tasks:
        background_tasks.add_task(_build_index_task)
        return "Indexing started in background. Check logs for progress."
    else:
        return await _build_index_task()



async def web_search(query: str, msg: MessageRequest) -> dict:
    cache_key = f"web_{hashlib.md5(query.encode()).hexdigest()}"
    cached_result = query_cache.get(cache_key)
    if cached_result:
        gemini.logger.info(f"Using cached web search result for: {query[:50]}...")
        return cached_result
    
    try:
        async with log_execution_time("Web search"):
            links = await brave_search(query, count=15) 
            
        if not links:
            raise ValueError("No results from Brave Search")
        
        set_update("Analyzing search results for relevant information...")
        
        chain_inputs = {
            "query": query, 
            "links": str(links), 
            **msg.dict(exclude={"chatId"})
        }
        
        chain_inputs["search_context"] = {
            "search_depth": "comprehensive",
            "prioritize_technical": True,
            "prioritize_recent": True
        }
        
        async with log_execution_time("Link analysis"):
            output = await invoke_with_retry(
                link_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
                chain_inputs
            )

        links = str(output.documentation) + str(output.example)
        print(links)
        
        web_results = extract_all_articles(output)
        
        async with log_execution_time("Result cleaning"):
            processed_results = await invoke_with_retry(
                cleaned_search_result_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
                {"query": query, "answer": str(web_results)}
            )
        
        web_results = processed_results.content.strip()
        
        if not web_results:
            raise ValueError("No content extracted from search results")
            
        success = await save_resource(str(web_results), RESOURCES_FOLDER)
        await build_index()
        if not success:
            gemini.logger.warning("Failed to save web resources")
        
        query_cache.put(cache_key, web_results)
        
        return {
            "doc_urls": links,
            "resources": web_results
        }
    
    except Exception as e:
        gemini.logger.error(f"Web search error: {str(e)}", exc_info=True)
        raise ValueError(f"Web search failed: {str(e)}")

async def extract_relevant_section(doc: Document, query: str, max_length: int = 5000) -> str:
    if len(doc.page_content) <= max_length:
        return doc.page_content
    
    try:
        source = doc.metadata.get('source', '').lower()
        if any(source.endswith(ext) for ext in ['.py', '.js', '.java', '.cpp', '.ts', '.go', '.rs']):
            extract_prompt = (
                f"Extract ONLY the most relevant code section from this document that answers: '{query}'\n\n"
                f"CODE:\n{doc.page_content[:max_length]}\n\n"
                f"Include complete function definitions or class methods. "
                f"Focus on code that directly relates to '{query}'."
            )
            
            try:
                relevant_section = await asyncio.to_thread(
                    gemini.gemini_fast.invoke,
                    extract_prompt
                )
                if len(relevant_section) > 100:
                    return relevant_section[:max_length]
            except Exception:
                gemini.logger.warning("AI extraction failed, falling back to heuristic approach")

            content = doc.page_content[:max_length]
            query_terms = set(term.lower() for term in query.split() if len(term) > 3)

            best_section = content
            best_score = 0
            
            for boundary in ["\n\nclass ", "\n\ndef ", "\nfunction ", "\n\n// "]:
                sections = content.split(boundary)
                if len(sections) > 1:
                    for i, section in enumerate(sections[1:], 1):
                        section_text = boundary + section

                        if len(section_text) > max_length:
                            section_text = section_text[:max_length]

                        section_lower = section_text.lower()
                        term_count = sum(section_lower.count(term) for term in query_terms)
                        score = term_count / (len(section_text) ** 0.5)
                        
                        if score > best_score:
                            best_score = score
                            best_section = section_text
            
            return best_section
        else:
            content = doc.page_content[:max_length * 2]  
            paragraphs = content.split("\n\n")
            
            query_terms = set(term.lower() for term in query.split() if len(term) > 3)
            scored_paragraphs = []
            
            for para in paragraphs:
                if not para.strip():
                    continue
                    
                para_lower = para.lower()
                term_count = sum(para_lower.count(term) for term in query_terms)
                score = term_count / (len(para) ** 0.5) 
                scored_paragraphs.append((para, score))
            
            scored_paragraphs.sort(key=lambda x: -x[1])
            result = ""
            for para, _ in scored_paragraphs:
                if len(result + "\n\n" + para) <= max_length:
                    result += "\n\n" + para if result else para
                else:
                    break
                    
            return result
    except Exception as e:
        gemini.logger.error(f"Error extracting relevant section: {e}")
        return doc.page_content[:max_length] 

async def compute_document_scores(
    query: str, 
    refined_docs: List[Document], 
    keywords: List[str] = None
) -> List[Tuple[Document, float, float]]:
    if not refined_docs:
        return []
    
        
    if keywords is None:
        keywords = [term for term in query.lower().split() if len(term) > 3]
    

    pairs = [(query, doc.page_content) for doc in refined_docs]
    semantic_scores = await compute_semantic_scores(pairs)
    
 
    keyword_scores = []
    for doc in refined_docs:
        content = doc.page_content.lower()
        source = doc.metadata.get('source', '').lower()
        score = 0
        matched_keywords = set()
        
        for keyword in keywords:
            keyword = keyword.lower()
            occurrences = content.count(keyword)
            if occurrences > 0:
                matched_keywords.add(keyword)
                pos = content.find(keyword)
                pos_weight = 1 - (pos / len(content)) if len(content) > 0 else 0
                freq_weight = min(1.0, occurrences / 5)
                score += 0.6 + (0.2 * pos_weight) + (0.2 * freq_weight)
        
        coverage_ratio = len(matched_keywords) / len(keywords) if keywords else 0
        score *= (1.0 + coverage_ratio)
        keyword_scores.append(score)
    
    structure_scores = []
    for doc in refined_docs:
        source = doc.metadata.get('source', '').lower()
        content = doc.page_content
        domain_match = doc.metadata.get('domain_match', False)
        
        if any(source.endswith(ext) for ext in ['.py', '.js', '.java', '.cpp', '.ts', '.go', '.rs']):
            has_function_def = any(pattern in content for pattern in 
                                  ['def ', 'function ', 'class ', 'async def', 'fn ', 'func '])
            has_return = 'return ' in content
            has_comments = any(pattern in content for pattern in ['#', '//', '/*', '"""', "'''"])
            has_imports = any(pattern in content for pattern in 
                             ['import ', 'from ', 'require(', 'include ', 'using '])
            brackets_balanced = (
                content.count('{') == content.count('}') and 
                content.count('(') == content.count(')') and
                content.count('[') == content.count(']')
            )
            
            size_score = 0
            content_len = len(content)
            if 200 <= content_len <= 3000:
                size_score = 0.2
            elif 3000 < content_len <= 5000:
                size_score = 0.1
            
            structure_score = (
                (0.3 if has_function_def else 0) + 
                (0.2 if has_return else 0) + 
                (0.15 if brackets_balanced else 0) + 
                (0.1 if has_comments else 0) +
                (0.1 if has_imports else 0) +
                size_score
            )
            
            if domain_match:
                structure_score *= 1.2
        else:
            structure_score = 0.3
            
        structure_scores.append(structure_score)
    
 
    quality_scores = []
    for doc in refined_docs:
        content = doc.page_content.lower()
        source = doc.metadata.get('source', '').lower()
        quality_score = 0.5  
        
        if any(source.endswith(ext) for ext in ['.py', '.js', '.java', '.cpp', '.ts', '.go', '.rs']):
            has_error_handling = any(pattern in content for pattern in 
                                    ['try', 'catch', 'except', 'finally', 'raise ', 'throw ', 'error'])
            has_docstrings = any(pattern in content for pattern in ['"""', "'''", '/**', '///', '//!'])
            has_typing = any(pattern in content for pattern in [': ', '-> ', '<', 'type ', 'interface '])
            has_methods = content.count('def ') > 1 or content.count('function ') > 1
            has_testing = any(pattern in content for pattern in 
                             ['test', 'assert', 'expect', 'should', 'describe', 'it('])
            
            quality_score = (
                0.5 + 
                (0.15 if has_error_handling else 0) +
                (0.1 if has_docstrings else 0) +
                (0.1 if has_typing else 0) +
                (0.1 if has_methods else 0) +
                (0.05 if has_testing else 0)
            )
        
        quality_scores.append(quality_score)
    
    final_scores = []
    for i in range(len(refined_docs)):
        combined_score = (
            (semantic_scores[i] * SCORING_WEIGHTS["semantic"]) +
            (keyword_scores[i] * SCORING_WEIGHTS["keyword"]) +
            (structure_scores[i] * SCORING_WEIGHTS["structure"]) +
            (quality_scores[i] * SCORING_WEIGHTS["quality"])
        )
        final_scores.append(combined_score)

    return list(zip(refined_docs, final_scores, semantic_scores))


async def local_search(query: str, k: int = 3, min_relevance_threshold: float = 20.0) -> str:
    cache_key = f"local_{hashlib.md5(query.encode()).hexdigest()}"
    cached_result = query_cache.get(cache_key)
    if cached_result:
        return cached_result
    
    if gemini.resource_vectorstore is None:
        gemini.resource_vectorstore = get_vectorstore()
        if gemini.resource_vectorstore is None:
            raise ValueError("Vector store not available. Please reindex resources first.")
    
    try:
        async with log_execution_time("Query analysis"):
            query_analysis = await invoke_with_retry(
                refine_search_local_chain(model_type=gemini.modelType, provider_type=gemini.providerName),
                {"query": query}
            )
            

            
            try:
                
                expanded_query = query_analysis.expanded_query
                keywords = query_analysis.keywords
                domain = query_analysis.domain

            except Exception as e:

                gemini.logger.warning(f"Query analysis parsing failed: {e}")
                expanded_query = query
                keywords = [term for term in query.lower().split() if len(term) > 3]
                domain = ""
        
        async with log_execution_time("Vector search"):
            try:
                search_results = gemini.resource_vectorstore.similarity_search_with_score(
                    expanded_query, 
                    k=max(k * 3, 10)  
                )
            except Exception as e:
                gemini.logger.error(f"Vector search error: {e}")
                search_results = gemini.resource_vectorstore.similarity_search_with_score(
                    query,  
                    k=max(k * 3, 10)
                )
        
        if not search_results:
            return f"No relevant resources found for '{query}'."
        

        refined_docs = []
        for doc, score in search_results:
            doc.metadata['domain_match'] = domain and domain in doc.metadata.get('source', '').lower()
            refined_docs.append(doc)
        

        async with log_execution_time("Document scoring"):
            scored_docs = await compute_document_scores(query, refined_docs, keywords)
            
            scored_docs.sort(key=lambda x: -x[1])
        
        if not scored_docs:
            return f"No relevant resources found for '{query}'."
        
        relevant_docs = []
        for doc, combined_score, semantic_score in scored_docs[:k]:

            if combined_score < min_relevance_threshold and len(relevant_docs) > 0:
                continue
                
            try:
                relevant_section = await extract_relevant_section(doc, query)
                relevant_docs.append({
                    "content": relevant_section,
                    "source": doc.metadata.get("source", "Unknown"),
                    "score": float(combined_score),
                    "semantic_score": float(semantic_score)
                })
            except Exception as e:
                gemini.logger.error(f"Error extracting relevant section: {e}")
        
        if not relevant_docs:
            return f"No sufficiently relevant resources found for '{query}'."
        
        result = f"### Results for: {query}\n\n"
        for i, doc in enumerate(relevant_docs, 1):
            source = os.path.basename(doc["source"])
            result += f"**Source {i}: {source}** (Relevance: {doc['score']:.2f})\n\n"
            result += f"{doc['content']}\n\n"
            result += "---\n\n"
        

        query_cache.put(cache_key, result)
        
        return result
        
    except Exception as e:
        gemini.logger.error(f"Local search error: {str(e)}", exc_info=True)
        raise ValueError(f"Local search failed: {str(e)}")

async def search_resources_web(query: str, msg: MessageRequest, k: int = 3) -> str:
    if not query or len(query.strip()) < MIN_QUERY_LENGTH:
        return "Query is too short. Please provide a more detailed question."
        
    if len(query) > MAX_QUERY_LENGTH:
        query = query[:MAX_QUERY_LENGTH]

    
    set_update("Searching web resources...")
    
    try:

        web_result = str(await web_search(query, msg))
        set_update("Web search completed successfully.")
        return web_result
    except ValueError as e:
        gemini.logger.warning(f"Web search failed: {e}")
        set_update("Web search failed. Falling back to local search...")
        
        try:
            local_result = await local_search(query, k, min_relevance_threshold=-5.0)
            set_update("Local search completed.")
            return local_result
        except Exception as local_err:
            gemini.logger.error(f"Local search fallback failed: {local_err}")
            set_update("All search methods failed.")
            return f"Web search error: {e}. Local search also failed."

async def search_resources_local(query: str, k: int = 3) -> str:
    if not query or len(query.strip()) < MIN_QUERY_LENGTH:
        return "Query is too short. Please provide a more detailed question."
        
    if len(query) > MAX_QUERY_LENGTH:
        query = query[:MAX_QUERY_LENGTH]

    
    try:

        set_update("Searching local resources...")
  
        result = await local_search(query, k, min_relevance_threshold=-5.0)

        if not result or "No relevant resources found" in result:
            set_update("No relevant local resources found.")
            return None
        
        set_update("Verifying relevance of search results...")
        
        try:
            relevance = await invoke_with_retry(
                reference_check_chain(
                    model_type=gemini.modelType, 
                    provider_type=gemini.providerName
                ), 
                {"query": query, "result": result}
            )
            
            relevance_status = relevance.content.strip().lower()

            
            if relevance_status == "incorrect":
                set_update("Search results deemed not relevant.")
                return None
            elif relevance_status == "correct" or relevance_status == "partially correct":
                set_update("Relevant local resources found.")
                return result
            else:

                gemini.logger.warning(f"Ambiguous relevance check: {relevance_status}")
                return result
                
        except Exception as e:
            gemini.logger.error(f"Relevance check error: {e}")
            return result
            
    except Exception as e:
        gemini.logger.error(f"Search error: {str(e)}", exc_info=True)
        set_update(f"Search error: {str(e)}")
        return f"An error occurred during search: {str(e)}"