import os
import logging
from concurrent.futures import ThreadPoolExecutor
import langchain
from langchain_community.cache import SQLiteCache
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai.embeddings import OpenAIEmbeddings
from langchain.memory import ConversationSummaryMemory
from ai.RL import RLAgent
from dotenv import load_dotenv
load_dotenv()

BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")
TOGETHER_API_KEY = os.getenv("TOGETHER_AI_API_KEY")

BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
ENV_FILE_PATH = ".env"

SHELL_TIMEOUT_SECONDS = 1500
RETRY_CHAIN = 1

modelType = None
providerName = None

if os.getenv("GOOGLE_API_KEY"):
    embedding_model = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    modelType = "lite"
    providerName = "gemini"
elif os.getenv("OPENAI_API_KEY"):
    embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")
    modelType = "lite"
    providerName = "chatgpt"
elif os.getenv("ANTHROPIC_API_KEY"):
    embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")
    modelType = "lite"
    providerName = "claude"
else:
    raise ValueError("You need to set either a Gemini embedding or OpenAI embedding, so either API, should work")

actions = ["accept", "reject"]
rl_agent = RLAgent(actions)

logging.basicConfig(filename="logs/app.log", level=logging.INFO)
logger = logging.getLogger(__name__)

quick_think = False
langchain.llm_cache = SQLiteCache(database_path="cache/langchain_cache.db")

chat_memories: dict[str, ConversationSummaryMemory] = {}
chat_memory_metadata: dict[str, dict] = {}

executor = ThreadPoolExecutor()
resource_vectorstore: FAISS = None

VALID_MODELS = {
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    "Qwen/Qwen3-235B-A22B-fp8-tput",
    "Qwen/QwQ-32B",
    "deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "deepseek-ai/DeepSeek-V3",
    "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    "meta-llama/Llama-Vision-Free",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct-Turbo",
    "mistralai/Mistral-Small-24B-Instruct-2501",
    "google/gemma-3-27b-it"
}