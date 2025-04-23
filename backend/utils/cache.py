from functools import lru_cache
import hashlib
import config.tars as gemini

@lru_cache(maxsize=1024)
def cached_search(query: str, k: int):
    try:
        query_hash = hashlib.md5(query.encode()).hexdigest()
        return gemini.resource_vectorstore.similarity_search(query_hash, k)
    except Exception as e:
        gemini.logger.error(f"Error in cached_search: {e}")
        raise RuntimeError("Failed to perform cached search.")
