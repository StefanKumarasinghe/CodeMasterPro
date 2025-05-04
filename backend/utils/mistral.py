import requests
import config.tars as gemini

API_URL = "https://api.together.xyz/v1/chat/completions"
API_MODEL_KEY = gemini.TOGETHER_API_KEY

async def chat_with_model(model: str = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", message: str = " ", user_input: str =" ") -> str:
    headers = {
        "Authorization": f"Bearer {API_MODEL_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": user_input[:100]},
            {"role": "system", "content": message [:6000]},
            {"role": "system", "content": "YOUR ROLE IS TO REASON AND GIVE OPTIMAL ANSWERS, SNIPPETS, OR EXAMPLES. AND REASONING OF THE FULL REQUIREMENTS NEEDED TO SOLVE THE PROBLEM. DO NOT GIVE A FINAL ANSWER WITHOUT REASONING."},
        ],
        "temperature": 1,
        "max_tokens": 7000,
    }
    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        if response.status_code == 200:
            return response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        else:
            return f"Error: {response.status_code} - {response.text}"
    except requests.exceptions.RequestException as e:
        gemini.logger.error(f"Request failed: {e}")
        return "Error: Failed to reach the Together AI API"
