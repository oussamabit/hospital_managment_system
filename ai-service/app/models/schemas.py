"""
schemas.py — مخططات البيانات لنظام RAG الطبي
تعكس بنية الدوسيات الموجودة في MongoDB
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ── Input ─────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """الطلب الوارد من React frontend"""
    patient_id: str = Field(..., description="معرف المريض في MongoDB")
    hospitalization_id: Optional[str] = Field(
        None, description="معرف الاستشفاء — اختياري، إذا فارغ يأخذ آخر استشفاء"
    )
    language: str = Field(
        "fr", description="لغة الناتج: fr | ar | en"
    )
    analysis_type: str = Field(
        "full", description="نوع التحليل: full | summary | diagnostics | followup"
    )


class IndexDossierRequest(BaseModel):
    """طلب فهرسة دوسية في ChromaDB"""
    patient_id: str
    hospitalization_id: Optional[str] = None
    force_reindex: bool = False   # إعادة الفهرسة حتى لو موجودة


# ── MongoDB Document Structures ───────────────────────────────────────────────

class FNSData(BaseModel):
    """نتائج تحليل الدم الكامل"""
    gb: Optional[float] = None
    gr: Optional[float] = None
    hb: Optional[float] = None
    ht: Optional[float] = None
    vgm: Optional[float] = None
    tcmh: Optional[float] = None
    ccmh: Optional[float] = None
    plq: Optional[float] = None


class FormuleLeuco(BaseModel):
    """الصيغة الكريات البيضاء"""
    neutrophiles: Optional[float] = None
    lymphocytes: Optional[float] = None
    monocytes: Optional[float] = None
    eosinophiles: Optional[float] = None
    basophiles: Optional[float] = None


class BilanBiologique(BaseModel):
    """الفحوصات البيولوجية"""
    uree: Optional[float] = None
    creatinine: Optional[float] = None
    positif: Optional[str] = None
    negatif: Optional[str] = None
    fns: Optional[FNSData] = None
    formule_leuco: Optional[FormuleLeuco] = Field(None, alias="formuleLeuco")
    autres_examens: Optional[str] = Field(None, alias="autresExamens")

    class Config:
        populate_by_name = True


class ExamenClinique(BaseModel):
    """الفحص السريري"""
    etat_general: Optional[str] = Field(None, alias="etatGeneral")
    appareil_cardio_respiratoire: Optional[str] = Field(None, alias="appareilCardioRespiratoire")
    appareil_genito_urinaire: Optional[str] = Field(None, alias="appareilGenitoUrinaire")
    systeme_nerveux: Optional[str] = Field(None, alias="systemeNerveux")
    appareil_digestif: Optional[str] = Field(None, alias="appareilDigestif")
    autres_systemes: Optional[str] = Field(None, alias="autresSystemes")

    class Config:
        populate_by_name = True


class DailyFollowup(BaseModel):
    """متابعة يومية"""
    date: Optional[Any] = None
    notes: Optional[str] = None
    evolution: Optional[str] = None


class Hospitalization(BaseModel):
    """الاستشفاء الكامل"""
    id: Optional[str] = Field(None, alias="_id")

    # صفحة 1 — معلومات عامة
    annee: Optional[str] = None
    dossier_n: Optional[str] = Field(None, alias="dossierN")
    no_lit: Optional[str] = Field(None, alias="noLit")
    groupage: Optional[str] = None
    profession: Optional[str] = None
    date_entree: Optional[Any] = Field(None, alias="dateEntree")
    date_sortie: Optional[Any] = Field(None, alias="dateSortie")
    motif_admission: Optional[str] = Field(None, alias="motifAdmission")
    diagnostic: Optional[str] = None

    # صفحة 2 — الفحص السريري
    examen_clinique: Optional[ExamenClinique] = Field(None, alias="examenClinique")

    # صفحة 3 — السوابق والتاريخ
    motif_hospitalisation: Optional[str] = Field(None, alias="motifHospitalisation")
    histoire_maladie: Optional[str] = Field(None, alias="histoireMaladie")
    antecedents_medicaux: Optional[str] = Field(None, alias="antecedentsMedicaux")
    antecedents_chirurgicaux: Optional[str] = Field(None, alias="antecedentsChirurgicaux")
    allergies: Optional[str] = None

    # صفحة 4 — الفحوصات البيولوجية
    bilan_biologique: Optional[BilanBiologique] = Field(None, alias="bilanBiologique")

    # المتابعة اليومية
    daily_followups: Optional[List[DailyFollowup]] = Field(None, alias="dailyFollowups")

    created_at: Optional[Any] = Field(None, alias="createdAt")

    class Config:
        populate_by_name = True


class PatientData(BaseModel):
    """بيانات المريض الأساسية"""
    id: Optional[str] = Field(None, alias="_id")
    first_name: Optional[str] = Field(None, alias="firstName")
    last_name: Optional[str] = Field(None, alias="lastName")
    birth_date: Optional[Any] = Field(None, alias="birthDate")
    gender: Optional[str] = None
    blood_group: Optional[str] = Field(None, alias="bloodGroup")
    phone: Optional[str] = None
    address: Optional[str] = None
    dossier_number: Optional[str] = Field(None, alias="dossierNumber")

    class Config:
        populate_by_name = True


# ── Output ────────────────────────────────────────────────────────────────────

class DiagnosticSuggestion(BaseModel):
    """تشخيص مقترح واحد"""
    condition: str          # اسم الحالة
    confidence: str         # عالي / متوسط / منخفض
    reasoning: str          # السبب
    recommended_tests: List[str] = []   # فحوصات مقترحة


class AnalysisResult(BaseModel):
    """النتيجة الكاملة للتحليل"""
    patient_id: str
    hospitalization_id: str
    patient_name: str

    # الملخص الطبي
    summary: str

    # التشخيصات المقترحة
    diagnostic_suggestions: List[DiagnosticSuggestion] = []

    # نقاط تحتاج متابعة
    key_findings: List[str] = []

    # السياق الذي استخدمه الـ RAG
    retrieved_context: Optional[str] = None

    # metadata
    model_used: str
    processing_time_seconds: float
    language: str


class HealthResponse(BaseModel):
    """استجابة فحص صحة الخدمة"""
    status: str
    ollama_available: bool
    ollama_model: str
    embedding_model: str
    chroma_db: str
    mongodb: str
