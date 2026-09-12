"""
test_full_pipeline.py — اختبار كامل للـ RAG pipeline

شغّله: python tests/test_full_pipeline.py
يختبر: Embedding → ChromaDB → Ollama → Response Parsing
"""
import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.text_processor import TextProcessor
from app.services.embedding_service import EmbeddingService
from app.models.schemas import (
    PatientData, Hospitalization,
    AnalyzeRequest
)


# ── بيانات تجريبية ─────────────────────────────────────────────────────────

MOCK_PATIENT = PatientData(**{
    "_id": "test_patient_rag_001",
    "firstName": "Yahia",
    "lastName": "Lacamora",
    "birthDate": "1985-03-15",
    "gender": "M",
    "bloodGroup": "B+",
    "dossierNumber": "DOS-2026-TEST",
})

MOCK_HOSP = Hospitalization(**{
    "_id": "test_hosp_rag_001",
    "patientId": "test_patient_rag_001",
    "dossierN": "2026-T01",
    "noLit": "14",
    "groupage": "B+",
    "profession": "Ingénieur informatique",
    "dateEntree": "2026-04-28",
    "motifAdmission": "Douleurs abdominales intenses avec fièvre",
    "diagnostic": "Appendicite aiguë — opéré en urgence le 28/04/2026",
    "examenClinique": {
        "etatGeneral": "Patient conscient, orienté, pâle, fébricule à 38.5°C",
        "appareilCardioRespiratoire": "FC 102 bpm, TA 125/80 mmHg, SaO2 98%, auscultation normale",
        "appareilDigestif": (
            "Abdomen douloureux en FID, défense localisée, "
            "signe de Blumberg positif, signe de Rovsing positif"
        ),
        "systemeNerveux": "Examen neurologique sans anomalie",
        "appareilGenitoUrinaire": "Sans particularité",
    },
    "histoireMaladie": (
        "M. Yahia Lacamora, 41 ans, sans antécédents chirurgicaux, "
        "se présente aux urgences pour des douleurs abdominales débutées "
        "il y a 36 heures, progressivement intenses, localisées en fosse "
        "iliaque droite. Associées à des nausées, vomissements et fièvre à 38.5°C. "
        "Pas de diarrhée ni de trouble mictionnel."
    ),
    "antecedentsMedicaux": "HTA traitée par Amlodipine 5mg/j depuis 2020",
    "antecedentsChirurgicaux": "Aucun",
    "allergies": "Pénicilline (allergie documentée — rash cutané diffus)",
    "bilanBiologique": {
        "fns": {
            "gb": 16800,   # élevé → infection
            "hb": 12.8,
            "ht": 38,
            "plq": 310000,
            "gr": 4.3,
            "vgm": 88,
            "tcmh": 29,
            "ccmh": 33,
        },
        "formuleLeuco": {
            "neutrophiles": 85,   # élevé → infection bactérienne
            "lymphocytes": 10,
            "monocytes": 4,
            "eosinophiles": 1,
            "basophiles": 0,
        },
        "creatinine": 8.5,
        "uree": 0.25,
        "positif": "CRP 48 mg/L (élevée)",
        "negatif": "VIH négatif, hépatites B et C négatives",
    },
    "dailyFollowups": [
        {
            "date": "2026-04-28",
            "notes": "Post-appendicectomie laparoscopique. Patient stable, douleur contrôlée.",
            "evolution": "Stable"
        },
        {
            "date": "2026-04-29",
            "notes": "Reprise du transit. Apyrétique. Cicatrice propre sans signe d'infection.",
            "evolution": "Amélioration"
        },
        {
            "date": "2026-04-30",
            "notes": "Patient autonome, alimentation normale reprise. Sortie autorisée.",
            "evolution": "Bon"
        }
    ]
})


# ── Tests ──────────────────────────────────────────────────────────────────────

async def test_1_text_processing():
    print("\n" + "="*60)
    print("TEST 1 — Text Processing")
    print("="*60)

    processor = TextProcessor()
    full_text = processor.build_dossier_text(MOCK_PATIENT, MOCK_HOSP)
    chunks = processor.process_dossier(MOCK_PATIENT, MOCK_HOSP)

    print(f"[OK] Texte construit: {len(full_text)} caractères")
    print(f"[OK] Chunks générés: {len(chunks)}")
    for i, c in enumerate(chunks[:3]):
        print(f"     Chunk {i+1} [{c['metadata']['section']}]: {c['text'][:80]}...")

    return chunks


async def test_2_embedding_and_index(chunks: list):
    print("\n" + "="*60)
    print("TEST 2 — Embedding + ChromaDB Indexing")
    print("="*60)

    print("[INFO] Chargement du modèle d'embedding...")
    t0 = time.time()
    await EmbeddingService.initialize()
    print(f"[OK] Modèle chargé en {round(time.time()-t0, 1)}s")

    # Test embedding d'un seul texte
    test_text = "Patient souffre de douleurs abdominales et fièvre"
    t0 = time.time()
    emb = EmbeddingService.embed_texts([test_text])[0]
    print(f"[OK] Embedding généré: vecteur de dimension {len(emb)} en {round(time.time()-t0, 2)}s")

    # Indexation
    print(f"\n[INFO] Indexation de {len(chunks)} chunks...")
    t0 = time.time()
    count = EmbeddingService.index_chunks(chunks, force_reindex=True)
    print(f"[OK] {count} chunks indexés en {round(time.time()-t0, 1)}s")

    stats = EmbeddingService.get_stats()
    print(f"[OK] ChromaDB stats: {stats}")


async def test_3_retrieval():
    print("\n" + "="*60)
    print("TEST 3 — Semantic Retrieval")
    print("="*60)

    queries = [
        "résultats des analyses de sang",
        "douleurs abdominales et symptômes",
        "antécédents médicaux et allergies",
        "évolution post-opératoire",
    ]

    for query in queries:
        results = EmbeddingService.search(
            query=query,
            hospitalization_id=MOCK_HOSP.id,
            top_k=2
        )
        print(f"\n  Requête: '{query}'")
        for r in results:
            print(f"  → Score {r['similarity_score']:.3f} [{r['metadata']['section']}]: "
                  f"{r['text'][:100]}...")


async def test_4_ollama():
    print("\n" + "="*60)
    print("TEST 4 — Ollama LLM")
    print("="*60)

    import ollama
    from app.core.config import settings

    print(f"[INFO] Modèle: {settings.ollama_model}")

    try:
        # Test simple
        t0 = time.time()
        response = ollama.chat(
            model=settings.ollama_model,
            messages=[{
                "role": "user",
                "content": (
                    "Patient: GB=16800/mm³, neutrophiles 85%, CRP 48mg/L, "
                    "douleur FID, fièvre 38.5°C, signe de Blumberg positif.\n"
                    "En une phrase: quel est le diagnostic le plus probable?"
                )
            }],
            options={"temperature": 0.1, "num_predict": 100}
        )
        elapsed = round(time.time() - t0, 1)
        answer = response["message"]["content"]
        print(f"[OK] Réponse Ollama ({elapsed}s):")
        print(f"     {answer}")

    except Exception as e:
        print(f"[ERREUR] Ollama: {e}")
        print("         Vérifiez que Ollama est lancé: ollama serve")
        print(f"         Et que le modèle est installé: ollama pull {settings.ollama_model}")


async def test_5_full_rag():
    print("\n" + "="*60)
    print("TEST 5 — Pipeline RAG Complet (sans MongoDB)")
    print("="*60)

    from app.services.rag_service import RAGService
    from app.services.text_processor import TextProcessor

    rag = RAGService()

    # Construire le contexte directement (bypass MongoDB)
    processor = TextProcessor()
    context = processor.build_dossier_text(MOCK_PATIENT, MOCK_HOSP)

    print(f"[INFO] Contexte: {len(context)} caractères")
    print("[INFO] Envoi à Ollama pour analyse complète...")

    t0 = time.time()
    summary, diagnostics, findings = await rag._generate_analysis(
        context=context,
        patient_name="Yahia Lacamora",
        analysis_type="full",
        language="fr"
    )
    elapsed = round(time.time() - t0, 1)

    print(f"\n[OK] Analyse complète en {elapsed}s")
    print(f"\n--- RÉSUMÉ ---\n{summary}")
    print(f"\n--- DIAGNOSTICS ({len(diagnostics)}) ---")
    for d in diagnostics:
        print(f"  - {d.condition} [{d.confidence}]: {d.reasoning[:80]}")
        if d.recommended_tests:
            print(f"    Tests: {', '.join(d.recommended_tests)}")
    print(f"\n--- POINTS CLÉS ({len(findings)}) ---")
    for f in findings:
        print(f"  • {f}")


async def main():
    print("HOSPITAL AI — RAG PIPELINE FULL TEST")
    print("="*60)

    # Test 1 — toujours
    chunks = await test_1_text_processing()

    # Test 2 — embedding (commenté = pas de téléchargement)
    # await test_2_embedding_and_index(chunks)

    # Test 3 — retrieval (nécessite test 2)
    # await test_3_retrieval()

    # Test 4 — Ollama (nécessite ollama serve)
    await test_4_ollama()

    # Test 5 — RAG complet (nécessite test 2 + ollama)
    # await test_5_full_rag()

    print("\n" + "="*60)
    print("Tests terminés!")
    print("Pour activer les tests 2-5, décommentez les lignes ci-dessus")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
