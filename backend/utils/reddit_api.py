import os
import httpx
import asyncio
from typing import List, Dict
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from ai.model_switcher import rank_chain, cleaned_search_result_chain, refine_search_chain, reference_check_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini

load_dotenv()

REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "RedditSearchBot/0.1")

shared_client = httpx.AsyncClient(timeout=15)

async def search_reddit(query: str) -> List[Dict[str, str]]:
    famous_subreddits = [
        "learnprogramming", "technology", "programming", "Python", "coding",
        "AskReddit", "developers", "webdev", "MachineLearning", "computerscience"
    ]

    try:
        refined_query = await invoke_with_retry(
            refine_search_chain(
                model_type=gemini.modelType,
                provider_type=gemini.providerName
            ),
            {"query": query}
        )
        query = refined_query.content.strip()

        headers = {
            "User-Agent": REDDIT_USER_AGENT,
        }

        for subreddit in famous_subreddits:
            params = {
                "q": query,
                "sort": "relevance",
                "limit": 5,
                "restrict_sr": True,
            }
            url = f"https://www.reddit.com/r/{subreddit}/search.json"

            try:
                resp = await shared_client.get(url, headers=headers, params=params)
                resp.raise_for_status()
                posts = resp.json().get("data", {}).get("children", [])

                if not posts:
                    continue

                response_text = "\n".join(
                    f"{i+1}. {post['data']['title']} — {post['data'].get('selftext', '')[:200]}"
                    for i, post in enumerate(posts)
                )

                relevance_check = await invoke_with_retry(
                    reference_check_chain(
                        model_type=gemini.modelType,
                        provider_type=gemini.providerName
                    ),
                    {"result": response_text, "query": query}
                )

                if "correct" in relevance_check.content.lower():
                    return [
                        {
                            "title": post["data"]["title"],
                            "body": post["data"].get("selftext", ""),
                            "score": post["data"]["score"],
                            "url": f"https://reddit.com{post['data']['permalink']}"
                        }
                        for post in posts
                    ]

            except Exception as inner_e:
                gemini.logger.warning(f"[WARN] Failed on subreddit '{subreddit}': {inner_e}")
                continue

        return []

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
        # Extract the question IDs and convert them to indices
        ranked_indices = [int(q.question_id) - 1 for q in result.ranked_questions]
        return [posts[i] for i in ranked_indices if i < len(posts)]
    except Exception as e:
        gemini.logger.error(f"[ERROR] Ranking failed: {e}")
        return posts[:3]

async def search_reddit_and_rank(query: str) -> Dict[str, str]:
    posts = await search_reddit(query)
    if not posts:
        return []
    ranked = await rank_reddit_posts(posts, query)
    cleaned_answers = await asyncio.gather(*[
        process_answer(post["body"], query) for post in ranked
    ])

    return {"reddit_resource": cleaned_answers}
    
async def close_client():
    await shared_client.aclose()
