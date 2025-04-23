import config.tars as gemini
import html2text
import requests
import aiohttp
from typing import List
from bs4 import BeautifulSoup, Tag
from utils.invoke_retry import invoke_with_retry
from Prompts.prompts import refine_search_chain

BASE_URL = gemini.BRAVE_URL
API_KEY = gemini.BRAVE_API_KEY

async def brave_search(query: str, count: int = 3) -> List[dict]:
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": API_KEY,
    }
    result = await invoke_with_retry(refine_search_chain, {"query": query})

    if result:
        query = result["text"].strip()
    
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
            print(f"[Brave Search Error] {e}")
            return []

def html_to_markdown(html_content: str) -> str:
    converter = html2text.HTML2Text()
    converter.ignore_links = True
    converter.body_width = 0
    converter.skip_internal_links = True
    converter.ignore_images = True
    converter.inline_links = False
    return converter.handle(html_content)

def is_meaningful(tag: Tag) -> bool:
    text = tag.get_text(strip=True)
    return bool(text and len(text.split()) > 2)

def extract_article_data(url: str) -> dict | None:
    try:
        response = requests.get(url, timeout=10)
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
        print(f"[NETWORK ERROR] {url}: {e}")
    except Exception as e:
        print(f"[PROCESSING ERROR] {url}: {e}")
    return None

def extract_all_articles(input_json: dict) -> dict:
    results = {"documentation": {}, "example": {}}
    doc_urls = input_json.get("documentation", [])
    ex_urls = input_json.get("example", [])
    for url in doc_urls:
        print(f"→ Fetching documentation: {url}")
        doc_data = extract_article_data(url)
        results["documentation"][url] = doc_data if doc_data else {"error": "Extraction failed."}
    for url in ex_urls:
        print(f"→ Fetching example: {url}")
        ex_data = extract_article_data(url)
        results["example"][url] = ex_data if ex_data else {"error": "Extraction failed."}
    return results


