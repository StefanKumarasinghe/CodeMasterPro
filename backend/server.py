# Developed by Stefan Ralph Kumarasinghe
# TARS is an open-source AI assistant that can be used for various tasks such as document retrieval, question answering, and more. It is designed to be fast, efficient, and easy to use.
# Powered by LangChain, Google Gemini
# Added and RL agent for better performance and accuracy
# FAISS vector store for fast retrieval and search of documents
# SQLite cache for efficient caching of results
# FastAPI for building the API
# OpenTelemetry for monitoring and tracing

import os
import glob
import asyncio
import aiofiles
from shell import run_python_code, init_python_session, close_python_session
from aiomultiprocess import Pool
import hashlib
from functools import lru_cache
from pydantic import BaseModel
from tenacity import AsyncRetrying, wait_exponential, stop_after_attempt
from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from concurrent.futures import ThreadPoolExecutor
from slowapi.util import get_remote_address
from prometheus_fastapi_instrumentator import Instrumentator
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from dotenv import load_dotenv
from MessageBody import MessageRequest
from prompts import process_chain, refinement_chain, validation_chain
from feedback import save_resource, flag_bad_input
from langchain_google_genai import GoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.memory import ConversationSummaryMemory
from langchain_community.cache import SQLiteCache
import langchain
from RL import RLAgent 
import logging
from memory import get_chat_memory
import random
logging.basicConfig(filename='app.log',level=logging.INFO)
logger = logging.getLogger(__name__)
from sentence_transformers import SentenceTransformer, CrossEncoder
from SessionPayload import SessionPayload
from CodePayload import CodePayload
import os


load_dotenv()

os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
global gemini_llm
gemini_llm = GoogleGenerativeAI(model="gemini-2.5-pro-exp-03-25", temperature=0.6)
embedding_model = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
st_embedder = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
langchain.llm_cache = SQLiteCache(database_path="./langchain_cache.db")
chat_memories: dict[str, ConversationSummaryMemory] = {}
chat_memory_metadata: dict[str, dict] = {}
executor = ThreadPoolExecutor()

resource_vectorstore: FAISS | None = None
actions = ["accept", "reject"]
rl_agent = RLAgent(actions)

app = FastAPI(title="--Developed by Stefan Ralph Kumarasinghe")
FastAPIInstrumentor.instrument_app(app)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
Instrumentator().instrument(app).expose(app)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(f"Rate limit exceeded for {request.client.host}")
    return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)

async def load_documents_from_folder(folder_path: str,file_types: tuple = ( "*.txt", "*.md", "*.html", "*.csv", "*.py", "*.js", "*.ts", "*.java", "*.cpp", "*.c", "*.cs", "*.go", "*.rs" )) -> list[Document]:
    docs: list[Document] = []
    for pattern in file_types:
        for path in glob.glob(os.path.join(folder_path, pattern)):
            try:
                async with aiofiles.open(path, "r", encoding="utf-8") as f:
                    content = await f.read()
                    docs.append(Document(page_content=content, metadata={"source": path}))
            except Exception:
                logger.error(f"Error reading file {path}")
                continue
    return docs

async def _split_document(doc: Document) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=200)
    return splitter.split_documents([doc])

async def _build_index():
    global resource_vectorstore
    print("Building vector index...")
    docs = await load_documents_from_folder("resources")
    async with Pool() as pool:
        chunks_lists = await pool.map(_split_document, docs)
    chunks = [c for sub in chunks_lists for c in sub]
    if not chunks:
        return "No documents to index."
    try:
        logger.info("Creating FAISS index...")
        resource_vectorstore = FAISS.from_documents(chunks, embedding_model)
        resource_vectorstore.index.nprobe = 64 
        logger.info("Index built with IVF index.")
    except Exception as e:
        logger.error(f"Failed to create IVF index: {e}.")
        try:
            resource_vectorstore = FAISS.from_documents(chunks, embedding_model)
            resource_vectorstore.index.hnsw.efSearch = 512
            print("Index built with HNSW32,Flat.")
        except Exception as e:
            logger.error(f"Failed to create HNSW index: {e}.")
            return "Failed to build index."
    resource_vectorstore.save_local("index_store/")
    logger.info("Index saved to disk.")

@app.on_event("startup")
async def on_startup():
    asyncio.create_task(_build_index())

@lru_cache(maxsize=1024)
def cached_search(query: str, k: int):
    query_hash = hashlib.md5(query.encode()).hexdigest()
    return resource_vectorstore.similarity_search(query_hash, k)

async def search_resources(query: str, k: int = 5) -> str:
    global resource_vectorstore
    if resource_vectorstore is None:
        try:
            resource_vectorstore = FAISS.load_local("index_store/", embedding_model, allow_dangerous_deserialization=True)
        except Exception as e:
            logger.error(f"Failed to load vector store: {e}")
            return "Vector store not available. Please reindex resources first."

    try:
        docs = await asyncio.to_thread(cached_search, query, k)  
        if not docs:
            return "No matching documents found."
        pairs = [(query, d.page_content) for d in docs]
        scores = await asyncio.to_thread(cross_encoder.predict, pairs)
        ranked = [docs[i] for i in sorted(range(len(scores)), key=lambda i: -scores[i])]
        return "\n".join(
            f"### Source: {d.metadata.get('source', 'unknown')}\n{d.page_content}"
            for d in ranked[:k]
        )
    except Exception as e:
        print(f"Search error: {e}")
        return "An error occurred during semantic search."

async def invoke_with_retry(chain, inputs: dict):
    async for attempt in AsyncRetrying(
        wait=wait_exponential(min=1, max=5),
        stop=stop_after_attempt(3),
    ):
        with attempt:
            return await chain.ainvoke(inputs)

def compute_reward(agent, action_index, response: str, query: str, val_score: int) -> float:
    try:
        q_emb = st_embedder.encode(query, convert_to_tensor=True)
        a_emb = st_embedder.encode(response, convert_to_tensor=True)
        sim = float((q_emb @ a_emb).cpu()) 
        sim_scaled = sim ** 2 * 10  
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        sim_scaled = 0.0
    noise = random.gauss(0, 0.5)
    reward = sim_scaled + noise
    if len(response) > 3000 and response.strip():
        reward -= 1
    if val_score < 8:
        reward -= (8 - val_score) * 0.5  
    reward = max(min(reward, 20), -10)
    agent.update_q_value(action_index, reward)
    return reward


@app.post("/process/")
@limiter.limit("5/minute")
async def process_message(request: Request):
    try:
        payload = await request.json()
        msg = MessageRequest(**payload)
        mem = get_chat_memory(msg.chatId)
        history = mem.load_memory_variables({})["history"]
        resources = await search_resources(msg.message)
        best_avg_score = -float("inf")
        best_answer = None
        for iteration in range(5):
            logger.info(f"Iteration {iteration + 1}: Processing message...")
            try:
                out1 = await invoke_with_retry(process_chain, {
                    "history": history,
                    "query": msg.message,
                    "resources": resources,
                    **msg.dict(exclude={"chatId"})
                })
                draft = out1["text"].strip()
            except Exception as e:
                logger.error(f"Iteration {iteration + 1}: process_chain error: {e}")
                continue
            try:
                out2 = await invoke_with_retry(refinement_chain, {
                    "draft": draft,
                    **msg.dict(exclude={"chatId"})
                })
                refined = out2["text"].strip()
            except Exception as e:
                logger.error(f"Iteration {iteration + 1}: refinement_chain error: {e}")
                continue
            try:
                out3 = await invoke_with_retry(validation_chain, {
                    "response": refined,
                    "query": msg.message,
                     **msg.dict(exclude={"chatId"})
                })
            
                val_text = out3["text"].strip()
                logger.info(f"Iteration {iteration + 1}: Validation chain output: {val_text}")
                try:
                    val_score = int(val_text)
                except Exception:
                    logger.error(f"Iteration {iteration + 1}: Failed to convert validation score: {val_text}")
                    val_score = 5
            except Exception as e:
                logger.error(f"Iteration {iteration + 1}: validation_chain error: {e}")
                val_score = 5
            action = rl_agent.select_action()
            reward = compute_reward(rl_agent, actions.index(action), refined, msg.message, val_score)
            composite = reward + val_score
            avg_score = (composite + val_score + reward) / 3
            logger.info(
                f"Iteration {iteration + 1}: Action: {action} | "
                f"Val Score: {val_score} | Reward: {reward:.2f} | "
                f"Composite: {composite:.2f} | Avg Score: {avg_score:.2f}"
            )
            if avg_score > best_avg_score:
                best_avg_score = avg_score
                best_answer = refined
            if action == "accept" and val_score >= 9:
                mem.save_context({"input": msg.message}, {"output": refined})
                return {
                    "input": msg.message,
                    "result": refined,
                    "chatId": msg.chatId
                }
            
        return {
            "input": msg.message,
            "result": f"\n{best_answer}",
            "chatId": msg.chatId
        }
    except Exception as e:
        logger.error(f"Error in process_message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add_resource/")
@limiter.limit("3/minute")
async def add_resource(request: Request, content: str = Body(..., embed=True)):
    try:
        result = await save_resource(content, "resources")
        reward = 5.0
        rl_agent.update_q_value(actions.index("accept"), reward)
        return result
    except Exception as e:
        rl_agent.update_q_value(actions.index("reject"), -1.0)
        logger.error(f"Error in add_resource: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/flag_bad_input/")
@limiter.limit("3/minute")
async def flag_bad_input_endpoint(request: Request, content: str = Body(..., embed=True)):
    try:
        result = await flag_bad_input(request, content)
        punishment = -5.0
        rl_agent.update_q_value(actions.index("reject"), punishment)
        return result
    except Exception as e:
        logger.error(f"Error in flag_bad_input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/memory/clear")
@limiter.limit("1/minute")
async def clear_memory(request: Request):
    chat_memories.clear()
    return {"message": "Cleared all chat memories."}

@app.post("/reindex/")
@limiter.limit("1/minute")
async def reindex(request: Request):
    await _build_index()
    return {"message": "Resources reindexed successfully."}

@app.get("/")
@limiter.limit("5/minute")
async def root(request: Request):
    return {"message": "Ultra Optimized RAG Service is running!"}


class ModelRequest(BaseModel):
    model: str

@app.post("/change_model/")
@limiter.limit("3/minute")
async def change_model(request:Request, req: ModelRequest):
    global gemini_llm
    if req.model.lower() == "fast":
        gemini_llm = GoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.6)
        return {"message": "Switched to fast model (gemini-2.0-flash)"}
    elif req.model.lower() == "advanced":
        gemini_llm = GoogleGenerativeAI(model="gemini-2.5-pro-exp-03-25", temperature=0.6)
        return {"message": "Switched to advanced model (gemini-2.5-pro-exp-03-25)"}
    else:
        raise HTTPException(status_code=400, detail="Invalid model specified. Use 'fast' or 'advanced'.")

@app.get("/current_model")
@limiter.limit("10/minute")
async def get_current_model(request: Request):
    try:
        model_name = gemini_llm.model
        return {"current_model": model_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not retrieve current model: {e}")
    

@app.post("/run_python_code")
@limiter.limit("60/minute")
async def run_code(request: Request, payload: CodePayload):
    try:
        return await run_python_code(payload)
    except Exception as e:
        logger.error(f"Error in run_code: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute Python code.")

@app.post("/init_python_session")
@limiter.limit("60/minute")
async def init_session(request: Request):
    try:
        return await init_python_session(request)
    except Exception as e:
        logger.error(f"Error in init_session: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize Python session.")

@app.post("/close_python_session")
@limiter.limit("60/minute")
async def close_session(request: Request, payload: SessionPayload):
    try:
        return await close_python_session(payload)
    except Exception as e:
        logger.error(f"Error in close_session: {e}")
        raise HTTPException(status_code=500, detail="Failed to close Python session.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
