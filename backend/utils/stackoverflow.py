import httpx
from bs4 import BeautifulSoup
from Prompts.prompts import rank_chain, refine_search_stack_chain, cleaned_search_result_chain
from utils.invoke_retry import invoke_with_retry
import json

async def search_stackoverflow(query, sort='votes'):
    refine_query = await invoke_with_retry(refine_search_stack_chain, {"query": query})
    print(refine_query)
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
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json().get('items', [])
    except Exception as e:
        print(f"[ERROR] StackOverflow search failed: {e}")
        return []

async def rank_with_gemini(questions, user_query):
    question_texts = "\n".join([f"{i+1}. {q['title']} (ID: {q['question_id']})" for i, q in enumerate(questions)])
    prompt_input = {
        "query": user_query,
        "questions": question_texts
    }
    try:
        result = await invoke_with_retry(rank_chain, prompt_input)  
        response = result["text"].strip()
        response = response.replace("```json", "").replace("```", "").strip()
        clean_json = response
        parsed = json.loads(clean_json)
        ranked_indices = parsed["ranked_questions"]
        return ranked_indices

    except Exception as e:
        print(f"[ERROR] Failed to parse Gemini ranking response: {e}")
        print(f"[DEBUG] Raw response: {response}")
        return questions[:5]

async def get_top_answer(question_id):
    url = f"https://api.stackexchange.com/2.3/questions/{question_id}/answers"
    params = {
        "order": "desc",
        "sort": "votes",
        "site": "stackoverflow",
        "filter": "withbody"
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, params=params)
            res.raise_for_status()
            items = res.json().get("items", [])
            return items[0] if items else None
    except Exception as e:
        print(f"[ERROR] Failed to fetch answers: {e}")
        return None

async def clean_html_answer(answer_html):
    text = BeautifulSoup(answer_html, "html.parser").get_text()
    return text

async def search_stackoverflow_and_rank(user_query):
    questions = await search_stackoverflow(user_query)
    if not questions:
        return []
    ranked_questions = await rank_with_gemini(questions, user_query)
    top_answers = []
    for question in ranked_questions[:5]:
        answer = await get_top_answer(question["question_id"])
        if answer:
            cleaned_answer = await clean_html_answer(answer["body"])
            if cleaned_answer:
                cleaned_answer = await invoke_with_retry(cleaned_search_result_chain, {"answer": cleaned_answer, "query": user_query})
            else:
                cleaned_answer = "No answer found, please use your own knowledge"
            top_answers.append({
                "title": question["title"],
                "answer": cleaned_answer
            })
    
    return top_answers 
