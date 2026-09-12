"""
analyze.py — endpoints رئيسية للتحليل الطبي

Routes:
  POST /api/ai/analyze          — تحليل كامل لدوسية مريض
  POST /api/ai/index            — فهرسة دوسية بدون تحليل
  DELETE /api/ai/patient/{id}   — حذف بيانات مريض من الـ vector DB
  GET  /api/ai/stats            — إحصائيات النظام
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from loguru import logger
import json
import asyncio

from app.models.schemas import (
    AnalyzeRequest, AnalysisResult,
    IndexDossierRequest
)
from app.services.rag_service import RAGService
from app.services.embedding_service import EmbeddingService

router = APIRouter()

# Singleton للـ RAG service
_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service


# ── POST /analyze ─────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalysisResult)
async def analyze_dossier(
    request: AnalyzeRequest,
    rag: RAGService = Depends(get_rag_service)
):
    """
    تحليل دوسية طبية كاملة

    - يقرأ بيانات المريض والاستشفاء من MongoDB
    - يفهرس الدوسية في ChromaDB (تلقائي إذا لم تكن مفهرسة)
    - يبحث عن السياق الأكثر صلة
    - يولد ملخص + تشخيصات عبر Ollama

    analysis_type:
      - full:        تحليل شامل (الافتراضي)
      - summary:     ملخص فقط
      - diagnostics: تشخيصات فقط
      - followup:    متابعة يومية فقط

    language: fr | ar | en
    """
    logger.info(
        f"Analyze request — patient: {request.patient_id}, "
        f"type: {request.analysis_type}, lang: {request.language}"
    )

    try:
        result = await rag.analyze_dossier(request)
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in analyze: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ── POST /index ───────────────────────────────────────────────────────────────

@router.post("/index")
async def index_dossier(
    request: IndexDossierRequest,
    rag: RAGService = Depends(get_rag_service)
):
    """
    فهرسة دوسية في ChromaDB بدون تحليل
    مفيد لـ pre-indexing عند إضافة مريض جديد
    """
    logger.info(f"Index request — patient: {request.patient_id}")

    try:
        result = await rag.index_patient_dossier(
            patient_id=request.patient_id,
            hospitalization_id=request.hospitalization_id,
            force_reindex=request.force_reindex
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Index error: {e}")
        raise HTTPException(status_code=500, detail="Indexing failed")


# ── DELETE /patient/{patient_id} ──────────────────────────────────────────────

@router.delete("/patient/{patient_id}")
async def delete_patient_data(patient_id: str):
    """
    حذف كل بيانات مريض من ChromaDB
    مهم للخصوصية وحماية البيانات
    """
    logger.info(f"Delete request — patient: {patient_id}")
    count = EmbeddingService.delete_patient_data(patient_id)
    return {
        "patient_id": patient_id,
        "chunks_deleted": count,
        "status": "deleted"
    }


# ── GET /stats ────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats():
    """إحصائيات النظام"""
    chroma_stats = EmbeddingService.get_stats()
    return {
        "chroma_db": chroma_stats,
        "status": "ok"
    }


# ── POST /analyze/stream ──────────────────────────────────────────────────────

@router.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    """
    نسخة streaming من التحليل
    تُرجع النتائج تدريجياً كـ Server-Sent Events
    مفيد لعرض النتائج في الـ UI بدون انتظار
    """
    import ollama as _ollama
    from app.services.mongo_service import MongoService
    from app.services.text_processor import TextProcessor
    from app.core.config import settings

    async def generate():
        try:
            # جلب البيانات
            patient = await MongoService.get_patient(request.patient_id)
            hosp = await MongoService.get_hospitalization(
                request.patient_id, request.hospitalization_id
            )

            if not patient or not hosp:
                yield f"data: {json.dumps({'error': 'Patient or hospitalization not found'})}\n\n"
                return

            processor = TextProcessor()
            context = processor.build_dossier_text(patient, hosp)

            # إرسال رسالة البداية
            yield f"data: {json.dumps({'type': 'start', 'message': 'Analysis started...'})}\n\n"

            # Streaming من Ollama
            patient_name = f"{patient.first_name} {patient.last_name}"
            prompt = (
                f"Analysez ce dossier médical de {patient_name}:\n\n"
                f"{context[:2000]}\n\n"
                "Donnez un résumé médical concis et les diagnostics probables."
            )

            stream = _ollama.chat(
                model=settings.ollama_model,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
                options={"temperature": 0.2, "num_predict": 512}
            )

            for chunk in stream:
                token = chunk["message"]["content"]
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                await asyncio.sleep(0)   # السماح للـ event loop بالتنفس

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
