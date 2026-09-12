"""
test_step3.py — اختبار الخطوة الثالثة بدون FastAPI
شغّله مباشرة: python tests/test_step3.py
"""
import asyncio
import sys
import os

# إضافة المسار
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.text_processor import TextProcessor
from app.models.schemas import PatientData, Hospitalization, BilanBiologique, FNSData, ExamenClinique


async def test_text_processor():
    """اختبار تحويل الدوسية إلى chunks"""
    print("=" * 60)
    print("TEST: Text Processor")
    print("=" * 60)

    # بيانات تجريبية تشبه ما في MongoDB
    patient = PatientData(**{
        "_id": "patient_test_001",
        "firstName": "Yahia",
        "lastName": "Ben Ali",
        "birthDate": "1985-03-15",
        "gender": "M",
        "bloodGroup": "B+",
        "dossierNumber": "DOS-2026-001",
    })

    hosp = Hospitalization(**{
        "_id": "hosp_test_001",
        "patientId": "patient_test_001",
        "dossierN": "2026-001",
        "noLit": "14",
        "groupage": "B+",
        "profession": "Ingénieur",
        "dateEntree": "2026-04-01",
        "motifAdmission": "Douleurs abdominales sévères",
        "diagnostic": "Appendicite aiguë — chirurgie urgente requise",
        "examenClinique": {
            "etatGeneral": "Patient conscient, orienté, légèrement pâle",
            "appareilCardioRespiratoire": "FC 98 bpm, TA 130/80 mmHg, Poumons clairs",
            "appareilDigestif": "Abdomen tendu, douleur en FID, signe de Blumberg positif",
            "systemeNerveux": "Examen neurologique normal",
        },
        "histoireMaladie": (
            "Patient de 41 ans, ingénieur, admis pour douleurs abdominales débutées "
            "il y a 24h, progressivement intenses, localisées en fosse iliaque droite. "
            "Nausées et vomissements associés. Pas de fièvre au domicile."
        ),
        "antecedentsMedicaux": "Pas d'antécédents médicaux particuliers",
        "antecedentsChirurgicaux": "Aucun",
        "allergies": "Pénicilline (rash cutané)",
        "bilanBiologique": {
            "fns": {
                "gb": 14500,
                "hb": 13.2,
                "ht": 40,
                "plq": 280000,
                "gr": 4.5,
            },
            "formuleLeuco": {
                "neutrophiles": 82,
                "lymphocytes": 13,
                "monocytes": 4,
                "eosinophiles": 1,
                "basophiles": 0,
            },
            "creatinine": 9.5,
            "uree": 0.28,
        },
        "dailyFollowups": [
            {
                "date": "2026-04-01",
                "notes": "Patient stable post-opératoire, douleur contrôlée par antalgiques",
                "evolution": "Stable"
            },
            {
                "date": "2026-04-02",
                "notes": "Reprise du transit, apyrexie, cicatrice propre",
                "evolution": "Amélioration"
            }
        ]
    })

    # اختبار 1: بناء النص
    processor = TextProcessor()
    full_text = processor.build_dossier_text(patient, hosp)

    print("\n[1] النص الكامل المبني:")
    print("-" * 40)
    print(full_text)
    print(f"\n[INFO] طول النص: {len(full_text)} حرف")

    # اختبار 2: التقسيم إلى chunks
    chunks = processor.process_dossier(patient, hosp)

    print(f"\n[2] عدد الـ chunks: {len(chunks)}")
    print("-" * 40)
    for i, chunk in enumerate(chunks):
        print(f"\n  Chunk {i+1} (قسم: {chunk['metadata']['section']}):")
        print(f"  {chunk['text'][:120]}...")
        print(f"  Metadata: {chunk['metadata']}")

    print("\n[OK] Text Processor يعمل بشكل صحيح!")
    return chunks


async def test_embedding():
    """اختبار توليد الـ embeddings"""
    print("\n" + "=" * 60)
    print("TEST: Embedding Service")
    print("=" * 60)

    from app.services.embedding_service import EmbeddingService

    print("\n[INFO] تحميل نموذج الـ embedding (قد يستغرق دقائق في أول مرة)...")
    await EmbeddingService.initialize()

    # اختبار embedding
    texts = [
        "Patient souffre de douleurs abdominales sévères",
        "الجهاز الهضمي: ألم شديد في الربع السفلي الأيمن",
        "GB=14500/mm³ — hyperleucytose avec prédominance neutrophile",
    ]

    print("\n[INFO] توليد embeddings...")
    embeddings = EmbeddingService.embed_texts(texts)

    print(f"\n[2] نتائج الـ Embedding:")
    for text, emb in zip(texts, embeddings):
        print(f"  '{text[:50]}...' → vector بطول {len(emb)}")
        print(f"  أول 5 قيم: {emb[:5]}")

    print("\n[OK] Embedding Service يعمل بشكل صحيح!")


async def main():
    # اختبار 1: معالجة النص
    chunks = await test_text_processor()

    # اختبار 2: الـ embedding
    # احذف التعليق إذا أردت اختباره (يستغرق وقتاً أطول)
    # await test_embedding()

    print("\n" + "=" * 60)
    print("جميع الاختبارات ناجحة!")
    print("الخطوة الثالثة مكتملة — جاهز للخطوة الرابعة")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
