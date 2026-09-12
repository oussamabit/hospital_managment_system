"""
rag_service.py — القلب النابض للنظام

يجمع بين:
1. MongoDB  → قراءة الدوسية
2. TextProcessor → تحويل إلى chunks
3. EmbeddingService → فهرسة + بحث
4. Ollama LLM → توليد الملخص والتشخيصات
"""
import time
from typing import Optional
from loguru import logger

from app.core.config import settings
from app.services.mongo_service import MongoService
from app.services.text_processor import TextProcessor
from app.services.embedding_service import EmbeddingService
from app.models.schemas import (
    AnalyzeRequest, AnalysisResult,
    DiagnosticSuggestion
)

import ollama


class RAGService:

    def __init__(self):
        self.processor = TextProcessor()

    # ─────────────────────────────────────────────────────────────────────────
    # MAIN ENTRY — تحليل دوسية كاملة
    # ─────────────────────────────────────────────────────────────────────────

    async def analyze_dossier(self, request: AnalyzeRequest) -> AnalysisResult:
        """
        الدالة الرئيسية — تأخذ طلب التحليل وترجع النتيجة الكاملة

        الخطوات:
        1. جلب البيانات من MongoDB
        2. فهرسة الدوسية في ChromaDB (إذا لم تكن مفهرسة)
        3. البحث عن السياق الأكثر صلة
        4. بناء الـ prompt وإرساله لـ Ollama
        5. تحليل الرد وإرجاع النتيجة
        """
        start_time = time.time()
        patient_id = request.patient_id
        hosp_id    = request.hospitalization_id

        # ── 1. جلب البيانات ───────────────────────────────────────────────────
        logger.info(f"Fetching patient {patient_id}...")
        patient = await MongoService.get_patient(patient_id)
        if not patient:
            raise ValueError(f"Patient not found: {patient_id}")

        logger.info(f"Fetching hospitalization...")
        hosp = await MongoService.get_hospitalization(patient_id, hosp_id)
        if not hosp:
            raise ValueError(f"No hospitalization found for patient: {patient_id}")

        hosp_id = hosp.id or hosp_id or "unknown"
        patient_name = f"{patient.first_name or ''} {patient.last_name or ''}".strip()

        # ── 2. فهرسة الدوسية إذا لم تكن موجودة ──────────────────────────────
        await self._ensure_indexed(patient, hosp)

        # ── 3. بناء الـ queries حسب نوع التحليل ──────────────────────────────
        queries = self._build_queries(request.analysis_type)

        # ── 4. استرجاع السياق الأكثر صلة ─────────────────────────────────────
        context = self._retrieve_context(
            queries=queries,
            patient_id=patient_id,
            hosp_id=hosp_id
        )

        # إذا فشل الـ retrieval، نستخدم النص الكامل مباشرة
        if not context:
            logger.warning("Retrieval returned nothing, using full text")
            context = self.processor.build_dossier_text(patient, hosp)

        # ── 5. توليد التحليل عبر Ollama ────────────────────────────────────
        logger.info(f"Sending to Ollama ({settings.ollama_model})...")
        summary, diagnostics, findings = await self._generate_analysis(
            context=context,
            patient_name=patient_name,
            analysis_type=request.analysis_type,
            language=request.language,
        )

        elapsed = round(time.time() - start_time, 2)
        logger.info(f"Analysis completed in {elapsed}s")

        return AnalysisResult(
            patient_id=patient_id,
            hospitalization_id=hosp_id,
            patient_name=patient_name,
            summary=summary,
            diagnostic_suggestions=diagnostics,
            key_findings=findings,
            retrieved_context=context[:500] + "..." if len(context) > 500 else context,
            model_used=settings.ollama_model,
            processing_time_seconds=elapsed,
            language=request.language,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    async def _ensure_indexed(self, patient, hosp) -> None:
        """فهرسة الدوسية في ChromaDB إذا لم تكن موجودة"""
        hosp_id = hosp.id or ""
        collection = EmbeddingService.get_collection()

        # التحقق من وجود الفهرسة
        try:
            existing = collection.get(
                where={"hospitalization_id": hosp_id},
                limit=1
            )
            if existing["ids"]:
                logger.info(f"Hospitalization {hosp_id} already indexed")
                return
        except Exception:
            pass

        # فهرسة جديدة
        chunks = self.processor.process_dossier(patient, hosp)
        if chunks:
            count = EmbeddingService.index_chunks(chunks)
            logger.info(f"Indexed {count} chunks for hospitalization {hosp_id}")

    def _build_queries(self, analysis_type: str) -> list[str]:
        """بناء قائمة queries حسب نوع التحليل المطلوب"""
        base_queries = {
            "full": [
                "ملخص الحالة المرضية والتشخيص",
                "الفحص السريري ونتائج الفحوصات",
                "السوابق الطبية وتاريخ المرض",
                "نتائج تحاليل الدم والفحوصات البيولوجية",
                "المتابعة اليومية وتطور الحالة",
            ],
            "summary": [
                "ملخص الحالة والتشخيص الرئيسي",
                "سبب الدخول والمعلومات العامة",
            ],
            "diagnostics": [
                "التشخيص والأعراض والعلامات السريرية",
                "نتائج الفحوصات المخبرية",
                "السوابق المرضية والحساسية",
            ],
            "followup": [
                "المتابعة اليومية وتطور الحالة",
                "التحسن أو التدهور في الحالة",
            ],
        }
        return base_queries.get(analysis_type, base_queries["full"])

    def _retrieve_context(
        self,
        queries: list[str],
        patient_id: str,
        hosp_id: str
    ) -> str:
        """
        استرجاع السياق الأكثر صلة من ChromaDB
        يبحث بـ queries متعددة ويدمج النتائج بدون تكرار
        """
        seen_texts = set()
        all_chunks = []

        for query in queries:
            results = EmbeddingService.search(
                query=query,
                hospitalization_id=hosp_id,
                top_k=2  # top 2 per query
            )
            for r in results:
                text = r["text"]
                if text not in seen_texts:
                    seen_texts.add(text)
                    all_chunks.append({
                        "text": text,
                        "score": r["similarity_score"],
                        "section": r["metadata"].get("section", "general")
                    })

        # ترتيب حسب الـ score
        all_chunks.sort(key=lambda x: x["score"], reverse=True)

        # بناء السياق المدمج
        context_parts = [c["text"] for c in all_chunks[:settings.rag_top_k]]
        return "\n\n---\n\n".join(context_parts)

    async def _generate_analysis(
        self,
        context: str,
        patient_name: str,
        analysis_type: str,
        language: str,
    ) -> tuple[str, list[DiagnosticSuggestion], list[str]]:
        """
        إرسال الـ prompt لـ Ollama وتحليل الرد
        """
        prompt = self._build_prompt(
            context, patient_name, analysis_type, language
        )

        try:
            response = ollama.chat(
                model=settings.ollama_model,
                messages=[
                    {
                        "role": "system",
                        "content": self._system_prompt(language),
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                options={
                    "temperature": 0.2,    # منخفض للدقة الطبية
                    "top_p": 0.9,
                    "num_predict": 1024,   # حد أقصى للرد
                }
            )
            raw_response = response["message"]["content"]
            logger.debug(f"Ollama raw response: {raw_response[:200]}...")

        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise RuntimeError(f"LLM generation failed: {e}")

        # تحليل الرد
        return self._parse_response(raw_response)

    # ─────────────────────────────────────────────────────────────────────────
    # PROMPT ENGINEERING
    # ─────────────────────────────────────────────────────────────────────────

    def _system_prompt(self, language: str) -> str:
        prompts = {
            "fr": (
                "Vous êtes un assistant médical expert. "
                "Analysez les dossiers médicaux avec précision et concision. "
                "Basez-vous UNIQUEMENT sur les informations fournies dans le contexte. "
                "Ne jamais inventer ou supposer des informations médicales. "
                "Répondez toujours avec le format structuré demandé."
            ),
            "ar": (
                "أنت مساعد طبي خبير. "
                "حلل الملفات الطبية بدقة وإيجاز. "
                "استند فقط على المعلومات الموجودة في السياق المقدم. "
                "لا تخترع أو تفترض معلومات طبية. "
                "أجب دائماً بالتنسيق المنظم المطلوب."
            ),
            "en": (
                "You are an expert medical assistant. "
                "Analyze medical records with precision and conciseness. "
                "Base your analysis ONLY on the provided context. "
                "Never invent or assume medical information. "
                "Always respond with the requested structured format."
            ),
        }
        return prompts.get(language, prompts["fr"])

    def _build_prompt(
        self,
        context: str,
        patient_name: str,
        analysis_type: str,
        language: str,
    ) -> str:
        """بناء الـ prompt الكامل"""

        lang_instructions = {
            "fr": {
                "intro": f"Analysez le dossier médical de {patient_name}:",
                "section1": "RÉSUMÉ MÉDICAL:",
                "section2": "DIAGNOSTICS SUGGÉRÉS:",
                "section3": "POINTS CLÉS:",
                "format": (
                    "Répondez EXACTEMENT dans ce format:\n"
                    "##SUMMARY##\n[résumé en 3-5 phrases]\n"
                    "##DIAGNOSTICS##\n"
                    "1. [Condition] | [Niveau: élevé/moyen/faible] | [Raisonnement] | [Tests: test1, test2]\n"
                    "2. [Condition] | [Niveau] | [Raisonnement] | [Tests]\n"
                    "##FINDINGS##\n"
                    "- [point clé 1]\n- [point clé 2]\n- [point clé 3]"
                )
            },
            "ar": {
                "intro": f"حلل الملف الطبي للمريض {patient_name}:",
                "format": (
                    "أجب بهذا التنسيق بالضبط:\n"
                    "##SUMMARY##\n[ملخص في 3-5 جمل]\n"
                    "##DIAGNOSTICS##\n"
                    "1. [الحالة] | [المستوى: عالي/متوسط/منخفض] | [السبب] | [فحوصات: فحص1, فحص2]\n"
                    "##FINDINGS##\n"
                    "- [نقطة مهمة 1]\n- [نقطة مهمة 2]"
                )
            },
            "en": {
                "intro": f"Analyze the medical dossier of {patient_name}:",
                "format": (
                    "Respond EXACTLY in this format:\n"
                    "##SUMMARY##\n[summary in 3-5 sentences]\n"
                    "##DIAGNOSTICS##\n"
                    "1. [Condition] | [Level: high/medium/low] | [Reasoning] | [Tests: test1, test2]\n"
                    "##FINDINGS##\n"
                    "- [key finding 1]\n- [key finding 2]"
                )
            }
        }

        lang = lang_instructions.get(language, lang_instructions["fr"])

        return (
            f"{lang['intro']}\n\n"
            f"=== CONTEXTE MÉDICAL ===\n{context}\n\n"
            f"=== INSTRUCTIONS ===\n{lang['format']}"
        )

    # ─────────────────────────────────────────────────────────────────────────
    # RESPONSE PARSING
    # ─────────────────────────────────────────────────────────────────────────

    def _parse_response(
        self,
        raw: str
    ) -> tuple[str, list[DiagnosticSuggestion], list[str]]:
        """
        تحليل رد Ollama واستخراج الأقسام الثلاثة

        الناتج: (summary, diagnostics_list, findings_list)
        """
        summary      = ""
        diagnostics  = []
        findings     = []

        try:
            # استخراج الملخص
            if "##SUMMARY##" in raw:
                parts = raw.split("##SUMMARY##")
                after = parts[1] if len(parts) > 1 else ""
                if "##DIAGNOSTICS##" in after:
                    summary = after.split("##DIAGNOSTICS##")[0].strip()
                elif "##FINDINGS##" in after:
                    summary = after.split("##FINDINGS##")[0].strip()
                else:
                    summary = after.strip()

            # استخراج التشخيصات
            if "##DIAGNOSTICS##" in raw:
                diag_part = raw.split("##DIAGNOSTICS##")[1]
                if "##FINDINGS##" in diag_part:
                    diag_part = diag_part.split("##FINDINGS##")[0]

                for line in diag_part.strip().split("\n"):
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    # إزالة رقم القائمة
                    if line[0].isdigit() and ". " in line:
                        line = line.split(". ", 1)[1]

                    parts = [p.strip() for p in line.split("|")]
                    if len(parts) >= 3:
                        # استخراج الفحوصات المقترحة
                        tests = []
                        if len(parts) >= 4:
                            tests_raw = parts[3].replace("Tests:", "").replace("فحوصات:", "").strip()
                            tests = [t.strip() for t in tests_raw.split(",") if t.strip()]

                        # تطبيع مستوى الثقة
                        conf_raw = parts[1].lower()
                        if any(w in conf_raw for w in ["élevé", "high", "عالي", "haut"]):
                            confidence = "élevé"
                        elif any(w in conf_raw for w in ["moyen", "medium", "متوسط"]):
                            confidence = "moyen"
                        else:
                            confidence = "faible"

                        diagnostics.append(DiagnosticSuggestion(
                            condition=parts[0],
                            confidence=confidence,
                            reasoning=parts[2],
                            recommended_tests=tests,
                        ))

            # استخراج النقاط المهمة
            if "##FINDINGS##" in raw:
                find_part = raw.split("##FINDINGS##")[1].strip()
                for line in find_part.split("\n"):
                    line = line.strip().lstrip("-•* ").strip()
                    if line and len(line) > 5:
                        findings.append(line)

        except Exception as e:
            logger.warning(f"Response parsing error: {e}")
            # fallback — إرجاع الرد الخام كملخص
            summary = raw[:800] if raw else "Analyse non disponible"

        # fallbacks إذا كانت الأقسام فارغة
        if not summary:
            summary = raw[:500] if raw else "Analyse non disponible"
        if not findings:
            findings = ["Voir le résumé pour les détails"]

        return summary, diagnostics, findings

    # ─────────────────────────────────────────────────────────────────────────
    # INDEX ONLY (بدون تحليل) — للفهرسة المسبقة
    # ─────────────────────────────────────────────────────────────────────────

    async def index_patient_dossier(
        self,
        patient_id: str,
        hospitalization_id: Optional[str] = None,
        force_reindex: bool = False
    ) -> dict:
        """فهرسة دوسية في ChromaDB بدون تحليل"""
        patient = await MongoService.get_patient(patient_id)
        if not patient:
            raise ValueError(f"Patient not found: {patient_id}")

        hosp = await MongoService.get_hospitalization(patient_id, hospitalization_id)
        if not hosp:
            raise ValueError(f"No hospitalization found")

        chunks = self.processor.process_dossier(patient, hosp)
        count = EmbeddingService.index_chunks(chunks, force_reindex=force_reindex)

        return {
            "patient_id": patient_id,
            "hospitalization_id": hosp.id,
            "chunks_indexed": count,
            "status": "indexed" if count > 0 else "already_exists"
        }
