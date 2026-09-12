# Hospital AI Service — RAG Medical Analysis

نظام RAG طبي محلي 100% بدون API خارجي.

## المتطلبات

| الأداة | الإصدار | ملاحظة |
|--------|---------|--------|
| Python | 3.10+ | `python --version` |
| Ollama | أحدث | https://ollama.ai |
| MongoDB | 6+ | نفس قاعدة بيانات المشروع |

## التثبيت (مرة واحدة فقط)

```bash
# 1. انتقل لمجلد ai-service
cd ai-service

# 2. أنشئ بيئة افتراضية
python -m venv venv

# 3. فعّلها
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 4. ثبّت المكتبات
pip install -r requirements.txt

# 5. حمّل نموذج Ollama (مرة واحدة، 4.1GB)
ollama pull mistral

# 6. انسخ ملف .env وعدّله
# تأكد من MONGODB_URI صحيح
```

## التشغيل

```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: AI Service
cd ai-service
venv\Scripts\activate   # Windows
python main.py

# أو بـ start-all.bat من جذر المشروع
```

## Endpoints

| Method | URL | الوصف |
|--------|-----|-------|
| GET | `/api/health` | فحص صحة الخدمة |
| POST | `/api/ai/analyze` | تحليل دوسية كاملة |
| POST | `/api/ai/analyze/stream` | تحليل streaming |
| POST | `/api/ai/index` | فهرسة دوسية |
| DELETE | `/api/ai/patient/{id}` | حذف بيانات مريض |
| GET | `/api/ai/stats` | إحصائيات |

## مثال طلب تحليل

```bash
curl -X POST http://localhost:8000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "YOUR_PATIENT_ID",
    "language": "fr",
    "analysis_type": "full"
  }'
```

## مثال رد

```json
{
  "patient_id": "...",
  "patient_name": "Yahia Ben Ali",
  "summary": "Patient de 41 ans admis pour appendicite aiguë...",
  "diagnostic_suggestions": [
    {
      "condition": "Appendicite aiguë",
      "confidence": "élevé",
      "reasoning": "GB=16800, neutrophiles 85%, signe de Blumberg positif",
      "recommended_tests": ["Echo abdominale", "Scanner abdominal"]
    }
  ],
  "key_findings": [
    "Hyperleucocytose à prédominance neutrophile",
    "CRP élevée à 48 mg/L",
    "Allergie documentée à la Pénicilline"
  ],
  "model_used": "mistral",
  "processing_time_seconds": 12.4
}
```

## هيكل المجلدات

```
ai-service/
├── main.py                    # نقطة الدخول FastAPI
├── requirements.txt           # المكتبات
├── .env                       # الإعدادات
├── app/
│   ├── api/
│   │   ├── analyze.py         # endpoints التحليل
│   │   └── health.py          # endpoint الصحة
│   ├── core/
│   │   └── config.py          # إعدادات مركزية
│   ├── models/
│   │   └── schemas.py         # Pydantic models
│   └── services/
│       ├── mongo_service.py   # قراءة MongoDB
│       ├── text_processor.py  # تحويل دوسية → chunks
│       ├── embedding_service.py # embedding + ChromaDB
│       └── rag_service.py     # RAG pipeline كامل
├── data/
│   └── chroma_db/             # قاعدة بيانات vectors (محلية)
└── tests/
    ├── test_step3.py          # اختبار text processor
    ├── test_full_pipeline.py  # اختبار RAG كامل
    └── test_api_e2e.py        # اختبار API
```

## الخصوصية

- كل المعالجة محلية 100% — لا بيانات تخرج للخارج
- ChromaDB يُخزَّن محلياً في `data/chroma_db/`
- لحذف بيانات مريض: `DELETE /api/ai/patient/{id}`
- Ollama يعمل بالكامل offline بعد تحميل النموذج

## استكشاف الأخطاء

```bash
# Ollama لا يعمل
ollama serve

# نموذج Mistral غير موجود
ollama pull mistral

# خطأ في ChromaDB
rm -rf data/chroma_db && mkdir data/chroma_db

# MongoDB connection error
# تحقق من MONGODB_URI في .env

# الـ LLM بطيء جداً → استخدم نموذج أخف
ollama pull mistral:7b-instruct-q4_0
# ثم عدّل OLLAMA_MODEL=mistral:7b-instruct-q4_0 في .env
```
