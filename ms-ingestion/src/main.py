from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.application.routes.ingest import router as ingest_router
from src.infrastructure.chroma_store import health_check as chroma_health
from src.infrastructure.db import close_pool, init_pool

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa y libera recursos al arrancar/apagar el servicio."""
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="ms-ingestion",
    description="Ingestión de documentos curriculares (PDF/DOCX/TXT) → ChromaDB para el pipeline RAG",
    version="2.0.0",
    lifespan=lifespan,
    # /docs está reservado para la ruta de lista de documentos; Swagger va a /swagger
    docs_url="/swagger",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)


@app.get("/health")
async def health():
    chroma_ok = chroma_health()
    return {
        "status": "ok",
        "service": "ms-ingestion",
        "chroma_connected": chroma_ok,
    }
