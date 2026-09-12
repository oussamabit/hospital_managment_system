"""
mongo_service.py — قراءة دوسيات المرضى من MongoDB
يستخدم motor للاتصال الغير متزامن (async)
"""
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from loguru import logger
from typing import Optional

from app.core.config import settings
from app.models.schemas import PatientData, Hospitalization


class MongoService:
    """
    خدمة قراءة البيانات من MongoDB
    نفس قاعدة البيانات التي يستخدمها Node.js backend
    """

    _client: Optional[AsyncIOMotorClient] = None

    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        if cls._client is None:
            cls._client = AsyncIOMotorClient(settings.mongodb_uri)
            logger.info(f"MongoDB connected: {settings.mongodb_uri}")
        return cls._client

    @classmethod
    def get_db(cls):
        return cls.get_client()[settings.mongodb_db_name]

    # ── المريض ──────────────────────────────────────────────────────────────

    @classmethod
    async def get_patient(cls, patient_id: str) -> Optional[PatientData]:
        """جلب بيانات المريض من جدول patients"""
        try:
            db = cls.get_db()
            # MongoDB يخزن الـ ID كـ ObjectId أو String حسب الإعداد
            query = {}
            try:
                query = {"_id": ObjectId(patient_id)}
            except Exception:
                query = {"_id": patient_id}

            doc = await db.patients.find_one(query)
            if not doc:
                logger.warning(f"Patient not found: {patient_id}")
                return None

            # تحويل ObjectId إلى string
            doc["_id"] = str(doc["_id"])
            return PatientData(**doc)

        except Exception as e:
            logger.error(f"Error fetching patient {patient_id}: {e}")
            return None

    # ── الاستشفاء ────────────────────────────────────────────────────────────

    @classmethod
    async def get_hospitalization(
        cls,
        patient_id: str,
        hospitalization_id: Optional[str] = None
    ) -> Optional[Hospitalization]:
        """
        جلب الاستشفاء من جدول hospitalizations
        - إذا أُعطي hospitalization_id → جلب هذا الاستشفاء تحديداً
        - إذا لم يُعطَ → جلب آخر استشفاء للمريض
        """
        try:
            db = cls.get_db()

            if hospitalization_id:
                # استشفاء محدد
                try:
                    query = {"_id": ObjectId(hospitalization_id)}
                except Exception:
                    query = {"_id": hospitalization_id}
                doc = await db.hospitalizations.find_one(query)
            else:
                # آخر استشفاء — مرتب بالتاريخ تنازلياً
                cursor = db.hospitalizations.find(
                    {"patientId": patient_id}
                ).sort("createdAt", -1).limit(1)

                docs = await cursor.to_list(length=1)
                doc = docs[0] if docs else None

            if not doc:
                logger.warning(f"No hospitalization found for patient: {patient_id}")
                return None

            doc["_id"] = str(doc["_id"])
            return Hospitalization(**doc)

        except Exception as e:
            logger.error(f"Error fetching hospitalization: {e}")
            return None

    # ── كل الاستشفاءات ───────────────────────────────────────────────────────

    @classmethod
    async def get_all_hospitalizations(cls, patient_id: str) -> list:
        """جلب كل استشفاءات مريض معين"""
        try:
            db = cls.get_db()
            cursor = db.hospitalizations.find(
                {"patientId": patient_id}
            ).sort("createdAt", -1)

            docs = await cursor.to_list(length=50)
            result = []
            for doc in docs:
                doc["_id"] = str(doc["_id"])
                try:
                    result.append(Hospitalization(**doc))
                except Exception as e:
                    logger.warning(f"Skipping malformed hospitalization: {e}")
            return result

        except Exception as e:
            logger.error(f"Error fetching hospitalizations: {e}")
            return []

    @classmethod
    async def close(cls):
        if cls._client:
            cls._client.close()
            cls._client = None
