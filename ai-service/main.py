"""
main.py — نقطة دخول FastAPI AI Service
يشتغل على المنفذ 8000 بجانب Node.js backend على 5005
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger

from app.core.config import settings
from app.api import analyze, health, dicom_convert


@asynccontextmanager
async def lifespan(app: FastAPI):
    """تشغيل عند البدء — تهيئة النماذج"""
    logger.info("AI Service starting...")
    logger.info(f"Ollama model: {settings.ollama_model}")
    logger.info(f"Embedding model: {settings.embedding_model}")
    logger.info(f"ChromaDB path: {settings.chroma_persist_dir}")

    # تحميل النماذج عند البدء (مرة واحدة فقط)
    from app.services.embedding_service import EmbeddingService
    await EmbeddingService.initialize()
    logger.info("Embedding model loaded successfully")

    yield

    logger.info("AI Service shutting down...")


app = FastAPI(
    title="Hospital AI Service",
    description="RAG-based medical dossier analysis — 100% local",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — السماح لـ React frontend بالاتصال
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # React fallback
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(analyze.router, prefix="/api/ai", tags=["AI Analysis"])
app.include_router(dicom_convert.router, tags=["DICOM"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.ai_service_host,
        port=settings.ai_service_port,
        reload=True,
        log_level="info",
    )
