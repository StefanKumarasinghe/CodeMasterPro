from tenacity import AsyncRetrying, wait_exponential, stop_after_attempt, retry_if_exception_type
import logging
logger = logging.getLogger(__name__)
async def invoke_with_retry(chain, inputs: dict):
    async for attempt in AsyncRetrying(
        wait=wait_exponential(min=1, max=5),
        stop=stop_after_attempt(3),
        retry=retry_if_exception_type(Exception), 
        reraise=True,  
    ):
        with attempt:
            try:
                return await chain.ainvoke(inputs)
            except Exception as e:
                logger.warning(f"Attempt {attempt.retry_state.attempt_number} failed: {e}")
                raise 