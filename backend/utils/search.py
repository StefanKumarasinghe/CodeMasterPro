import config.tars as gemini
import html2text
import requests
import aiohttp
import asyncio
from typing import List, Dict, Optional, Tuple, Any, Union
from bs4 import BeautifulSoup, Tag
from utils.invoke_retry import invoke_with_retry
from ai.model_switcher import refine_search_chain
import concurrent.futures
from functools import lru_cache
from dataclasses import dataclass
from time import perf_counter

BASE_URL = gemini.BRAVE_URL
API_KEY = gemini.BRAVE_API_KEY
DEFAULT_TIMEOUT = 15
MAX_WORKERS = 10
REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

@dataclass
class SearchResult:
    title: str
    url: str
    description: str

@dataclass
class ArticleData:
    url: str
    length: int
    markdown: str
    snippet: str
    
    @property
    def summary(self) -> str:
        return self.snippet if self.snippet else self.markdown[:100] + "..."

async def brave_search(query: str, count: int = 10) -> List[SearchResult]:
    headers = {"Accept": "application/json", "X-Subscription-Token": API_KEY}
    
    try:
        refined_query = await invoke_with_retry(
            refine_search_chain(model_type=gemini.modelType, provider_type=gemini.providerName), 
            {"query": query}
        )
        
        final_query = refined_query.content.strip() if refined_query else query
        params = {"q": final_query, "count": count}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                BASE_URL, 
                headers={**headers, **REQUEST_HEADERS}, 
                params=params, 
                timeout=DEFAULT_TIMEOUT
            ) as resp:
                if resp.status != 200:
                    gemini.logger.warning(f"Brave search failed with status {resp.status}")
                    return []
                    
                data = await resp.json()
                results = data.get("web", {}).get("results", [])
                
                return [
                    SearchResult(
                        title=r.get("title", ""),
                        url=r.get("url", ""),
                        description=r.get("description", "")
                    )
                    for r in results if r.get("url")
                ]
    except asyncio.TimeoutError:
        gemini.logger.error(f"Brave search timed out after {DEFAULT_TIMEOUT}s")
        return []
    except Exception as e:
        gemini.logger.error(f"Brave search failed: {str(e)}")
        return []

@lru_cache(maxsize=128)
def html_to_markdown(html_content: str) -> str:
    try:
        converter = html2text.HTML2Text()
        converter.ignore_links = True
        converter.body_width = 0
        converter.skip_internal_links = True
        converter.ignore_images = True
        converter.inline_links = False
        return converter.handle(html_content)
    except Exception as e:
        gemini.logger.error(f"HTML to Markdown conversion failed: {str(e)}")
        return ""

def is_meaningful(tag: Tag) -> bool:
    if not tag:
        return False
        
    try:
        text = tag.get_text(strip=True)
        words = text.split()
        return bool(text and len(words) > 2 and any(len(word) > 2 for word in words))
    except Exception:
        return False

def extract_article_data(url: str, timeout: int = DEFAULT_TIMEOUT) -> Optional[ArticleData]:
    start_time = perf_counter()
    
    try:
        session = requests.Session()
        response = session.get(url, headers=REQUEST_HEADERS, timeout=timeout)
        response.raise_for_status()
        
        content_type = response.headers.get('Content-Type', '')
        if 'text/html' not in content_type.lower():
            gemini.logger.warning(f"Skipping non-HTML content at {url}: {content_type}")
            return None
            
        soup = BeautifulSoup(response.content, "html.parser")
        
        for selector in ["script", "style", "nav", "footer", "header", "aside", "noscript", 
                         "form", "svg", ".sidebar", ".comment", ".ad", ".advertisement"]:
            for element in soup.select(selector):
                element.decompose()
        
        target_tags = ["h1", "h2", "h3", "p", "pre", "code", "ul", "ol", "li", "blockquote", "table"]
        body = soup.body or soup
        
        main_content = body.select_one("main, article, .content, .post, #content")
        search_root = main_content if main_content else body
        
        content = [str(tag) for tag in search_root.find_all(target_tags) if is_meaningful(tag)]
        if not content:
            gemini.logger.warning(f"No meaningful content found in {url}")
            return None
            
        html_content = "\n".join(content)
        markdown = html_to_markdown(html_content).strip()
        
        if not markdown or len(markdown) < 50:
            gemini.logger.warning(f"Insufficient content extracted from {url}")
            return None
            
        elapsed = perf_counter() - start_time
        gemini.logger.debug(f"Extracted {len(markdown)} chars from {url} in {elapsed:.2f}s")
        
        return ArticleData(
            url=url,
            length=len(markdown),
            markdown=markdown,
            snippet=markdown[:500] + ("..." if len(markdown) > 500 else "")
        )
    except requests.RequestException as e:
        gemini.logger.error(f"Request failed for {url}: {str(e)}")
    except Exception as e:
        gemini.logger.error(f"Failed to extract from {url}: {str(e)}")
    
    return None

async def extract_article_async(url: str) -> Optional[ArticleData]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, extract_article_data, url)

async def extract_all_articles_async(input_json: Dict[str, List[str]]) -> Dict[str, Dict[str, Union[ArticleData, Dict[str, str]]]]:
    results = {"documentation": {}, "example": {}}
    doc_urls = input_json.get("documentation", [])
    ex_urls = input_json.get("example", [])
    
    all_tasks = []
    
    for url in doc_urls:
        if url:
            all_tasks.append(("documentation", url))
            
    for url in ex_urls:
        if url:
            all_tasks.append(("example", url))
    
    async def process_url(category: str, url: str) -> Tuple[str, str, Union[ArticleData, Dict[str, str]]]:
        try:
            data = await extract_article_async(url)
            if data:
                return category, url, data
            else:
                return category, url, {"error": "Extraction failed", "url": url}
        except Exception as e:
            gemini.logger.error(f"Error processing {category} URL {url}: {str(e)}")
            return category, url, {"error": f"Exception: {str(e)}", "url": url}
    
    tasks = [process_url(category, url) for category, url in all_tasks]
    completed = await asyncio.gather(*tasks, return_exceptions=True)
    
    for item in completed:
        if isinstance(item, Exception):
            gemini.logger.error(f"Task failed: {str(item)}")
            continue
            
        category, url, data = item
        results[category][url] = data
    
    return results

def extract_all_articles(input) -> Dict[str, Dict[str, Any]]:
    results = {"documentation": {}, "example": {}}
    doc_urls = input.documentation
    ex_urls = input.example


    if not doc_urls and not ex_urls:
        return results
    
    def fetch_and_extract(url: str, category: str) -> Tuple[str, str, Union[ArticleData, Dict[str, str]]]:
        try:
            data = extract_article_data(url)
            if data:
                return category, url, data
            else:
                return category, url, {"error": "Extraction failed", "url": url}
        except Exception as e:
            gemini.logger.error(f"Error processing {category} URL {url}: {str(e)}")
            return category, url, {"error": f"Exception: {str(e)}", "url": url}
    
    tasks = []
    for url in doc_urls:
        if url:
            tasks.append((url, "documentation"))
    
    for url in ex_urls:
        if url:
            tasks.append((url, "example"))
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(fetch_and_extract, url, category) for url, category in tasks]
        
        for future in concurrent.futures.as_completed(futures):
            try:
                category, url, data = future.result()
                results[category][url] = data
            except Exception as e:
                gemini.logger.error(f"Task result processing failed: {str(e)}")
    
    return results 


def search_and_extract(query: str, max_results: int = 5) -> Dict[str, Any]:
    search_results = asyncio.run(brave_search(query, count=max_results * 2))
    
    if not search_results:
        return {"error": "Search returned no results", "query": query}
    
    urls = [result.url for result in search_results[:max_results]]

    input_json = {"documentation": urls}
    
    return extract_all_articles(input_json)