"""
embedding_service.py — تحويل النصوص إلى vectors وتخزينها في ChromaDB

يستخدم:
- sentence-transformers للـ embedding (محلي بالكامل)
- ChromaDB للتخزين والبحث
"""
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from typing import List, Optional
from loguru import logger

from app.core.config import settings


class EmbeddingService:
    """
    خدمة الـ Embedding والـ Vector Search

    Design pattern: Singleton
    النموذج يُحمَّل مرة واحدة عند بدء الخادم ويُعاد استخدامه
    """

    # Class-level singletons
    _model: Optional[SentenceTransformer] = None
    _chroma_client: Optional[chromadb.PersistentClient] = None
    _collection = None

    @classmethod
    async def initialize(cls):
        """
        يُستدعى عند بدء FastAPI
        يحمل الـ embedding model و ChromaDB client
        """
        logger.info(f"Loading embedding model: {settings.embedding_model}")
        logger.info("This may take a few minutes on first run (downloading model)...")

        # تحميل نموذج الـ embedding
        # يدعم العربية والفرنسية والإنجليزية
        cls._model = SentenceTransformer(
            settings.embedding_model,
            device="cpu"   # بدون GPU
        )
        logger.info("Embedding model loaded successfully")

        # تهيئة ChromaDB
        cls._chroma_client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )

        # إنشاء أو الحصول على الـ collection
        cls._collection = cls._chroma_client.get_or_create_collection(
            name=settings.chroma_collection,
            metadata={"hnsw:space": "cosine"}   # cosine similarity أفضل للنصوص
        )

        existing = cls._collection.count()
        logger.info(
            f"ChromaDB collection '{settings.chroma_collection}' ready "
            f"({existing} existing chunks)"
        )

    @classmethod
    def get_model(cls) -> SentenceTransformer:
        if cls._model is None:
            raise RuntimeError("EmbeddingService not initialized. Call initialize() first.")
        return cls._model

    @classmethod
    def get_collection(cls):
        if cls._collection is None:
            raise RuntimeError("EmbeddingService not initialized. Call initialize() first.")
        return cls._collection

    # ── Embedding ─────────────────────────────────────────────────────────────

    @classmethod
    def embed_texts(cls, texts: List[str]) -> List[List[float]]:
        """
        تحويل قائمة نصوص إلى vectors
        Batch processing لأداء أفضل
        """
        model = cls.get_model()
        # encode يعمل batch بشكل تلقائي
        embeddings = model.encode(
            texts,
            batch_size=32,         # معالجة 32 chunk في وقت واحد
            show_progress_bar=False,
            normalize_embeddings=True,   # مهم للـ cosine similarity
            convert_to_numpy=True
        )
        return embeddings.tolist()

    # ── Index (تخزين) ─────────────────────────────────────────────────────────

    @classmethod
    def index_chunks(
        cls,
        chunks: List[dict],
        force_reindex: bool = False
    ) -> int:
        """
        فهرسة chunks في ChromaDB

        chunks: [{"text": "...", "metadata": {...}}, ...]
        force_reindex: حذف القديم وإعادة الفهرسة

        يرجع: عدد الـ chunks المضافة
        """
        if not chunks:
            return 0

        collection = cls.get_collection()

        # استخراج patient_id و hospitalization_id من أول chunk
        patient_id = chunks[0]["metadata"]["patient_id"]
        hosp_id = chunks[0]["metadata"]["hospitalization_id"]

        # حذف القديم إذا طُلب
        if force_reindex:
            try:
                existing_ids = collection.get(
                    where={"hospitalization_id": hosp_id}
                )["ids"]
                if existing_ids:
                    collection.delete(ids=existing_ids)
                    logger.info(f"Deleted {len(existing_ids)} old chunks for hospitalization {hosp_id}")
            except Exception as e:
                logger.warning(f"Could not delete old chunks: {e}")

        # التحقق من وجود الدوسية مسبقاً
        if not force_reindex:
            try:
                existing = collection.get(
                    where={"hospitalization_id": hosp_id},
                    limit=1
                )
                if existing["ids"]:
                    logger.info(f"Hospitalization {hosp_id} already indexed, skipping")
                    return 0
            except Exception:
                pass

        # إعداد البيانات للإضافة
        texts = [c["text"] for c in chunks]
        ids   = [c["metadata"]["chunk_id"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]

        # توليد الـ embeddings
        logger.info(f"Generating embeddings for {len(texts)} chunks...")
        embeddings = cls.embed_texts(texts)

        # إضافة إلى ChromaDB
        collection.add(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas
        )

        logger.info(f"Indexed {len(chunks)} chunks for patient {patient_id}")
        return len(chunks)

    # ── Retrieval (البحث) ─────────────────────────────────────────────────────

    @classmethod
    def search(
        cls,
        query: str,
        patient_id: Optional[str] = None,
        hospitalization_id: Optional[str] = None,
        top_k: Optional[int] = None
    ) -> List[dict]:
        """
        البحث عن chunks مشابهة للسؤال

        query: السؤال أو الطلب
        patient_id: للتصفية حسب المريض
        top_k: عدد النتائج المطلوبة

        يرجع: قائمة من chunks مع scores
        """
        collection = cls.get_collection()
        k = top_k or settings.rag_top_k

        # بناء filter
        where_filter = {}
        if hospitalization_id:
            where_filter = {"hospitalization_id": hospitalization_id}
        elif patient_id:
            where_filter = {"patient_id": patient_id}

        # توليد embedding للسؤال
        query_embedding = cls.embed_texts([query])[0]

        # البحث في ChromaDB
        query_params = {
            "query_embeddings": [query_embedding],
            "n_results": min(k, collection.count() or 1),
            "include": ["documents", "metadatas", "distances"],
        }

        if where_filter:
            query_params["where"] = where_filter

        try:
            results = collection.query(**query_params)
        except Exception as e:
            logger.error(f"ChromaDB search error: {e}")
            return []

        # تنسيق النتائج
        output = []
        if results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            ):
                output.append({
                    "text": doc,
                    "metadata": meta,
                    "similarity_score": round(1 - dist, 4)   # cosine distance → similarity
                })

        logger.info(
            f"Retrieved {len(output)} chunks for query: '{query[:50]}...'"
            if len(query) > 50 else f"Retrieved {len(output)} chunks for query: '{query}'"
        )
        return output

    # ── Utils ──────────────────────────────────────────────────────────────────

    @classmethod
    def get_stats(cls) -> dict:
        """إحصائيات ChromaDB"""
        try:
            collection = cls.get_collection()
            return {
                "total_chunks": collection.count(),
                "collection_name": settings.chroma_collection,
                "persist_dir": settings.chroma_persist_dir,
            }
        except Exception as e:
            return {"error": str(e)}

    @classmethod
    def delete_patient_data(cls, patient_id: str) -> int:
        """
        حذف كل بيانات مريض من ChromaDB
        مهم للـ GDPR / الخصوصية
        """
        try:
            collection = cls.get_collection()
            existing = collection.get(
                where={"patient_id": patient_id}
            )
            if existing["ids"]:
                collection.delete(ids=existing["ids"])
                logger.info(f"Deleted {len(existing['ids'])} chunks for patient {patient_id}")
                return len(existing["ids"])
            return 0
        except Exception as e:
            logger.error(f"Error deleting patient data: {e}")
            return 0
