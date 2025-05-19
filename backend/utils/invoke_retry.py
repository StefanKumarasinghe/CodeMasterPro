from tenacity import AsyncRetrying, wait_exponential, stop_after_attempt, retry_if_exception_type
import config.tars as gemini

async def invoke_with_retry(chain, inputs: dict):
    async for attempt in AsyncRetrying(wait=wait_exponential(min=1, max=5),stop=stop_after_attempt(3),retry=retry_if_exception_type(Exception), reraise=True):
        with attempt:
            try:
                if chain is not None:
                    return await chain.ainvoke(inputs)
                else:
                    return None
            except Exception as e:
                gemini.logger.warning(f"Attempt {attempt.retry_state.attempt_number} failed: {e}")
                raise 

