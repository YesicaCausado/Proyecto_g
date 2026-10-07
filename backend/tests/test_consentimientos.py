"""
NeuroLearn IA — Pruebas del consentimiento de cámara y micrófono (parche 5).

Casos: aceptar, rechazar (aceptación no explícita), versión desactualizada,
retirar, volver a aceptar (historial), cambio de versión del texto, y que el
chat ignore los indicadores faciales/de voz sin consentimiento vigente.
SQLite en memoria; la IA se reemplaza por un doble.

Ejecutar desde backend/:

    python -m pytest tests/test_consentimientos.py -v
    # o sin pytest:
    python -m unittest tests.test_consentimientos -v
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest import mock

os.environ.setdefault("SECRET_KEY", "test-secret-key-para-pruebas-0123456789")
# BD en memoria: la prueba nunca toca neurolearn.db ni la base de producción.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:?check_same_thread=False")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.consent import UserConsent  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import consent_service  # noqa: E402

FACIAL = {"emotion": "focused", "valence": 0.3, "arousal": 0.5, "attention_score": 0.8,
          "blink_rate": 15, "brow_furrow": 0.1, "smile_intensity": 0.2, "gaze_direction": "center"}
VOICE = {"pitch_mean_hz": 180, "volume_db": -20, "speech_rate_wpm": 130, "voice_tremor": 0.1,
         "energy_level": 0.6, "filler_words_count": 1, "silence_duration_ms": 300}


class ConsentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)

        def _get_db():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        cls.client = TestClient(app, raise_server_exceptions=False)
        db = cls.Session()
        inst = Institution(name="Colegio C", dane_code="44400000001", is_active=True)
        db.add(inst)
        db.flush()
        student = User(username="est_consent", email="est_consent@test.edu.co", full_name="Est",
                       hashed_password="x", role=UserRole.ESTUDIANTE.value, institution_id=inst.id, is_active=True)
        db.add(student)
        db.commit()
        cls.user_id = student.id
        cls.h = {"Authorization": "Bearer " + create_access_token({"sub": student.username}),
                 "User-Agent": "PruebaNavegador/1.0"}
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def me(self):
        return self.client.get("/api/v1/consents/me", headers=self.h).json()["consents"]

    def accept(self, ctype, version="1.0", accepted=True):
        return self.client.post("/api/v1/consents", headers=self.h,
                                json={"consent_type": ctype, "version": version, "accepted": accepted})

    def chat(self, facial=None, voice=None):
        async def fake_generate(prompt, system_prompt="", **kwargs):
            return {"response": "Respuesta de prueba", "provider": "fake", "fallback_used": False}
        body = {"message": "Hola, ¿qué es una fracción?", "topic": "Matemáticas"}
        if facial:
            body["facial_data"] = facial
        if voice:
            body["voice_data"] = voice
        with mock.patch.object(chat_api.ai_manager, "generate", side_effect=fake_generate), \
                mock.patch.object(chat_api.ai_manager, "providers", ["fake"]):
            r = self.client.post("/api/v1/chat/message", headers=self.h, json=body)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["metadata"]["patterns"]

    def test_01_initial_state_and_documents(self):
        state = self.me()
        for ctype in ("camara_facial", "microfono_voz"):
            self.assertFalse(state[ctype]["granted"])
            doc = state[ctype]["document"]
            self.assertEqual(state[ctype]["current_version"], doc["version"])
            for key in ("title", "purpose", "processed", "not_stored", "revocation"):
                self.assertTrue(doc[key], key)
        self.assertEqual(self.client.get("/api/v1/consents/me").status_code, 401)

    def test_02_chat_ignores_media_without_consent(self):
        patterns = self.chat(facial=FACIAL, voice=VOICE)
        self.assertFalse(patterns["P3_facial"]["active"])
        self.assertFalse(patterns["P4_voice"]["active"])

    def test_03_reject_and_wrong_version(self):
        self.assertEqual(self.accept("camara_facial", accepted=False).status_code, 400)
        self.assertEqual(self.accept("camara_facial", version="0.9").status_code, 409)
        self.assertEqual(self.accept("otra_cosa").status_code, 422)
        self.assertFalse(self.me()["camara_facial"]["granted"])

    def test_04_accept_records_audit_data(self):
        r = self.accept("camara_facial")
        self.assertEqual(r.status_code, 201, r.text)
        self.assertTrue(r.json()["consents"]["camara_facial"]["granted"])
        self.assertTrue(r.json()["consents"]["camara_facial"]["granted_at"].endswith("Z"))
        self.assertEqual(self.accept("camara_facial").status_code, 201)       # idempotente
        db = self.Session()
        rows = db.query(UserConsent).filter_by(user_id=self.user_id, consent_type="camara_facial").all()
        db.close()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].version, "1.0")
        self.assertEqual(rows[0].user_agent, "PruebaNavegador/1.0")
        self.assertIsNotNone(rows[0].granted_at)
        # Con consentimiento de cámara (y sin el de micrófono)
        patterns = self.chat(facial=FACIAL, voice=VOICE)
        self.assertTrue(patterns["P3_facial"]["active"])
        self.assertFalse(patterns["P4_voice"]["active"])

    def test_05_revoke_and_accept_again(self):
        self.accept("microfono_voz")
        self.assertTrue(self.me()["microfono_voz"]["granted"])
        r = self.client.delete("/api/v1/consents/microfono_voz", headers=self.h)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["consents"]["microfono_voz"]["granted"])
        self.assertFalse(self.chat(voice=VOICE)["P4_voice"]["active"])
        self.accept("microfono_voz")
        db = self.Session()
        rows = db.query(UserConsent).filter_by(user_id=self.user_id, consent_type="microfono_voz") \
            .order_by(UserConsent.id).all()
        db.close()
        self.assertEqual(len(rows), 2)                       # historial
        self.assertIsNotNone(rows[0].revoked_at)
        self.assertIsNone(rows[1].revoked_at)
        self.assertTrue(self.chat(voice=VOICE)["P4_voice"]["active"])

    def test_06_new_text_version_requires_new_consent(self):
        self.accept("camara_facial")
        docs = {k: dict(v) for k, v in consent_service.CONSENT_DOCUMENTS.items()}
        docs["camara_facial"]["version"] = "2.0"
        with mock.patch.object(consent_service, "CONSENT_DOCUMENTS", docs):
            state = self.me()["camara_facial"]
            self.assertFalse(state["granted"])
            self.assertEqual(state["current_version"], "2.0")
            self.assertFalse(self.chat(facial=FACIAL)["P3_facial"]["active"])
            self.assertEqual(self.accept("camara_facial", version="2.0").status_code, 201)
            self.assertTrue(self.me()["camara_facial"]["granted"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
