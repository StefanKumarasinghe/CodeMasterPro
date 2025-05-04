import httpx
import asyncio
from bs4 import BeautifulSoup
from Prompts.prompts import rank_chain, refine_search_stack_chain, cleaned_search_result_chain
from utils.invoke_retry import invoke_with_retry
import json
import config.tars as gemini
from utils.updates import set_update

shared_client = httpx.AsyncClient(timeout=15)

async def search_stackoverflow(query, sort='votes'):
    try:
        refine_query = await invoke_with_retry(refine_search_stack_chain, {"query": query})
        refine_query = refine_query.content.strip()
        url = "https://api.stackexchange.com/2.3/search/advanced"
        params = {
            "order": "desc",
            "sort": sort,
            "q": refine_query,
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

async def rank_with_gemini(questions, user_query):
    question_texts = "\n".join([f"{i+1}. {q['title']} (ID: {q['question_id']})" for i, q in enumerate(questions)])
    prompt_input = {
        "query": user_query,
        "questions": question_texts
    }
    try:
        result = await invoke_with_retry(rank_chain, prompt_input)  
        response = result.content.strip()
        response = response.replace("```json", "").replace("```", "")
        clean_json = response
        parsed = json.loads(clean_json)
        ranked_indices = parsed["ranked_questions"]
        return ranked_indices

    except Exception as e:
        gemini.logger.error(f"[ERROR] Ranking failed: {e}")
        return questions[:5]

async def get_top_answer(question_id):
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

async def clean_html_answer(answer_html):
    return BeautifulSoup(answer_html, "html.parser").get_text()

async def search_stackoverflow_and_rank(user_query):
    questions = await search_stackoverflow(user_query)
    await set_update("Fetching StackOverflow results")
    if not questions:
        return []
    ranked_questions = await rank_with_gemini(questions, user_query)
    tasks = [get_top_answer(q["question_id"]) for q in ranked_questions[:5]]
    answers = await asyncio.gather(*tasks)
    cleaned_results = []
    for q, a in zip(ranked_questions[:5], answers):
        if not a:
            answer_text = "No answer found, please use your own knowledge"
        else:
            plain_text = await clean_html_answer(a["body"])
            if plain_text:
                try:
                    result = await invoke_with_retry(cleaned_search_result_chain, {
                        "answer": plain_text,
                        "query": user_query
                    })
                    answer_text = result.content.strip()
                except Exception:
                    gemini.logger.error(f"[ERROR] Cleaning answer failed: {e}")
                    answer_text = plain_text
            else:
                answer_text = "No content to clean."
        cleaned_results.append({
            "title": q["title"],
            "answer": answer_text
        })

    return cleaned_results
