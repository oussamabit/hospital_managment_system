"""
config.py — إعدادات مركزية للـ AI Service
تُقرأ من ملف .env تلقائياً
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "hospital_db"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral"

    # Embedding
    embedding_model: str = (
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )

    # ChromaDB
    chroma_persist_dir: str = "./data/chroma_db"
    chroma_collection: str = "hospital_dossiers"

    # FastAPI
    ai_service_port: int = 8000
    ai_service_host: str = "0.0.0.0"

    # Security
    jwt_secret: str = "change_me_in_production"

    # RAG parameters
    rag_top_k: int = 5
    chunk_size: int = 800
    chunk_overlap: int = 100

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Singleton — يُحمَّل مرة واحدة فقط"""
    return Settings()


settings = get_settings()
