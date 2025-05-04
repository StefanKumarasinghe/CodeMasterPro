import os
import logging
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
import langchain
from langchain_community.cache import SQLiteCache
from langchain_community.vectorstores import FAISS
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.memory import ConversationSummaryMemory
from ai.RL import RLAgent

load_dotenv(override=True)

os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")

BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
ENV_FILE_PATH = ".env"
SHELL_TIMEOUT_SECONDS = 300
RETRY_CHAIN = 1

gemini_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.9)
embedding_model = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

actions = ["accept", "reject"]
rl_agent = RLAgent(actions)

logging.basicConfig(filename="logs/app.log", level=logging.INFO)
logger = logging.getLogger(__name__)
quick_think = False
langchain.llm_cache = SQLiteCache(database_path="cache/langchain_cache.db")

web_flag_state = {"enabled": False}
web_stack_state = {"enabled": False}
internal_stack_state = {"enabled": False}

chat_memories: dict[str, ConversationSummaryMemory] = {}
chat_memory_metadata: dict[str, dict] = {}

executor = ThreadPoolExecutor()
resource_vectorstore: FAISS = None