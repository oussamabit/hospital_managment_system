"""
test_api_e2e.py — اختبار API الكامل من طرف إلى طرف
يتحقق من أن FastAPI يعمل ويستجيب بشكل صحيح

شغّله: python tests/test_api_e2e.py
يجب أن يكون FastAPI شغّالاً: python main.py
"""
import asyncio
import httpx
import json
import sys
import time

BASE_URL = "http://localhost:8000"
TIMEOUT  = 120  # ثانية للـ LLM


async def test_health():
    """اختبار endpoint الصحة"""
    print("\n" + "=" * 55)
    print("TEST 1 — Health Check")
    print("=" * 55)

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            res = await client.get(f"{BASE_URL}/api/health")
            data = res.json()

            print(f"  Status:           {data['status']}")
            print(f"  Ollama available: {data['ollama_available']}")
            print(f"  Ollama model:     {data['ollama_model']}")
            print(f"  Embedding model:  {data['embedding_model']}")
            print(f"  ChromaDB:         {data['chroma_db']}")
            print(f"  MongoDB:          {data['mongodb']}")

            assert res.status_code == 200, f"Expected 200, got {res.status_code}"
            print("\n  [OK] Health check passed!")
            return data

        except httpx.ConnectError:
            print("  [ERROR] Cannot connect to FastAPI.")
            print("          Start it first: python main.py")
            sys.exit(1)


async def test_index_dossier():
    """اختبار فهرسة دوسية"""
    print("\n" + "=" * 55)
    print("TEST 2 — Index Dossier")
    print("=" * 55)

    # ملاحظة: هذا يحتاج patient_id حقيقي في MongoDB
    # نستخدم ID وهمي لاختبار الـ error handling
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{BASE_URL}/api/ai/index", json={
            "patient_id": "test_patient_fake_000",
            "force_reindex": False,
        })

        print(f"  Status code: {res.status_code}")
        data = res.json()
        print(f"  Response: {json.dumps(data, ensure_ascii=False, indent=2)}")

        if res.status_code == 404:
            print("  [OK] Correct 404 for non-existent patient")
        elif res.status_code == 200:
            print(f"  [OK] Indexed {data.get('chunks_indexed', 0)} chunks")
        else:
            print(f"  [WARN] Unexpected status: {res.status_code}")


async def test_analyze_dossier(patient_id: str, hosp_id: str | None = None):
    """اختبار التحليل الكامل"""
    print("\n" + "=" * 55)
    print("TEST 3 — Full Analysis")
    print("=" * 55)

    request_body = {
        "patient_id": patient_id,
        "hospitalization_id": hosp_id,
        "language": "fr",
        "analysis_type": "full",
    }

    print(f"  Request: {json.dumps(request_body, indent=2)}")
    print(f"  Waiting for LLM (up to {TIMEOUT}s)...")

    t0 = time.time()
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            res = await client.post(f"{BASE_URL}/api/ai/analyze", json=request_body)
            elapsed = round(time.time() - t0, 1)

            print(f"\n  Status: {res.status_code} ({elapsed}s)")

            if res.status_code == 200:
                data = res.json()
                print(f"\n  Patient:     {data['patient_name']}")
                print(f"  Model used:  {data['model_used']}")
                print(f"  Time:        {data['processing_time_seconds']}s")
                print(f"\n  === SUMMARY ===")
                print(f"  {data['summary'][:300]}...")
                print(f"\n  === KEY FINDINGS ({len(data['key_findings'])}) ===")
                for f in data['key_findings'][:3]:
                    print(f"  • {f}")
                print(f"\n  === DIAGNOSTICS ({len(data['diagnostic_suggestions'])}) ===")
                for d in data['diagnostic_suggestions'][:3]:
                    print(f"  [{d['confidence']}] {d['condition']}")
                    print(f"         {d['reasoning'][:80]}")
                    if d['recommended_tests']:
                        print(f"         Tests: {', '.join(d['recommended_tests'])}")
                print("\n  [OK] Analysis completed successfully!")

            elif res.status_code == 404:
                print(f"  [INFO] Patient not found: {res.json()['detail']}")
            elif res.status_code == 503:
                print(f"  [ERROR] LLM not available: {res.json()['detail']}")
            else:
                print(f"  [ERROR] {res.status_code}: {res.text[:200]}")

        except httpx.ReadTimeout:
            print(f"  [TIMEOUT] LLM took more than {TIMEOUT}s")
            print("            Try: ollama pull mistral:7b-instruct-q4_0 (lighter model)")


async def test_stats():
    """اختبار إحصائيات النظام"""
    print("\n" + "=" * 55)
    print("TEST 4 — System Stats")
    print("=" * 55)

    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{BASE_URL}/api/ai/stats")
        data = res.json()
        print(f"  ChromaDB: {json.dumps(data.get('chroma_db', {}), indent=4)}")
        print("  [OK] Stats endpoint working!")


async def test_docs():
    """تحقق من وجود Swagger docs"""
    print("\n" + "=" * 55)
    print("TEST 5 — Swagger Docs")
    print("=" * 55)

    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{BASE_URL}/docs")
        assert res.status_code == 200
        print(f"  Swagger UI available at: {BASE_URL}/docs")
        print("  [OK] API documentation accessible!")


async def main():
    print("\n" + "=" * 55)
    print("  HOSPITAL AI — END TO END API TESTS")
    print(f"  Target: {BASE_URL}")
    print("=" * 55)

    # Test 1: Health (always run)
    health = await test_health()

    # Test 2: Index (always run)
    await test_index_dossier()

    # Test 3: Analysis — remplace par un patient_id réel de ta DB
    # Exemple: await test_analyze_dossier("64f1a2b3c4d5e6f7a8b9c0d1")
    print("\n" + "=" * 55)
    print("TEST 3 — Full Analysis")
    print("=" * 55)
    print("  [SKIP] Provide a real patient_id to test:")
    print("         await test_analyze_dossier('YOUR_PATIENT_ID_HERE')")
    print("         Uncomment the line in test_api_e2e.py -> main()")

    # Test 4: Stats
    await test_stats()

    # Test 5: Docs
    await test_docs()

    print("\n" + "=" * 55)
    print("  ALL TESTS COMPLETED")
    print("  Open http://localhost:8000/docs to explore the API")
    print("=" * 55)


if __name__ == "__main__":
    # لتشغيل تحليل حقيقي، عدّل هذا:
    # python tests/test_api_e2e.py YOUR_PATIENT_ID
    if len(sys.argv) > 1:
        patient_id = sys.argv[1]
        hosp_id    = sys.argv[2] if len(sys.argv) > 2 else None
        async def run():
            await test_health()
            await test_analyze_dossier(patient_id, hosp_id)
        asyncio.run(run())
    else:
        asyncio.run(main())
