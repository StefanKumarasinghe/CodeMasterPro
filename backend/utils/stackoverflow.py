import httpx
import asyncio
from bs4 import BeautifulSoup
import json
from typing import List, Dict, Any, Optional
from functools import lru_cache

from ai.model_switcher import rank_chain, refine_search_stack_chain, cleaned_search_result_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini

shared_client = httpx.AsyncClient(timeout=15)

@lru_cache(maxsize=128)
async def refine_query(query: str) -> str:
    result = await invoke_with_retry(
        refine_search_stack_chain(
            model_type=gemini.modelType, 
            provider_type=gemini.providerName
        ), 
        {"query": query}
    )
    return result.content.strip()

async def search_stackoverflow(query: str, sort: str = 'votes') -> List[Dict[str, Any]]:
    try:
        refined_query = await refine_query(query)
        url = "https://api.stackexchange.com/2.3/search/advanced"
        params = {
            "order": "desc",
            "sort": sort,
            "q": refined_query,
            "accepted": True,
            "answers": 1,
            "views": 10,
            "site": "stackoverflow",
        }
        
        response = await shared_client.get(url, params=params)
        response.raise_for_status()
        return response.json().get("items", [])
    except Exception as e:
        gemini.logger.error(f"[ERROR] StackOverflow search failed: {e}")
        return []

async def rank_with_gemini(questions: List[Dict[str, Any]], user_query: str) -> List[Dict[str, Any]]:
    try:
        if not questions:
            return []
        
        return questions

    except Exception as e:
        gemini.logger.error(f"[ERROR] Ranking failed: {e}")
        return questions

async def get_top_answer(question_id: int) -> Optional[Dict[str, Any]]:
    try:
        url = f"https://api.stackexchange.com/2.3/questions/{question_id}/answers"
        params = {
            "order": "desc",
            "sort": "votes",
            "site": "stackoverflow",
            "filter": "withbody"
        }
        
        res = await shared_client.get(url, params=params)
        res.raise_for_status()
        
        items = res.json().get("items", [])
        return items[0] if items else None
    except Exception as e:
        gemini.logger.error(f"[ERROR] Failed to get top answer for question {question_id}: {e}")
        return None

async def clean_html_answer(answer_html: str) -> str:
    return BeautifulSoup(answer_html, "html.parser").get_text()

async def process_answer(answer: Optional[Dict[str, Any]], user_query: str) -> str:
    if not answer:
        return "No answer found, please use your own knowledge"
    
    try:
        plain_text = await clean_html_answer(answer["body"])
        if not plain_text:
            return "No content to clean."
            
        result = await invoke_with_retry(
            cleaned_search_result_chain(
                model_type=gemini.modelType, 
                provider_type=gemini.providerName
            ), 
            {
                "answer": plain_text,
                "query": user_query
            }
        )
        
        return result.content.strip()
    except Exception as e:
        gemini.logger.error(f"[ERROR] Processing answer failed: {e}")
        return plain_text if 'plain_text' in locals() else "Error processing answer"

async def search_stackoverflow_and_rank(user_query: str) -> List[Dict[str, str]]:
    questions = await search_stackoverflow(user_query)
    if not questions:
        return []
        
    ranked_questions = await rank_with_gemini(questions, user_query)
    
    tasks = [
        asyncio.create_task(get_top_answer(q["question_id"])) 
        for q in ranked_questions[:5]
    ]
    
    answers = await asyncio.gather(*tasks)
    
    answer_processing_tasks = [
        asyncio.create_task(process_answer(answer, user_query))
        for answer in answers
    ]
    
    processed_answers = await asyncio.gather(*answer_processing_tasks)
    return [
        {
            "title": q["title"],
            "answer": answer
        }
        for q, answer in zip(ranked_questions[:5], processed_answers)
    ]

async def close_client():
    await shared_client.aclose()