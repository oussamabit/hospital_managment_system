"""
text_processor.py — تحويل دوسية طبية إلى نص منظم ثم chunks جاهزة للـ embedding

الهدف: تحويل بيانات MongoDB (JSON) إلى نص طبيعي واضح
يفهمه الـ LLM ويعطي embeddings جيدة
"""
from typing import List, Optional
from langchain.text_splitter import RecursiveCharacterTextSplitter
from loguru import logger

from app.models.schemas import PatientData, Hospitalization
from app.core.config import settings


class TextProcessor:
    """
    محول الدوسيات الطبية إلى chunks جاهزة للـ RAG

    المنطق:
    1. نبني نص منظم من بيانات JSON
    2. نقسمه إلى chunks بـ LangChain
    3. كل chunk يحمل metadata (patient_id, section, date)
    """

    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            # نقسم عند الأسطر والجمل أولاً حتى لا نقطع المعنى
            separators=["\n\n", "\n", ". ", "، ", " ", ""],
            length_function=len,
        )

    # ── بناء النص الطبي ───────────────────────────────────────────────────────

    def build_dossier_text(
        self,
        patient: PatientData,
        hosp: Hospitalization
    ) -> str:
        """
        يحول JSON إلى نص طبي منظم
        مثال الناتج:
        === معلومات المريض ===
        الاسم: يحيى بن علي
        الجنس: ذكر
        ...
        === الفحص السريري ===
        الحالة العامة: ...
        """
        sections = []

        # ── صفحة 1: معلومات المريض والاستشفاء ──────────────────────────────
        patient_section = self._build_patient_section(patient, hosp)
        if patient_section:
            sections.append(patient_section)

        # ── صفحة 2: الفحص السريري ────────────────────────────────────────────
        clinical_section = self._build_clinical_section(hosp)
        if clinical_section:
            sections.append(clinical_section)

        # ── صفحة 3: التاريخ الطبي والسوابق ───────────────────────────────────
        history_section = self._build_history_section(hosp)
        if history_section:
            sections.append(history_section)

        # ── صفحة 4: الفحوصات البيولوجية ───────────────────────────────────────
        bio_section = self._build_biology_section(hosp)
        if bio_section:
            sections.append(bio_section)

        # ── المتابعة اليومية ────────────────────────────────────────────────
        followup_section = self._build_followup_section(hosp)
        if followup_section:
            sections.append(followup_section)

        return "\n\n".join(sections)

    def _build_patient_section(
        self,
        patient: PatientData,
        hosp: Hospitalization
    ) -> str:
        lines = ["=== معلومات المريض والاستشفاء ==="]

        name = f"{patient.first_name or ''} {patient.last_name or ''}".strip()
        if name:
            lines.append(f"الاسم الكامل: {name}")

        if patient.gender:
            g = "ذكر" if patient.gender == "M" else "أنثى"
            lines.append(f"الجنس: {g}")

        if patient.birth_date:
            lines.append(f"تاريخ الميلاد: {str(patient.birth_date)[:10]}")

        if patient.blood_group:
            lines.append(f"فصيلة الدم: {patient.blood_group}")

        if patient.dossier_number:
            lines.append(f"رقم الملف: {patient.dossier_number}")

        if hosp.profession:
            lines.append(f"المهنة: {hosp.profession}")

        if hosp.date_entree:
            lines.append(f"تاريخ الدخول: {str(hosp.date_entree)[:10]}")

        if hosp.date_sortie:
            lines.append(f"تاريخ الخروج: {str(hosp.date_sortie)[:10]}")

        if hosp.motif_admission:
            lines.append(f"سبب الدخول: {hosp.motif_admission}")

        if hosp.diagnostic:
            lines.append(f"التشخيص: {hosp.diagnostic}")

        if hosp.groupage:
            lines.append(f"فصيلة الدم (استشفاء): {hosp.groupage}")

        return "\n".join(lines) if len(lines) > 1 else ""

    def _build_clinical_section(self, hosp: Hospitalization) -> str:
        ec = hosp.examen_clinique
        if not ec:
            return ""

        lines = ["=== الفحص السريري ==="]

        fields = [
            (ec.etat_general, "الحالة العامة"),
            (ec.appareil_cardio_respiratoire, "الجهاز القلبي التنفسي"),
            (ec.appareil_genito_urinaire, "الجهاز البولي التناسلي"),
            (ec.systeme_nerveux, "الجهاز العصبي"),
            (ec.appareil_digestif, "الجهاز الهضمي"),
            (ec.autres_systemes, "أجهزة أخرى"),
        ]

        for value, label in fields:
            if value:
                lines.append(f"{label}: {value}")

        return "\n".join(lines) if len(lines) > 1 else ""

    def _build_history_section(self, hosp: Hospitalization) -> str:
        lines = ["=== التاريخ الطبي والسوابق ==="]

        if hosp.motif_hospitalisation:
            lines.append(f"سبب الاستشفاء: {hosp.motif_hospitalisation}")

        if hosp.histoire_maladie:
            lines.append(f"تاريخ المرض: {hosp.histoire_maladie}")

        if hosp.antecedents_medicaux:
            lines.append(f"السوابق الطبية: {hosp.antecedents_medicaux}")

        if hosp.antecedents_chirurgicaux:
            lines.append(f"السوابق الجراحية: {hosp.antecedents_chirurgicaux}")

        if hosp.allergies:
            lines.append(f"الحساسية: {hosp.allergies}")

        return "\n".join(lines) if len(lines) > 1 else ""

    def _build_biology_section(self, hosp: Hospitalization) -> str:
        bb = hosp.bilan_biologique
        if not bb:
            return ""

        lines = ["=== الفحوصات البيولوجية ==="]

        # FNS
        fns = bb.fns
        if fns:
            fns_parts = []
            if fns.gb is not None:
                fns_parts.append(f"GB={fns.gb}/mm³")
            if fns.hb is not None:
                fns_parts.append(f"HB={fns.hb} g/dL")
            if fns.ht is not None:
                fns_parts.append(f"HT={fns.ht}%")
            if fns.plq is not None:
                fns_parts.append(f"PLQ={fns.plq}/mm³")
            if fns.gr is not None:
                fns_parts.append(f"GR={fns.gr} M/mm³")
            if fns.vgm is not None:
                fns_parts.append(f"VGM={fns.vgm} fL")
            if fns.tcmh is not None:
                fns_parts.append(f"TCMH={fns.tcmh} pg")
            if fns.ccmh is not None:
                fns_parts.append(f"CCMH={fns.ccmh} g/dL")
            if fns_parts:
                lines.append(f"صورة الدم الكاملة (FNS): {', '.join(fns_parts)}")

        # الصيغة الكريات البيضاء
        fl = bb.formule_leuco
        if fl:
            fl_parts = []
            if fl.neutrophiles is not None:
                fl_parts.append(f"Neutrophiles={fl.neutrophiles}%")
            if fl.lymphocytes is not None:
                fl_parts.append(f"Lymphocytes={fl.lymphocytes}%")
            if fl.monocytes is not None:
                fl_parts.append(f"Monocytes={fl.monocytes}%")
            if fl.eosinophiles is not None:
                fl_parts.append(f"Eosinophiles={fl.eosinophiles}%")
            if fl.basophiles is not None:
                fl_parts.append(f"Basophiles={fl.basophiles}%")
            if fl_parts:
                lines.append(f"صيغة الكريات البيضاء: {', '.join(fl_parts)}")

        # كيمياء الدم
        if bb.uree is not None:
            lines.append(f"اليوريا (Urée): {bb.uree} g/L")
        if bb.creatinine is not None:
            lines.append(f"الكرياتينين: {bb.creatinine} mg/L")
        if bb.positif:
            lines.append(f"الاختبارات الإيجابية: {bb.positif}")
        if bb.negatif:
            lines.append(f"الاختبارات السلبية: {bb.negatif}")
        if bb.autres_examens:
            lines.append(f"فحوصات أخرى: {bb.autres_examens}")

        return "\n".join(lines) if len(lines) > 1 else ""

    def _build_followup_section(self, hosp: Hospitalization) -> str:
        followups = hosp.daily_followups
        if not followups:
            return ""

        lines = ["=== المتابعة اليومية ==="]
        for f in followups:
            date_str = str(f.date)[:10] if f.date else "تاريخ غير محدد"
            entry = f"تاريخ {date_str}"
            if f.evolution:
                entry += f" — التطور: {f.evolution}"
            if f.notes:
                entry += f"\nالملاحظات: {f.notes}"
            lines.append(entry)

        return "\n".join(lines) if len(lines) > 1 else ""

    # ── تقسيم النص إلى Chunks ──────────────────────────────────────────────────

    def split_into_chunks(
        self,
        text: str,
        patient_id: str,
        hospitalization_id: str,
        patient_name: str = ""
    ) -> List[dict]:
        """
        يقسم النص إلى chunks ويضيف metadata لكل chunk
        الناتج: قائمة من dict تحتوي على text + metadata
        """
        chunks = self.splitter.split_text(text)
        logger.info(f"Split into {len(chunks)} chunks for patient {patient_id}")

        result = []
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue

            # تحديد القسم الذي ينتمي إليه الـ chunk
            section = self._detect_section(chunk)

            result.append({
                "text": chunk,
                "metadata": {
                    "patient_id": patient_id,
                    "hospitalization_id": hospitalization_id,
                    "patient_name": patient_name,
                    "chunk_index": i,
                    "section": section,
                    "chunk_id": f"{patient_id}_{hospitalization_id}_{i}",
                }
            })

        return result

    def _detect_section(self, text: str) -> str:
        """يكتشف القسم الطبي من محتوى الـ chunk"""
        text_lower = text.lower()
        if "فحص" in text or "سريري" in text:
            return "examen_clinique"
        elif "فحوصات" in text or "fns" in text_lower or "يوريا" in text:
            return "bilan_biologique"
        elif "تاريخ المرض" in text or "سوابق" in text or "حساسية" in text:
            return "anamnese"
        elif "متابعة" in text or "تطور" in text:
            return "suivi_journalier"
        elif "تشخيص" in text or "دخول" in text:
            return "informations_generales"
        return "general"

    # ── Entry Point الرئيسي ────────────────────────────────────────────────────

    def process_dossier(
        self,
        patient: PatientData,
        hosp: Hospitalization
    ) -> List[dict]:
        """
        الدالة الرئيسية — تأخذ بيانات من MongoDB وترجع chunks جاهزة
        """
        patient_id = patient.id or ""
        hosp_id = hosp.id or ""
        patient_name = f"{patient.first_name or ''} {patient.last_name or ''}".strip()

        # بناء النص الكامل
        full_text = self.build_dossier_text(patient, hosp)

        if not full_text.strip():
            logger.warning(f"Empty dossier for patient {patient_id}")
            return []

        logger.info(
            f"Built text for patient {patient_name} "
            f"({len(full_text)} chars)"
        )

        # تقسيم إلى chunks
        return self.split_into_chunks(full_text, patient_id, hosp_id, patient_name)
