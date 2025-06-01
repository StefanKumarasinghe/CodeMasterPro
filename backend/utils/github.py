import os
import requests
import shutil
import asyncio
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from git import Repo
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter, CharacterTextSplitter
from langchain.embeddings import CacheBackedEmbeddings
from langchain.storage import LocalFileStore
from ai.model_switcher import github_select_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini
from pathlib import Path

TMP_REPO_DIR = os.getenv("TMP_REPO_DIR", "git_tmp")
INDEX_DIR = os.getenv("INDEX_DIR", "git_index")
CACHE_DIR = os.getenv("CACHE_DIR", "embeddings_cache")
MAX_REPO_SIZE_MB = int(os.getenv("MAX_REPO_SIZE_MB", 50))
MAX_CONCURRENT_TASKS = int(os.getenv("MAX_CONCURRENT_TASKS", 5))
DEFAULT_TIMEOUT = int(os.getenv("DEFAULT_TIMEOUT", 30))
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
FILENAME_SEARCH_BOOST = float(os.getenv("FILENAME_SEARCH_BOOST", 1.5))

CODE_EXTS = {
    '.py': 'python',
    '.js': 'javascript', 
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.html': 'html',
    '.css': 'css',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.dart': 'dart',
    '.lua': 'lua',
    '.r': 'r',
    '.sh': 'bash',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.vb': 'vbnet',
    '.pl': 'perl',
    '.h': 'c',
    '.hpp': 'cpp',
}

MARKDOWN_EXTS = {'.md', '.mdx', '.markdown', '.txt', '.rst'}
CONFIG_EXTS = {'.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.env', '.properties', '.xml', '.csv', '.lock'}
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', 'venv', 'env', 'build', 'dist', '.idea', '.vscode'}
BINARY_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.exe', '.dll', '.so', '.tar', '.gz', '.mp4', '.mov', '.wasm', '.class', '.pyc'}
MAX_FILE_SIZE_KB = 500

logger = gemini.logger

class RateLimiter:
    def __init__(self, max_calls=10, time_period=60):
        self.max_calls = max_calls
        self.time_period = time_period
        self.calls = []
        self.lock = asyncio.Lock()
    
    async def acquire(self):
        async with self.lock:
            now = datetime.now()
            self.calls = [t for t in self.calls if (now - t).total_seconds() < self.time_period]
            if len(self.calls) >= self.max_calls:
                wait_time = self.time_period - (now - self.calls[0]).total_seconds()
                if wait_time > 0:
                    logger.info(f"Rate limit reached, waiting {wait_time:.2f}s")
                    await asyncio.sleep(wait_time)
            self.calls.append(datetime.now())

class GitHubClient:
    def __init__(self, token=GITHUB_TOKEN):
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        if token:
            self.headers["Authorization"] = f"token {token}"
        self.rate_limiter = RateLimiter(30 if token else 10, 60)
    
    async def search_repositories(self, query, sort="stars", order="desc", per_page=10):
        await self.rate_limiter.acquire()
        url = f"{self.base_url}/search/repositories"
        params = {
            "q": query,
            "sort": sort,
            "order": order,
            "per_page": per_page
        }
        try:
            async with asyncio.timeout(DEFAULT_TIMEOUT):
                response = requests.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                return [
                    {
                        "id": repo["id"],
                        "name": repo["full_name"],
                        "url": repo["clone_url"],
                        "desc": repo["description"] or "",
                        "stars": repo["stargazers_count"],
                        "language": repo["language"],
                        "updated": repo["updated_at"],
                        "size": repo["size"]
                    }
                    for repo in data.get("items", [])
                ]
        except Exception as e:
            logger.error(f"GitHub search failed: {e}")
            return []
    
    async def get_repository_languages(self, repo_name):
        await self.rate_limiter.acquire()
        url = f"{self.base_url}/repos/{repo_name}/languages"
        try:
            async with asyncio.timeout(DEFAULT_TIMEOUT):
                response = requests.get(url, headers=self.headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get languages for {repo_name}: {e}")
            return {}
    
    async def get_repository_contents(self, repo_name, path=""):
        await self.rate_limiter.acquire()
        url = f"{self.base_url}/repos/{repo_name}/contents/{path}"
        try:
            async with asyncio.timeout(DEFAULT_TIMEOUT):
                response = requests.get(url, headers=self.headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get contents for {repo_name}/{path}: {e}")
            return []
            
    async def search_code(self, query, repo_name=None, language=None, path=None):
        await self.rate_limiter.acquire()
        url = f"{self.base_url}/search/code"
        q = query
        if repo_name:
            q = f"{q} repo:{repo_name}"
        if language:
            q = f"{q} language:{language}"
        if path:
            q = f"{q} path:{path}"
            
        params = {"q": q, "per_page": 20}
        try:
            async with asyncio.timeout(DEFAULT_TIMEOUT):
                response = requests.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                return [
                    {
                        "name": item["name"],
                        "path": item["path"],
                        "repo": item["repository"]["full_name"],
                        "url": item["html_url"]
                    }
                    for item in data.get("items", [])
                ]
        except Exception as e:
            logger.error(f"GitHub code search failed: {e}")
            return []

class RepoAnalyzer:
    def __init__(self, tmp_dir=TMP_REPO_DIR, index_dir=INDEX_DIR, cache_dir=CACHE_DIR):
        os.makedirs(tmp_dir, exist_ok=True)
        os.makedirs(index_dir, exist_ok=True)
        os.makedirs(cache_dir, exist_ok=True)
        self.tmp_dir = tmp_dir
        self.index_dir = index_dir
        self.cache_dir = cache_dir
        self.github_client = GitHubClient()
        self.file_index = {}
        
        self.embedding_store = LocalFileStore(f"./{cache_dir}")
        self.cached_embedder = CacheBackedEmbeddings.from_bytes_store(
            gemini.embedding_model,
            self.embedding_store,
            namespace=gemini.embedding_model.__class__.__name__
        )
        
    async def search_github_repos(self, query, top_n=10):
        raw_repos = await self.github_client.search_repositories(query, per_page=top_n)
        
        filtered_repos = []
        for repo in raw_repos:
            if repo["size"] > MAX_REPO_SIZE_MB * 1024: 
                logger.info(f"Skipping large repo: {repo['name']} ({repo['size']} KB)")
                continue
            filtered_repos.append(repo)
        
        enhanced_repos = []
        for repo in filtered_repos[:5]: 
            languages = await self.github_client.get_repository_languages(repo["name"])
            repo["languages"] = languages
            enhanced_repos.append(repo)
            
        return enhanced_repos

    async def choose_best_repo(self, repos, query, mem):
        if not repos or not query:
            logger.error("Missing repos or query.")
            return None

        repo_descriptions = []
        for i, r in enumerate(repos):
            languages = ", ".join(list(r.get("languages", {}).keys())[:3])
            desc = f"{i+1}. {r['name']} ({r['stars']}⭐): {r['desc']}\n   Languages: {languages or 'Unknown'}"
            repo_descriptions.append(desc)
        
        repo_text = "\n".join(repo_descriptions)
        
        try:
            result = await invoke_with_retry(github_select_chain(model_type=gemini.modelType, provider_type=gemini.providerName), {
                "repos": repo_text,
                "query": query,
                "mem": mem,
            })
            
            if not result or not result.content:
                return None
                
            selection = result.content.strip()
            for repo in repos:
                if repo["name"] in selection:
                    return repo["url"]
            
            for i, repo in enumerate(repos):
                if f"{i+1}." in selection:
                    return repo["url"]
            
            return repos[0]["url"] if repos else None
        except Exception as e:
            logger.error(f"Repo selection failed: {e}")
            return None

    async def clone_repo(self, url):
        if not url:
            return None
            
        repo_name = url.split("/")[-1].replace(".git", "")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        repo_dir = os.path.join(self.tmp_dir, f"{repo_name}_{timestamp}")
        if os.path.exists(repo_dir):
            shutil.rmtree(repo_dir)

        try:
            head = requests.head(url, allow_redirects=True, timeout=DEFAULT_TIMEOUT)
            if 'Content-Length' in head.headers and int(head.headers['Content-Length']) > MAX_REPO_SIZE_MB * 1024 * 1024:
                logger.warning(f"Skipping large repo: {url}")
                return None

            logger.info(f"Cloning {url}...")
            
            with ThreadPoolExecutor() as executor:
                future = executor.submit(Repo.clone_from, url, repo_dir, depth=1)
                repo = future.result(timeout=120)  
                
            logger.info(f"Successfully cloned to {repo_dir}")
            return repo_dir
        except Exception as e:
            logger.error(f"Clone failed: {e}")
            if os.path.exists(repo_dir):
                shutil.rmtree(repo_dir)
            return None

    def get_file_splitter(self, file_path, file_content):
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in ['.js', '.jsx']:
            return RecursiveCharacterTextSplitter.from_language(
                language="js",
                chunk_size=750,
                chunk_overlap=150
            )
        
        if ext in ['.ts', '.tsx']:
            return RecursiveCharacterTextSplitter.from_language(
                language="ts",
                chunk_size=750,
                chunk_overlap=150
            )
        
        if ext in CODE_EXTS:
            lang = CODE_EXTS[ext]
            
            lang_mapping = {
                'javascript': 'js',
                'typescript': 'ts',
                'python': 'python',
                'java': 'java',
                'cpp': 'cpp',
                'c': 'c',
                'csharp': 'csharp',
                'go': 'go',
                'rust': 'rust',
                'ruby': 'ruby',
                'php': 'php',
                'swift': 'swift',
                'kotlin': 'kotlin',
                'scala': 'scala',
                'html': 'html',
                'lua': 'lua',
                'perl': 'perl',
                'powershell': 'powershell'
            }
            
            langchain_lang = lang_mapping.get(lang)
            if langchain_lang:
                return RecursiveCharacterTextSplitter.from_language(
                    language=langchain_lang,
                    chunk_size=750,
                    chunk_overlap=150
                )
        
        if ext in MARKDOWN_EXTS:
            return RecursiveCharacterTextSplitter.from_language(
                language="markdown",
                chunk_size=1000,
                chunk_overlap=200
            )
            
        return CharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150,
            separator="\n"
        )


    def should_process_file(self, file_path):
        parts = Path(file_path).parts
        for part in parts:
            if part in IGNORE_DIRS:
                return False
                
        ext = os.path.splitext(file_path)[1].lower()
        if ext in BINARY_EXTS:
            return False
            
        if ext not in CODE_EXTS and ext not in MARKDOWN_EXTS and ext not in CONFIG_EXTS:
            return False
            
        if os.path.getsize(file_path) > MAX_FILE_SIZE_KB * 1024:
            logger.info(f"Skipping large file: {file_path}")
            return False
            
        return True

    async def process_file(self, file_path, repo_name):
        try:
            if not self.should_process_file(file_path):
                return []
                
            filename = os.path.basename(file_path)
            ext = os.path.splitext(filename)[1].lower()
            relpath = os.path.relpath(file_path, start=self.tmp_dir)
            
            lang = CODE_EXTS.get(ext, "text")
            
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
                
            if not content.strip():
                return []
                
            splitter = self.get_file_splitter(file_path, content)
            
            metadata = {
                "source": file_path,
                "filename": filename,
                "repo": repo_name,
                "ext": ext,
                "language": lang,
                "path": relpath,
                "dirname": os.path.dirname(relpath),
                "size": os.path.getsize(file_path),
                "last_modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
            }
            
            self.file_index[relpath] = {
                "filename": filename,
                "path": relpath,
                "ext": ext,
                "language": lang,
                "size": os.path.getsize(file_path),
                "last_modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
            }
            
            file_docs = splitter.create_documents([content], metadatas=[metadata])
            
            return file_docs
            
        except Exception as e:
            logger.error(f"Failed processing {file_path}: {e}")
            return []

    async def index_repo(self, repo_dir):
        if not os.path.exists(repo_dir):
            logger.error(f"Repository directory does not exist: {repo_dir}")
            return None
            
        repo_name = os.path.basename(repo_dir)
        logger.info(f"Indexing repository: {repo_name}")
        
        self.file_index = {}
        
        all_files = []
        for root, dirs, files in os.walk(repo_dir):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                file_path = os.path.join(root, file)
                all_files.append(file_path)
        
        docs = []
        tasks = []
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)
        
        async def process_with_limit(file_path):
            async with semaphore:
                return await self.process_file(file_path, repo_name)
        
        for file_path in all_files:
            tasks.append(process_with_limit(file_path))
        
        results = await asyncio.gather(*tasks)
        docs = [doc for sublist in results for doc in sublist]
        
        if not docs:
            logger.warning(f"No documents were extracted from {repo_name}")
            return None
            
        logger.info(f"Extracted {len(docs)} document chunks from {repo_name}")
        index_path = os.path.join(self.index_dir, repo_name)
        os.makedirs(index_path, exist_ok=True)
        
        index = FAISS.from_documents(docs, self.cached_embedder)
        index.save_local(index_path)
        
        filename_index_path = os.path.join(index_path, "filename_index.json")
        import json
        with open(filename_index_path, 'w') as f:
            json.dump(self.file_index, f)
        
        logger.info(f"Successfully indexed {len(docs)} chunks from {repo_name}")
        return index_path

    def contains_filename_keywords(self, query, filename):
        if not query or not filename:
            return False
            
        query_terms = query.lower().split()
        filename_lower = filename.lower()
        
        for term in query_terms:
            if len(term) > 2 and term in filename_lower:
                return True
                
        return False

    def boost_filename_scores(self, results, query):
        if not query:
            return results
        
        boosted_results = []
        query_terms = set(query.lower().split())
        
        for doc, score in results:
            boost_factor = 1.0
            
            filename = doc.metadata.get('filename', '')
            path = doc.metadata.get('path', '')
            
            if any(term in filename.lower() for term in query_terms if len(term) > 2):
                boost_factor = FILENAME_SEARCH_BOOST
            elif any(term in path.lower() for term in query_terms if len(term) > 2):
                boost_factor = 1.25
                
            boosted_score = score / boost_factor
            boosted_results.append((doc, boosted_score))
            
        return sorted(boosted_results, key=lambda x: x[1])

    async def query_repo(self, question, repo_name=None):
        if not os.path.exists(self.index_dir):
            logger.error(f"Index directory does not exist: {self.index_dir}")
            return None
            
        if repo_name:
            index_path = os.path.join(self.index_dir, repo_name)
            if not os.path.exists(index_path):
                logger.error(f"Index not found for {repo_name}")
                return None
        else:
            available_indices = [d for d in os.listdir(self.index_dir) 
                               if os.path.isdir(os.path.join(self.index_dir, d))]
            if not available_indices:
                logger.error("No indices available")
                return None
            
            index_path = os.path.join(self.index_dir, sorted(available_indices)[-1])
            
        logger.info(f"Querying index: {index_path}")
        
        try:
            index = FAISS.load_local(index_path, self.cached_embedder, allow_dangerous_deserialization=True)
            
            results = index.similarity_search_with_score(question, k=12)
            boosted_results = self.boost_filename_scores(results, question)
            
            formatted_results = []
            seen_files = set()
            
            for doc, score in boosted_results:
                file_id = f"{doc.metadata['filename']}:{doc.metadata.get('path', '')}"
                if file_id in seen_files:
                    continue
                seen_files.add(file_id)
                
                path = doc.metadata.get("path", doc.metadata.get("source", ""))
                relevance = min(100, int(100 * (1 - score/1.4)))
                
                metadata_info = {
                    "language": doc.metadata.get('language', 'unknown'),
                    "size": doc.metadata.get('size', 'unknown'),
                    "last_modified": doc.metadata.get('last_modified', 'unknown'),
                    "directory": doc.metadata.get('dirname', '')
                }
                
                metadata_str = " | ".join([f"{k}: {v}" for k, v in metadata_info.items()])
                
                formatted_results.append(
                    f"File: {path} (Relevance: {relevance}%)\n"
                    f"Metadata: {metadata_str}\n"
                    f"```{doc.metadata.get('language', 'text')}\n{doc.page_content}\n```\n"
                )
                
                if len(formatted_results) >= 5:
                    break
                    
            return "\n".join(formatted_results)
        except Exception as e:
            logger.error(f"Query failed: {e}")
            return None

    async def search_by_filename(self, filename_query, repo_name=None):
        if not os.path.exists(self.index_dir):
            logger.error(f"Index directory does not exist: {self.index_dir}")
            return None
            
        if repo_name:
            index_path = os.path.join(self.index_dir, repo_name)
            if not os.path.exists(index_path):
                logger.error(f"Index not found for {repo_name}")
                return None
        else:
            available_indices = [d for d in os.listdir(self.index_dir) 
                              if os.path.isdir(os.path.join(self.index_dir, d))]
            if not available_indices:
                logger.error("No indices available")
                return None
                
            index_path = os.path.join(self.index_dir, sorted(available_indices)[-1])
            
        filename_index_path = os.path.join(index_path, "filename_index.json")
        if not os.path.exists(filename_index_path):
            logger.error(f"Filename index not found for {index_path}")
            return None
            
        import json
        with open(filename_index_path, 'r') as f:
            filename_index = json.load(f)
        
        query_terms = filename_query.lower().split()
        matching_files = []
        
        for path, file_info in filename_index.items():
            filename = file_info["filename"].lower()
            full_path = path.lower()
            
            match_score = 0
            for term in query_terms:
                if len(term) > 2:
                    if term in filename:
                        match_score += 3
                    elif term in full_path:
                        match_score += 1
            
            if match_score > 0:
                matching_files.append((path, file_info, match_score))
                
        matching_files.sort(key=lambda x: x[2], reverse=True)
        
        results = []
        for path, file_info, score in matching_files[:5]:
            try:
                full_path = os.path.join(self.tmp_dir, path)
                if os.path.exists(full_path):
                    with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                        content = f.read()
                        if len(content) > 2000:
                            content = content[:2000] + "... [content truncated]"
                            
                    metadata_str = " | ".join([f"{k}: {v}" for k, v in file_info.items() 
                                              if k not in ['filename', 'path']])
                            
                    results.append(
                        f"File: {path} (Match Score: {score})\n"
                        f"Metadata: {metadata_str}\n"
                        f"```{file_info.get('language', 'text')}\n{content}\n```\n"
                    )
            except Exception as e:
                logger.error(f"Error reading file {path}: {e}")
                
        if not results:
            return f"No files matching '{filename_query}' found."
            
        return "\n".join(results)

    async def search_code_hybrid(self, query, repo_name=None):
        has_filename_indicator = any(term in query.lower() for term in ["file:", "filename:", "named:", "called:"])
        
        if has_filename_indicator:
            for term in ["file:", "filename:", "named:", "called:"]:
                query = query.replace(term, "")
            return await self.search_by_filename(query.strip(), repo_name)
        else:
            content_results = await self.query_repo(query, repo_name)
            filename_results = await self.search_by_filename(query, repo_name)
            
            if not content_results:
                return filename_results
            if not filename_results or "No files matching" in filename_results:
                return content_results
                
            return f"### Content Search Results\n{content_results}\n\n### Filename Search Results\n{filename_results}"

    async def analyze_repo_structure(self, repo_dir):
        if not os.path.exists(repo_dir):
            return None
            
        repo_name = os.path.basename(repo_dir)

        file_types = {}
        code_files = []
        total_files = 0
        total_size = 0
        
        for root, _, files in os.walk(repo_dir):
            parts = Path(root).parts
            if any(part in IGNORE_DIRS for part in parts):
                continue
                
            for file in files:
                file_path = os.path.join(root, file)
                ext = os.path.splitext(file)[1].lower()
                
                if ext in BINARY_EXTS:
                    continue
                    
                try:
                    size = os.path.getsize(file_path)
                    total_size += size
                    total_files += 1

                    file_types[ext] = file_types.get(ext, 0) + 1
                    
                    if ext in CODE_EXTS:
                        code_files.append(file_path)
                except:
                    pass
        
        top_types = sorted([(ext, count) for ext, count in file_types.items()], 
                          key=lambda x: x[1], reverse=True)[:10]
        
        analysis = {
            "repo_name": repo_name,
            "total_files": total_files,
            "total_size_mb": total_size / (1024 * 1024),
            "file_types": dict(top_types),
            "languages": {ext: CODE_EXTS.get(ext, "unknown") for ext, _ in top_types if ext in CODE_EXTS}
        }
        
        return analysis

    async def run_pipeline(self, query, mem):
        repos = await self.search_github_repos(query)
        if not repos:
            return "No repositories found for the query."
            
        best_repo_url = await self.choose_best_repo(repos, query, mem)
        if not best_repo_url:
            return "Failed to select a suitable repository."
            
        repo_dir = await self.clone_repo(best_repo_url)
        if not repo_dir:
            return "Failed to clone the repository."
            
        analysis = await self.analyze_repo_structure(repo_dir)
        
        index_path = await self.index_repo(repo_dir)
        if not index_path:
            return "Failed to index the repository."
            
        repo_name = os.path.basename(repo_dir)
        
        return {
            "status": "success",
            "repo_name": repo_name,
            "repo_url": best_repo_url,
            "repo_dir": repo_dir,
            "index_path": index_path,
            "analysis": analysis
        }

    async def search_code(self, query, repo_name=None):
        return await self.search_code_hybrid(query, repo_name)

    async def list_repos(self):
        if not os.path.exists(self.tmp_dir):
            return []
            
        repos = []
        for dirname in os.listdir(self.tmp_dir):
            path = os.path.join(self.tmp_dir, dirname)
            if os.path.isdir(path):
                size_mb = sum(os.path.getsize(os.path.join(dp, f)) 
                          for dp, _, fs in os.walk(path) 
                          for f in fs if os.path.isfile(os.path.join(dp, f))) / (1024 * 1024)
                
                index_path = os.path.join(self.index_dir, dirname)
                has_index = os.path.exists(index_path)
                
                repos.append({
                    "name": dirname,
                    "size_mb": round(size_mb, 2),
                    "path": path,
                    "has_index": has_index,
                    "indexed_at": datetime.fromtimestamp(os.path.getctime(index_path)).isoformat() if has_index else None
                })
                
        return sorted(repos, key=lambda x: x["name"])

    async def delete_repo(self, repo_name):
        repo_path = os.path.join(self.tmp_dir, repo_name)
        index_path = os.path.join(self.index_dir, repo_name)
        
        deleted = False
        
        if os.path.exists(repo_path):
            try:
                shutil.rmtree(repo_path)
                deleted = True
            except Exception as e:
                logger.error(f"Failed to delete repo directory {repo_path}: {e}")
                
        if os.path.exists(index_path):
            try:
                shutil.rmtree(index_path)
                deleted = True
            except Exception as e:
                logger.error(f"Failed to delete index directory {index_path}: {e}")
                
        return deleted

    async def clean_all(self):
        success = True

        if os.path.exists(self.tmp_dir):
            try:
                shutil.rmtree(self.tmp_dir)
                os.makedirs(self.tmp_dir, exist_ok=True)
            except Exception as e:
                logger.error(f"Failed to clean tmp directory: {e}")
                success = False
                
        if os.path.exists(self.index_dir):
            try:
                shutil.rmtree(self.index_dir)
                os.makedirs(self.index_dir, exist_ok=True)
            except Exception as e:
                logger.error(f"Failed to clean index directory: {e}")
                success = False
                
        if os.path.exists(self.cache_dir):
            try:
                shutil.rmtree(self.cache_dir)
                os.makedirs(self.cache_dir, exist_ok=True)
            except Exception as e:
                logger.error(f"Failed to clean cache directory: {e}")
                
        return success

async def pipeline(query, mem):
    analyzer = RepoAnalyzer()
    return await analyzer.run_pipeline(query, mem)

async def search_github_repos(query, top_n=10):
    analyzer = RepoAnalyzer()
    return await analyzer.search_github_repos(query, top_n)

async def choose_best_repo(repos, query, mem):
    analyzer = RepoAnalyzer()
    return await analyzer.choose_best_repo(repos, query, mem)

async def clone_repo(url, dest=TMP_REPO_DIR):
    analyzer = RepoAnalyzer(tmp_dir=dest)
    return await analyzer.clone_repo(url)

async def index_repo(repo_dir=TMP_REPO_DIR, index_dir=INDEX_DIR):
    analyzer = RepoAnalyzer(tmp_dir=os.path.dirname(repo_dir), index_dir=index_dir)
    return await analyzer.index_repo(repo_dir)

async def query_repo(question, repo_name=None):
    analyzer = RepoAnalyzer()
    return await analyzer.query_repo(question, repo_name)

async def list_cloned_repos(repo_base_dir=TMP_REPO_DIR):
    analyzer = RepoAnalyzer(tmp_dir=repo_base_dir)
    return await analyzer.list_repos()

async def delete_cloned_repo(repo_name, repo_base_dir=TMP_REPO_DIR):
    analyzer = RepoAnalyzer(tmp_dir=repo_base_dir)
    return await analyzer.delete_repo(repo_name)

async def delete_all_cloned_repos(repo_base_dir=TMP_REPO_DIR, index_dir=INDEX_DIR):
    analyzer = RepoAnalyzer(tmp_dir=repo_base_dir, index_dir=index_dir)
    return await analyzer.clean_all()

async def analyze_javascript_code(code_text):
    with tempfile.NamedTemporaryFile(suffix='.js', delete=False) as f:
        f.write(code_text.encode('utf-8'))
        temp_file = f.name
    
    try:
        splitter = RecursiveCharacterTextSplitter.from_language(
            language="js",  
            chunk_size=1000,
            chunk_overlap=200
        )
        
        with open(temp_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        metadata = {"language": "javascript", "filename": "analysis.js"}
        docs = splitter.create_documents([content], metadatas=[metadata])
        
        embedding_model = gemini.embedding_model
        embeddings = embedding_model.embed_documents([doc.page_content for doc in docs])

        return {
            "chunks": len(docs),
            "avg_chunk_length": sum(len(doc.page_content) for doc in docs) / len(docs) if docs else 0,
            "functions": len([d for d in docs if "function" in d.page_content]),
            "classes": len([d for d in docs if "class" in d.page_content]),
            "imports": len([d for d in docs if "import" in d.page_content or "require" in d.page_content]),
            "structure": docs[0].page_content[:500] + "..." if docs else ""
        }
    finally:
        os.unlink(temp_file)


async def reindex_all_github_projects(repo_dir=TMP_REPO_DIR):
    analyzer = RepoAnalyzer()
    return await analyzer.index_repo(repo_dir)

async def read_file_content_from_github_directory(file_path):

    try:
        if not os.path.isabs(file_path):
            for repo_dir in os.listdir(TMP_REPO_DIR):
                full_path = os.path.join(TMP_REPO_DIR, repo_dir, file_path)
                if os.path.exists(full_path):
                    with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                        return f.read()
            
            direct_path = os.path.join(TMP_REPO_DIR, file_path)
            if os.path.exists(direct_path):
                with open(direct_path, 'r', encoding='utf-8', errors='replace') as f:
                    return f.read()
        else:
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    return f.read()
        
        logger.error(f"Could not find file: {file_path}")
        return f"Error: File '{file_path}' not found in any GitHub repository."
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {e}")
        return f"Error reading file: {str(e)}"

async def get_github_project_structure(project_id: str):
    """Get the file tree structure of a GitHub project"""
    try:
        project_path = os.path.join(TMP_REPO_DIR, project_id)
        if not os.path.exists(project_path):
            raise Exception(f"Project '{project_id}' not found")
        
        def build_tree(path, relative_path=""):
            items = []
            try:
                for item_name in sorted(os.listdir(path)):
                    if item_name.startswith('.') and item_name in {'.git', '.gitignore', '.github'}:
                        continue
                    
                    item_path = os.path.join(path, item_name)
                    relative_item_path = os.path.join(relative_path, item_name) if relative_path else item_name
                    
                    if os.path.isdir(item_path):
                        # Skip common directories we don't want to show
                        if item_name in IGNORE_DIRS:
                            continue
                        
                        children = build_tree(item_path, relative_item_path)
                        items.append({
                            "name": item_name,
                            "type": "directory",
                            "path": relative_item_path,
                            "children": children
                        })
                    else:
                        # Get file info
                        try:
                            file_size = os.path.getsize(item_path)
                            file_ext = os.path.splitext(item_name)[1].lower()
                            
                            # Skip binary files
                            if file_ext in BINARY_EXTS:
                                continue
                            
                            # Skip large files
                            if file_size > MAX_FILE_SIZE_KB * 1024:
                                continue
                            
                            items.append({
                                "name": item_name,
                                "type": "file",
                                "path": relative_item_path,
                                "size": file_size,
                                "extension": file_ext,
                                "language": CODE_EXTS.get(file_ext, "text")
                            })
                        except OSError:
                            continue
            except PermissionError:
                pass
            
            return items
        
        file_tree = build_tree(project_path)
        
        # Get project analysis
        analyzer = RepoAnalyzer()
        analysis = await analyzer.analyze_repo_structure(project_path)
        
        return {
            "project_id": project_id,
            "file_tree": file_tree,
            "analysis": analysis
        }
        
    except Exception as e:
        logger.error(f"Error getting project structure for {project_id}: {e}")
        raise Exception(f"Failed to get project structure: {str(e)}")

async def get_github_project_file_content(project_id: str, file_path: str):
    """Get the content of a specific file in a GitHub project"""
    try:
        # Security check: prevent path traversal attacks
        if ".." in file_path or file_path.startswith("/"):
            raise Exception("Invalid file path")
        
        project_path = os.path.join(TMP_REPO_DIR, project_id)
        if not os.path.exists(project_path):
            raise Exception(f"Project '{project_id}' not found")
        
        full_file_path = os.path.join(project_path, file_path)
        
        # Ensure the file is within the project directory
        if not full_file_path.startswith(project_path):
            raise Exception("Invalid file path")
        
        if not os.path.exists(full_file_path):
            raise Exception(f"File '{file_path}' not found in project")
        
        if not os.path.isfile(full_file_path):
            raise Exception(f"'{file_path}' is not a file")
        
        # Get file info
        file_size = os.path.getsize(full_file_path)
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Check if file is too large
        if file_size > MAX_FILE_SIZE_KB * 1024:
            raise Exception(f"File is too large ({file_size / 1024:.1f}KB > {MAX_FILE_SIZE_KB}KB)")
        
        # Try to read as text with different encodings
        encodings = ['utf-8', 'utf-16', 'latin-1', 'cp1252']
        content = None
        encoding_used = None
        
        for encoding in encodings:
            try:
                with open(full_file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                    encoding_used = encoding
                    break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            # If all text encodings fail, try reading as binary and decode what we can
            with open(full_file_path, 'rb') as f:
                raw_content = f.read()
                content = raw_content.decode('utf-8', errors='replace')
                encoding_used = 'binary'
        
        return {
            "project_id": project_id,
            "file_path": file_path,
            "content": content,
            "size": file_size,
            "extension": file_ext,
            "language": CODE_EXTS.get(file_ext, "text"),
            "encoding": encoding_used
        }
        
    except Exception as e:
        logger.error(f"Error reading file {file_path} from project {project_id}: {e}")
        raise Exception(f"Failed to read file: {str(e)}")




