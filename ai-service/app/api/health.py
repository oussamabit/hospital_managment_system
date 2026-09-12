"""health.py — endpoint للتحقق من حالة الخدمة"""
from fastapi import APIRouter
from loguru import logger
import ollama

from app.core.config import settings
from app.services.embedding_service import EmbeddingService
from app.services.mongo_service import MongoService
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    فحص شامل لجاهزية الخدمة
    يتحقق من: Ollama, Embedding Model, ChromaDB, MongoDB
    """

    # فحص Ollama
    ollama_ok = False
    try:
        models = ollama.list()
        model_names = [m["name"] for m in models.get("models", [])]
        ollama_ok = any(settings.ollama_model in n for n in model_names)
    except Exception as e:
        logger.warning(f"Ollama check failed: {e}")

    # فحص ChromaDB
    chroma_status = "unavailable"
    try:
        stats = EmbeddingService.get_stats()
        chroma_status = f"ok ({stats.get('total_chunks', 0)} chunks)"
    except Exception as e:
        chroma_status = f"error: {e}"

    # فحص MongoDB
    mongo_status = "unavailable"
    try:
        db = MongoService.get_db()
        await db.command("ping")
        mongo_status = "ok"
    except Exception as e:
        mongo_status = f"error: {e}"

    return HealthResponse(
        status="ok" if ollama_ok else "degraded",
        ollama_available=ollama_ok,
        ollama_model=settings.ollama_model,
        embedding_model=settings.embedding_model,
        chroma_db=chroma_status,
        mongodb=mongo_status,
    )
