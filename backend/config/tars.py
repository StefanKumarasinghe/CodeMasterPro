
import os
import logging
from ai.RL import RLAgent 
from concurrent.futures import ThreadPoolExecutor
from langchain_community.vectorstores import FAISS
from sentence_transformers import SentenceTransformer, CrossEncoder
from langchain_community.cache import SQLiteCache
from langchain.memory import ConversationSummaryMemory
from langchain_google_genai import GoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv
import langchain

load_dotenv()

os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
 
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

gemini_llm = GoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.9)

actions = ["accept", "reject"]

rl_agent = RLAgent(actions)

logging.basicConfig(filename='logs/app.log',level=logging.INFO)

logger = logging.getLogger(__name__)

embedding_model = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

SHELL_TIMEOUT_SECONDS = 300


RETRY_CHAIN=1

web_flag_state = {"enabled": False}

web_stack_state = {"enabled": False}

internal_stack_state = {"enabled": False}

st_embedder = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')

cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

langchain.llm_cache = SQLiteCache(database_path="cache/langchain_cache.db")

chat_memories: dict[str, ConversationSummaryMemory] = {}

chat_memory_metadata: dict[str, dict] = {}

executor = ThreadPoolExecutor()

resource_vectorstore: FAISS = None