import aiohttp
import config.tars as gemini
import json

API_URL = "https://api.together.xyz/v1/chat/completions"
API_MODEL_KEY = gemini.TOGETHER_API_KEY

async def chat_with_model(message: str, user_input: str, model_name: str) -> str:
    headers = {
        "Authorization": f"Bearer {API_MODEL_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model_name,
        "messages": [
            {"role": "user", "content": user_input[:100]},
            {"role": "system", "content": message [:6000]},
            {"role": "system", "content": "YOUR ROLE IS TO REASON AND GIVE OPTIMAL ANSWERS, SMALL SNIPPETS, OR EXAMPLES. AND REASONING OF THE FULL REQUIREMENTS NEEDED TO SOLVE THE PROBLEM. DO NOT GIVE A FINAL ANSWER WITHOUT REASONING. Think about all edge cases and scenarios. And question all the requirements that need to be met."},
        ],
        "temperature": 1,
        "max_tokens": 7000,
    }
    timeout = aiohttp.ClientTimeout(total=120)

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(API_URL, headers=headers, json=payload) as response:
                response_text = await response.text()
                if response.status == 200:
                    try:
                        data = json.loads(response_text)
                        return data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    except json.JSONDecodeError as e:
                        gemini.logger.error(f"JSON decoding failed for {API_URL}: {e}. Response body: {response_text[:500]}...")
                        return f"Error: Failed to parse API response. Details: {e}"
                else:
                    gemini.logger.error(f"API Error from {API_URL}: Status {response.status} - {response_text[:500]}...")
                    return f"Error: API returned status {response.status} - {response_text}"

    except aiohttp.ClientError as e:
        gemini.logger.error(f"aiohttp client error for {API_URL}: {e}")
        return f"Error: Network or client issue reaching {API_URL}. Details: {e}"
    except Exception as e:
         gemini.logger.error(f"An unexpected error occurred calling {API_URL}: {e}")
         return f"Error: An unexpected error occurred. Details: {e}"