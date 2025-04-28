import config.tars as gemini
import html2text
import requests
import aiohttp
from typing import List
from bs4 import BeautifulSoup, Tag
from utils.invoke_retry import invoke_with_retry
from Prompts.prompts import refine_search_chain
import concurrent.futures
import config.tars as gemini

BASE_URL = gemini.BRAVE_URL
API_KEY = gemini.BRAVE_API_KEY

async def brave_search(query: str, count: int = 5) -> List[dict]:
    headers = {"Accept": "application/json","X-Subscription-Token": API_KEY}
    result = await invoke_with_retry(refine_search_chain, {"query": query})
    if result:
        query = result.content.strip()
    params = {"q": query, "count": count}
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(BASE_URL, headers=headers, params=params, timeout=10) as resp:
                resp.raise_for_status()
                data = await resp.json()

                return [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("url"),
                        "description": r.get("description", "")
                    }
                    for r in data.get("web", {}).get("results", [])
                ]
        except Exception as e:
            gemini.logger.error(f"[ERROR] Brave search failed: {e}")
            return []

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
        gemini.logger.error(f"Failed to convert HTML to Markdown: {e}")
        return ""

def is_meaningful(tag: Tag) -> bool:
    try:
        text = tag.get_text(strip=True)
        return bool(text and len(text.split()) > 2)
    except Exception as e:
        gemini.logger.error(f"Error while checking if tag is meaningful: {e}")
        return False

def extract_article_data(url: str) -> dict | None:
    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "form", "svg"]):
            tag.decompose()
        target_tags = ["h1", "h2", "h3", "p", "pre", "code", "ul", "ol", "li", "blockquote"]
        body = soup.body or soup
        content = [str(tag) for tag in body.find_all(target_tags) if is_meaningful(tag)]
        if not content:
            print(f"No meaningful content found in {url}")
            return None
        markdown = html_to_markdown("\n".join(content)).strip()
        return {
            "url": url,
            "length": len(markdown),
            "markdown": markdown,
            "snippet": markdown[:500] + ("..." if len(markdown) > 500 else "")
        }
    except requests.RequestException as e:
        gemini.logger.error(f"[REQUEST ERROR] {url}: {e}")
    except Exception as e:
        gemini.logger.error(f"[ERROR] {url}: {e}")
    return None

def extract_all_articles(input_json: dict) -> dict:
    results = {"documentation": {}, "example": {}}
    doc_urls = input_json.get("documentation", [])
    ex_urls = input_json.get("example", [])
    
    def fetch_and_extract(url: str, results_dict: dict, key: str):
        try:
            gemini.logger.debug(f"Fetching {key} URL: {url}")
            data = extract_article_data(url)
            if data:
                gemini.logger.debug(f"Extracted data for {key} URL: {url}: {str(data)[:100]}")
                results_dict[key][url] = data
            else:
                gemini.logger.warning(f"No data extracted for {key} URL: {url}")
                results_dict[key][url] = {"error": "Extraction failed."}
        except Exception as e:
            gemini.logger.error(f"Error while processing {key} URL {url}: {e}")
            results_dict[key][url] = {"error": f"Exception occurred: {str(e)}"}
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(fetch_and_extract, url, results, "documentation")
            for url in doc_urls
        }
        futures.update(
            {executor.submit(fetch_and_extract, url, results, "example") for url in ex_urls}
        )
        concurrent.futures.wait(futures)
    return results


