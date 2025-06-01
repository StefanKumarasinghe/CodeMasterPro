from ai.model_switcher import recommendation_chain
from utils.invoke_retry import invoke_with_retry
import config.tars as gemini

_cached_chain = None

def get_cached_recommendation_chain():
    global _cached_chain
    if _cached_chain is None:
        _cached_chain = recommendation_chain(
            model_type="lite",
            provider_type=gemini.providerName
        )
    return _cached_chain

async def get_recommendation(query: str, history: list, recent_messages: list):
    if not query or len(query.strip()) < 20:
        return []

    try:
        chain = get_cached_recommendation_chain()

        response = await invoke_with_retry(chain, {
            "query": query,
            "history": history,
            "recent_messages": recent_messages
        })

        suggestion = response.content.strip()

        if suggestion and suggestion != query and not query.endswith(suggestion):
            return [suggestion]
        return []

    except Exception as e:
        print(f"Error getting recommendations: {e}")
        return []
