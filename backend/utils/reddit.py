import os
import httpx
import asyncio
from typing import List, Dict
from functools import lru_cache
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from ai.model_switcher import rank_chain, cleaned_search_result_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini

load_dotenv()

REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "RedditSearchBot/0.1")

shared_client = httpx.AsyncClient(timeout=15)

@lru_cache(maxsize=1)
async def get_reddit_token() -> str:
    auth = httpx.BasicAuth(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET)
    headers = {"User-Agent": REDDIT_USER_AGENT}
    data = {"grant_type": "client_credentials"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://www.reddit.com/api/v1/access_token",
            data=data,
            auth=auth,
            headers=headers
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

async def search_reddit(query: str, subreddit: str = "learnprogramming") -> List[Dict[str, str]]:
    try:
        token = await get_reddit_token()
        headers = {
            "Authorization": f"bearer {token}",
            "User-Agent": REDDIT_USER_AGENT,
        }
        params = {
            "q": query,
            "sort": "relevance",
            "limit": 5,
            "restrict_sr": True,
        }
        url = f"https://oauth.reddit.com/r/{subreddit}/search"
        resp = await shared_client.get(url, headers=headers, params=params)
        resp.raise_for_status()

        posts = resp.json().get("data", {}).get("children", [])
        return [
            {
                "title": post["data"]["title"],
                "body": post["data"].get("selftext", ""),
                "score": post["data"]["score"],
                "url": f"https://reddit.com{post['data']['permalink']}"
            }
            for post in posts
        ]
    except Exception as e:
        gemini.logger.error(f"[ERROR] Reddit search failed: {e}")
        return []

async def clean_html(text: str) -> str:
    return BeautifulSoup(text, "html.parser").get_text()

async def process_answer(body: str, query: str) -> str:
    try:
        result = await invoke_with_retry(
            cleaned_search_result_chain(
                model_type=gemini.modelType,
                provider_type=gemini.providerName
            ),
            {"answer": body, "query": query}
        )
        return result.content.strip()
    except Exception as e:
        gemini.logger.error(f"[ERROR] Answer cleaning failed: {e}")
        return await clean_html(body)

async def rank_reddit_posts(posts: List[Dict[str, str]], query: str) -> List[Dict[str, str]]:
    if not posts:
        return []

    post_texts = "\n".join(
        f"{i+1}. {post['title']} (Score: {post['score']})" for i, post in enumerate(posts)
    )

    try:
        result = await invoke_with_retry(
            rank_chain(
                model_type=gemini.modelType,
                provider_type=gemini.providerName
            ),
            {"query": query, "questions": post_texts}
        )
        ranked_indices = result.ranked_questions
        return [posts[i] for i in ranked_indices if i < len(posts)]
    except Exception as e:
        gemini.logger.error(f"[ERROR] Ranking failed: {e}")
        return posts[:3]

async def search_reddit_and_rank(query: str) -> List[Dict[str, str]]:
    posts = await search_reddit(query)
    if not posts:
        return []

    ranked = await rank_reddit_posts(posts, query)
    cleaned_answers = await asyncio.gather(*[
        process_answer(post["body"], query) for post in ranked
    ])

    return [
        {"title": post["title"], "url": post["url"], "answer": answer}
        for post, answer in zip(ranked, cleaned_answers)
    ]

async def close_client():
    await shared_client.aclose()
