import aiofiles
import glob
import os
import json
import asyncio
import functools
from typing import List, Dict, Any, Optional
from aiomultiprocess import Pool
from contextlib import suppress
import config.tars as gemini
from Model.MessageBody import MessageRequest
from utils.invoke_retry import invoke_with_retry
from utils.search import brave_search, extract_all_articles
from Prompts.prompts import link_chain
from utils.local_save import save_resource
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from utils.cache import cached_search
from Prompts.prompts import refine_search_local_chain, cleaned_search_result_chain

INDEX_STORE_PATH = "index_store/"
RESOURCES_FOLDER = "resources"
MIN_QUERY_LENGTH = 3
MAX_QUERY_LENGTH = 5000
DOCUMENT_PATTERNS = (
    "*.txt", "*.md", "*.html", "*.csv", "*.py", "*.js", "*.ts",
    "*.java", "*.cpp", "*.c", "*.cs", "*.go", "*.rs"
)

CHUNK_SIZES = {
    30000: (6000, 1200),  
    20000: (5000, 800),   
    10000: (4000, 500),  
    0: (2500, 400)        
}

async def load_documents_from_folder(folder_path: str, file_types: tuple = DOCUMENT_PATTERNS) -> list[Document]:
    docs: list[Document] = []
    for pattern in file_types:
        file_paths = glob.glob(os.path.join(folder_path, pattern))
        for path in file_paths:
            try:
                async with aiofiles.open(path, "r", encoding="utf-8") as f:
                    content = await f.read()
                    if content.strip(): 
                        docs.append(Document(page_content=content, metadata={"source": path}))
            except UnicodeDecodeError:
                try:
                    async with aiofiles.open(path, "r", encoding="latin-1") as f:
                        content = await f.read()
                        if content.strip():
                            docs.append(Document(page_content=content, metadata={"source": path}))
                except Exception as e:
                    gemini.logger.error(f"Failed to read {path} with latin-1 encoding: {e}")
            except Exception as e:
                gemini.logger.error(f"Error reading file {path}: {e}")
    gemini.logger.info(f"Loaded {len(docs)} documents from {folder_path}")
    return docs

async def _split_document(doc: Document) -> list[Document]:
    text_len = len(doc.page_content)
    chunk_size, chunk_overlap = next(
        (size, overlap) for threshold, (size, overlap) in sorted(
            CHUNK_SIZES.items(), reverse=True
        ) if text_len > threshold
    )
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, 
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    return splitter.split_documents([doc])

@functools.lru_cache(maxsize=1)
def get_vectorstore() -> Optional[FAISS]:
    try:
        return FAISS.load_local(
            INDEX_STORE_PATH, 
            gemini.embedding_model, 
            allow_dangerous_deserialization=True
        )
    except Exception as e:
        gemini.logger.error(f"Failed to load vector store: {e}")
        return None


async def build_index() -> str:
    gemini.logger.info("Building vector index...")
    docs = await load_documents_from_folder(RESOURCES_FOLDER)
    if not docs:
        return "No documents to index."
    async with Pool() as pool:
        chunks_lists = await pool.map(_split_document, docs)
    chunks = [chunk for sublist in chunks_lists for chunk in sublist]
    gemini.logger.info(f"Created {len(chunks)} chunks from {len(docs)} documents")
    index_strategies = [
        ("FAISS IVF", lambda: FAISS.from_documents(chunks, gemini.embedding_model), 
         lambda idx: setattr(idx.index, "nprobe", 64)),
        ("FAISS HNSW", lambda: FAISS.from_documents(chunks, gemini.embedding_model), 
         lambda idx: setattr(idx.index.hnsw, "efSearch", 512)),
        ("FAISS Flat", lambda: FAISS.from_documents(chunks, gemini.embedding_model), 
         lambda _: None)
    ]
    for name, create_fn, optimize_fn in index_strategies:
        try:
            gemini.logger.info(f"Attempting to create {name} index...")
            gemini.resource_vectorstore = create_fn()
            optimize_fn(gemini.resource_vectorstore)
            gemini.logger.info(f"Successfully created {name} index")
            break
        except Exception as e:
            gemini.logger.error(f"Failed to create {name} index: {e}")
    if gemini.resource_vectorstore is None:
        return "Failed to build index with any strategy."
    try:
        gemini.resource_vectorstore.save_local(INDEX_STORE_PATH)
        gemini.logger.info(f"Index saved to {INDEX_STORE_PATH}")
        return f"Index built successfully with {len(chunks)} chunks"
    except Exception as e:
        gemini.logger.error(f"Failed to save index: {e}")
        return "Index built but could not be saved to disk."


async def parse_json_response(response: str) -> dict:
    text = response.strip()
    for prefix in ["```json", "```"]:
        if text.startswith(prefix):
            text = text[len(prefix):].strip()
    
    for suffix in ["```"]:
        if text.endswith(suffix):
            text = text[:-len(suffix)].strip()
    try:
        return json.loads(json.dumps(json.loads(text)))
    except json.JSONDecodeError as e:
        gemini.logger.error(f"JSON parsing error: {e}, Response: {text[:100]}...")
        raise ValueError(f"Invalid JSON response: {e}")


async def web_search(query: str, msg: MessageRequest) -> List[Dict[str, Any]]:
    if len(query.strip()) > MAX_QUERY_LENGTH:
        gemini.logger.warning(f"Query exceeds maximum length of {MAX_QUERY_LENGTH} characters")
        raise ValueError(f"Query too long (max {MAX_QUERY_LENGTH} characters)") 
    gemini.logger.info(f"Searching Brave for: {query[:50]}{'...' if len(query) > 50 else ''}")
    links = await brave_search(query, count=5)
    if not links:
        raise ValueError("No results from Brave Search")
    chain_inputs = {"query": query, "links": str(links), **msg.dict(exclude={"chatId"})}
    json_result = await invoke_with_retry(link_chain, chain_inputs)
    parsed_result = await parse_json_response(json_result["text"])
    web_results = extract_all_articles(parsed_result)
    web_results = await invoke_with_retry(cleaned_search_result_chain, {"query": query, "answer": str(web_results)})
    if not web_results:
        raise ValueError("No content extracted from search results")   
    success = await save_resource(str(web_results), RESOURCES_FOLDER)
    if not success:
        gemini.logger.warning("Failed to save web resources")  
    return web_results

async def local_search(query: str, k: int = 2, min_relevance_threshold: float = 20.0) -> str:
    if gemini.resource_vectorstore is None:
        gemini.resource_vectorstore = get_vectorstore()
        if gemini.resource_vectorstore is None:
            raise ValueError("Vector store not available. Please reindex resources first.")
    try:
        query_analysis = await invoke_with_retry(refine_search_local_chain,{"query": query})
        query_data = json.loads(json.dumps(json.loads(query_analysis["text"])))
        expanded_query = query_data.get("expanded_query", query)
        keywords = query_data.get("keywords", [])
        domain = query_data.get("domain", "").lower()
        gemini.logger.info(f"Query analysis: {query_data}")
    except Exception:
        expanded_query = query
        keywords = []
        domain = ""
        gemini.logger.warning("Query analysis failed, using original query")
    docs = await asyncio.to_thread(cached_search, expanded_query, k * 5) 
    if not docs:
        raise ValueError("No matching documents found")
    refined_docs = []
    for doc in docs:
        source = doc.metadata.get('source', '').lower()
        file_ext = os.path.splitext(source)[1][1:] if '.' in source else ''
        domain_match = False
        if domain and file_ext:
            domain_match = (
                (domain == 'python' and file_ext == 'py') or
                (domain == 'javascript' and file_ext in ['js', 'ts']) or
                (domain == 'java' and file_ext == 'java') or
                (domain in ['c++', 'cpp'] and file_ext in ['cpp', 'c', 'h']) or
                (domain == 'go' and file_ext == 'go') or
                (domain == 'rust' and file_ext == 'rs')
            )
        if len(doc.page_content) > 2000:
            try:
                extract_prompt = (
                    f"Extract ONLY the most relevant code section from this document that answers: '{query}'\n\n"
                    f"CODE:\n{doc.page_content[:5000]}\n\n"
                    f"Include complete function definitions or class methods. "
                    f"Focus on sections related to {domain} if applicable."
                )
                relevant_section = await asyncio.to_thread(
                    gemini.gemini_fast.invoke,
                    extract_prompt
                )
                if len(relevant_section) > 100:
                    refined_docs.append(Document(
                        page_content=relevant_section[:5000],
                        metadata={**doc.metadata, "domain_match": domain_match}
                    ))
                else:
                    content = doc.page_content[:3500]
                    for boundary in ["\n\nclass ", "\n\ndef ", "\nfunction ", "\n\n// "]:
                        if boundary in content[1500:]:
                            pos = content.find(boundary, 1500)
                            if pos > 0:
                                content = content[:pos]
                                break
                    refined_docs.append(Document(
                        page_content=content,
                        metadata={**doc.metadata, "domain_match": domain_match}
                    ))
            except Exception:
                content = doc.page_content[:3000]
                refined_docs.append(Document(
                    page_content=content,
                    metadata={**doc.metadata, "domain_match": domain_match}
                ))
        else:
            refined_docs.append(Document(
                page_content=doc.page_content,
                metadata={**doc.metadata, "domain_match": domain_match}
            ))
    pairs = [(query, doc.page_content) for doc in refined_docs]
    semantic_scores = await asyncio.to_thread(gemini.cross_encoder.predict, pairs)
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
            if 200 <= len(content) <= 3000:
                size_score = 0.2
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
            (semantic_scores[i] * 0.55) +   
            (keyword_scores[i] * 0.20) +    
            (structure_scores[i] * 0.15) +  
            (quality_scores[i] * 0.10)     
        )
        final_scores.append(combined_score)
    doc_score_pairs = list(zip(refined_docs, final_scores, semantic_scores))
    filtered_pairs = [(doc, score, sem_score) for doc, score, sem_score in doc_score_pairs 
                      if score > min_relevance_threshold]
    ranked_docs = sorted(filtered_pairs, key=lambda x: -x[1])
    top_k_docs = ranked_docs[:k]
    if not top_k_docs:
        if doc_score_pairs:
            top_k_docs = sorted(doc_score_pairs, key=lambda x: -x[1])[:k]
        else:
            raise ValueError("No sufficiently relevant documents found")
    results = []
    if top_k_docs:
        scores = [score for _, score, _ in top_k_docs]
        max_score = max(scores) if scores else 0
        min_score = min(scores) if scores else 0
        score_range = max_score - min_score if max_score > min_score else 1
    for i, (doc, score, semantic_score) in enumerate(top_k_docs):
        source = doc.metadata.get('source', 'unknown')
        content = doc.page_content
        normalized_score = ((score - min_score) / score_range * 100) if score_range else score * 10
        normalized_score = max(0, min(100, normalized_score)) 
        if any(source.endswith(ext) for ext in ['.py', '.js', '.java', '.cpp', '.ts', '.go', '.rs']):
            lang = os.path.splitext(source)[1][1:] 
            results.append(
                f"### Result {i+1}: {os.path.basename(source)} (Relevance: {normalized_score:.0f}/100)\n"
                f"**Source:** {source}\n"
                f"```{lang}\n{content}\n```"
            )
        else:
            results.append(
                f"### Result {i+1}: {os.path.basename(source)} (Relevance: {normalized_score:.0f}/100)\n"
                f"**Source:** {source}\n{content}"
            )
    return "\n\n".join(results)

async def search_resources(query: str, msg: MessageRequest, k: int = 3) -> str:
    if not query or len(query.strip()) < MIN_QUERY_LENGTH:
        return "Query is too short. Please provide a more detailed question."
    try:
        if gemini.web_flag_state.get("enabled", False):
            try:
                return await web_search(query, msg)
            except ValueError as e:
                gemini.logger.warning(f"Web search failed: {e}")
                with suppress(Exception):
                    return await local_search(query, k, min_relevance_threshold=-5.0)
                return f"Web search error: {e}"
        else:
            return await local_search(query, k, min_relevance_threshold=-5.0)
    except Exception as e:
        gemini.logger.error(f"Search error: {str(e)}", exc_info=True)
        return f"An error occurred during search: {str(e)}"