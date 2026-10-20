"""
NeuroLearn IA — Pruebas de extremo a extremo de los cinco patrones
neurodigitales (facial, voz, teclado, interacción, rendimiento).

Recorren el flujo  petición del navegador → validación → motor
neuroconductual → persistencia → respuesta de la API (`pattern_status`)  y
verifican la regla de la auditoría: dato inexistente no es cero, dato no
medido no es resultado negativo y error técnico no es una medición válida.

Casos: A medición correcta · B patrón desactivado · C sin eventos · D error
técnico · E cambio de actividad · F duplicados · G datos inválidos ·
H integridad académica · I aislamiento · J estabilidad del motor.

La IA se reemplaza por un doble; la BD es SQLite en memoria. La captura real
de cámara/micrófono en un navegador NO se prueba aquí (ver docs/PRUEBAS.md).

    python -m pytest tests/test_patrones_neurodigitales.py -v
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.ai.cognitive.chat_grader import GRADING_ERROR, parse_verdict  # noqa: E402
from app.ai.cognitive.neuroconductual_engine import (  # noqa: E402
    BehavioralEvent, FacialData, MultimodalCognitiveEngine, VoiceProsodyData,
)
from app.api import chat as chat_api  # noqa: E402
from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.learning import CognitiveEvent  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.schemas.neuro_signals import FacialSignal, VoiceSignal, parse_signal  # noqa: E402
from app.services import consent_service  # noqa: E402

FACIAL = {"valence": 0.2, "arousal": 0.45, "attention_score": 0.8, "blink_rate": 14.0,
          "brow_furrow": 0.1, "smile_intensity": 0.3, "gaze_direction": "screen",
          "emotion": "focused", "valid_frames": 90, "total_frames": 100, "window_ms": 7000}
VOICE = {"voiced_ms": 2600, "window_ms": 6000, "pitch_mean_hz": 1450.0, "volume_db": -24.5,
         "speech_rate_wpm": 128.0, "voice_tremor": 0.08, "energy_level": 0.42,
         "filler_words_count": 1, "silence_duration_ms": 3400, "pause_ratio": 0.567, "pause_count": 3}
INTERACTION = {"window_ms": 9000, "tab_hidden_count": 1, "hidden_ms": 1200,
               "window_blur_count": 1, "suggestion_clicks": 0, "pointer_clicks": 4}
TYPED = {"input_mode": "typed", "response_time_ms": 8200, "typing_speed_cpm": 180.0,
         "pause_before_ms": 2100, "keystrokes": 40, "corrections": 3, "typing_bursts": 2}
QUESTION = "¿Cuál es el resultado de 2 + 2?"


class _FakeAI:
    """Doble de la IA: el calificador (max_tokens=8) devuelve `verdicts` en orden."""

    def __init__(self, verdicts=None, grader_raises=False):
        self.verdicts = list(verdicts or [])
        self.grader_raises = grader_raises

    async def __call__(self, prompt, system_prompt="", **kwargs):
        if kwargs.get("max_tokens") == 8:
            if self.grader_raises:
                raise RuntimeError("proveedor caído")
            return {"response": self.verdicts.pop(0) if self.verdicts else "NEUTRO", "provider": "fake"}
        return {"response": "Respuesta del tutor", "provider": "fake", "fallback_used": False}


class PatronesNeurodigitalesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                                   poolclass=StaticPool)
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
        inst = Institution(name="Colegio P", dane_code="55500000001", is_active=True)
        db.add(inst)
        db.flush()
        users = {}
        for name in ("est_patrones_a", "est_patrones_b"):
            u = User(username=name, email=f"{name}@test.edu.co", full_name=name, hashed_password="x",
                     role=UserRole.ESTUDIANTE.value, institution_id=inst.id, is_active=True,
                     guardian_name="Acudiente", guardian_authorized_at=datetime.utcnow())
            db.add(u)
            db.flush()
            users[name] = u.id
        db.commit()
        db.close()
        cls.user_a, cls.user_b = users["est_patrones_a"], users["est_patrones_b"]
        cls.h = {"Authorization": "Bearer " + create_access_token({"sub": "est_patrones_a"})}
        cls.hb = {"Authorization": "Bearer " + create_access_token({"sub": "est_patrones_b"})}
        for ctype in ("camara_facial", "microfono_voz"):
            r = cls.client.post("/api/v1/consents", headers=cls.h, json={
                "consent_type": ctype, "version": consent_service.current_version(ctype), "accepted": True})
            assert r.status_code == 201, r.text

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def setUp(self):
        chat_api._user_engines.clear()
        chat_api._load_neural_state_cache.clear()

    # ── utilidades ──────────────────────────────────────────────────────────
    def send(self, headers=None, ai=None, topic="Matemáticas", question=False, expect=200, **fields):
        body = {"message": "Creo que la respuesta es 4", "topic": topic, **fields}
        if question:
            body["history"] = [{"role": "assistant", "content": "Hola, empecemos."},
                               {"role": "assistant", "content": QUESTION}]
        fake = ai or _FakeAI()
        with mock.patch.object(chat_api.ai_manager, "generate", side_effect=fake.__call__), \
                mock.patch.object(chat_api.ai_manager, "providers", ["fake"]):
            r = self.client.post("/api/v1/chat/message", headers=headers or self.h, json=body)
        self.assertEqual(r.status_code, expect, r.text)
        return r.json()

    def events(self, user_id):
        db = self.Session()
        try:
            return db.query(CognitiveEvent).filter(CognitiveEvent.user_id == user_id).all()
        finally:
            db.close()

    # ── A. Medición correcta (todos los patrones con datos válidos) ─────────
    def test_a_medicion_correcta_extremo_a_extremo(self):
        before = len(self.events(self.user_a))
        meta = self.send(topic="Tema A", facial_data=FACIAL, facial_status="active",
                         voice_data=VOICE, voice_status="active",
                         interaction_data=INTERACTION, **TYPED)["metadata"]
        ps = meta["pattern_status"]
        for name in ("facial", "voice", "keyboard", "interaction"):
            self.assertEqual(ps[name]["status"], "available", (name, ps[name]))
            self.assertIsNotNone(ps[name]["measured_at"])
        # Los valores devueltos son exactamente los medidos (sin transformación oculta)
        self.assertEqual(ps["keyboard"]["values"]["typing_speed_cpm"], 180.0)
        self.assertEqual(ps["keyboard"]["values"]["deleted_chars"], 3)
        self.assertEqual(ps["facial"]["values"]["attention_score"], 0.8)
        self.assertEqual(ps["facial"]["values"]["valid_frame_ratio"], 0.9)
        self.assertEqual(ps["voice"]["values"]["volume_dbfs"], -24.5)
        self.assertEqual(ps["voice"]["values"]["voiced_ms"], 2600)
        self.assertEqual(ps["interaction"]["values"]["hidden_ms"], 1200)
        # El motor informa qué contribuyó; la interacción no participa
        weights = meta["engine"]["modality_weights"]
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=3)
        self.assertIn("facial_microexpression", weights)
        self.assertTrue(ps["facial"]["engine"]["used"])
        self.assertFalse(ps["interaction"]["engine"]["used"])
        self.assertEqual(meta["engine"]["status"], "available")
        # Persistencia: un evento, solo metadatos numéricos, sin el texto
        evs = self.events(self.user_a)
        self.assertEqual(len(evs), before + 1)
        data = evs[-1].event_data
        self.assertNotIn("message", data)
        self.assertEqual(data["facial_data"]["attention_score"], 0.8)
        self.assertEqual(data["pattern_status"]["voice"], "available")
        self.assertTrue(data["sufficient_evidence"])

    # ── B. Patrón desactivado / no aplicable ────────────────────────────────
    def test_b_patron_desactivado_no_genera_mediciones(self):
        meta = self.send(topic="Tema B", facial_status="off", voice_status="off", **TYPED)["metadata"]
        ps = meta["pattern_status"]
        self.assertEqual(ps["facial"]["status"], "unavailable")
        self.assertIn("cámara", ps["facial"]["reason"].lower())
        self.assertEqual(ps["facial"]["values"], {})
        # Texto escrito y micrófono apagado: la voz no aplica (no es un fallo)
        self.assertEqual(ps["voice"]["status"], "not_applicable")
        self.assertNotIn("facial_microexpression", meta["engine"]["modality_weights"])
        self.assertIsNone(meta["engine"]["attention_level"])
        data = self.events(self.user_a)[-1].event_data
        self.assertIsNone(data["facial_data"])
        self.assertIsNone(data["voice_data"])
        # Permiso denegado y sin rostro tienen motivos propios
        ps = self.send(topic="Tema B", facial_status="denied", voice_status="insufficient",
                       input_mode="voice")["metadata"]["pattern_status"]
        self.assertIn("denegado", ps["facial"]["reason"])
        self.assertEqual(ps["voice"]["status"], "unavailable")
        self.assertEqual(ps["keyboard"]["status"], "not_applicable")
        ps = self.send(topic="Tema B", facial_status="no_face")["metadata"]["pattern_status"]
        self.assertIn("rostro", ps["facial"]["reason"])

    # ── C. Sin eventos: nada se convierte en cero ───────────────────────────
    def test_c_sin_eventos_no_hay_mediciones_ficticias(self):
        meta = self.send(topic="Tema C")["metadata"]
        ps = meta["pattern_status"]
        self.assertEqual(ps["keyboard"]["status"], "unavailable")
        self.assertEqual(ps["interaction"]["status"], "unavailable")
        self.assertIn(ps["performance"]["status"], ("not_applicable", "unavailable"))
        self.assertEqual(ps["performance"]["values"], {})
        self.assertNotEqual(meta["engine"]["status"], "available")
        self.assertIsNone(meta["engine"]["engagement_score"])
        self.assertIsNone(meta["error_risk"])
        p5 = meta["patterns"]["P5_error_prediction"]
        self.assertIsNone(p5["chat_error_rate"])          # antes 0.0
        self.assertIsNone(p5["quiz_error_rate"])          # antes 0.0
        self.assertFalse(meta["patterns"]["P1_interaction_rhythm"]["active"])

    # ── D. Error técnico ────────────────────────────────────────────────────
    def test_d_error_tecnico_se_informa_sin_inventar(self):
        # Calificador caído: rendimiento en error, no "neutro" ni correcto
        meta = self.send(topic="Tema D", question=True, ai=_FakeAI(grader_raises=True), **TYPED)["metadata"]
        self.assertEqual(meta["pattern_status"]["performance"]["status"], "error")
        self.assertEqual(meta["pattern_status"]["performance"]["values"], {})
        # Señal facial inválida: se rechaza completa, el chat sigue funcionando
        bad = dict(FACIAL, attention_score=1.7)
        ps = self.send(topic="Tema D", facial_data=bad)["metadata"]["pattern_status"]
        self.assertEqual(ps["facial"]["status"], "error")
        self.assertIn("attention_score", ps["facial"]["reason"])
        self.assertIsNone(self.events(self.user_a)[-1].event_data["facial_data"])
        # Fallo del sensor informado por el cliente
        ps = self.send(topic="Tema D", facial_status="error")["metadata"]["pattern_status"]
        self.assertEqual(ps["facial"]["status"], "error")
        # Fallo interno del motor: todos los patrones en error, respuesta 200
        with mock.patch.object(chat_api, "_get_user_engine", side_effect=RuntimeError("motor")):
            meta = self.send(topic="Tema D", **TYPED)["metadata"]
        self.assertEqual(meta["engine"]["status"], "error")
        self.assertTrue(all(v["status"] == "error" for v in meta["pattern_status"].values()))

    # ── E. Cambio de actividad: sin mezcla de datos ─────────────────────────
    def test_e_cambio_de_actividad_no_mezcla_datos(self):
        self.send(topic="Tema E1", facial_data=FACIAL, **TYPED)
        meta = self.send(topic="Tema E2", **TYPED)["metadata"]
        self.assertNotIn("facial_microexpression", meta["engine"]["modality_weights"])
        keys = set(chat_api._user_engines)
        self.assertIn(f"u{self.user_a}:Tema E1", keys)
        self.assertIn(f"u{self.user_a}:Tema E2", keys)
        e2 = chat_api._user_engines[f"u{self.user_a}:Tema E2"]
        self.assertEqual(len(e2.facial_analyzer.facial_data), 0)

    # ── F. Duplicados ───────────────────────────────────────────────────────
    def test_f_reenvio_no_duplica_mediciones_ni_intentos(self):
        ai = _FakeAI(verdicts=["INCORRECTO", "INCORRECTO"])
        first = self.send(topic="Tema F", question=True, ai=ai, client_message_id="msg-f-1", **TYPED)["metadata"]
        n_events = len(self.events(self.user_a))
        second = self.send(topic="Tema F", question=True, ai=ai, client_message_id="msg-f-1", **TYPED)["metadata"]
        self.assertFalse(first["duplicate"])
        self.assertTrue(second["duplicate"])
        self.assertEqual(len(self.events(self.user_a)), n_events)
        self.assertEqual(second["session_stats"]["chat_eval_count"], first["session_stats"]["chat_eval_count"])
        self.assertEqual(second["session_stats"]["msg_count"], first["session_stats"]["msg_count"])
        self.assertEqual(len(ai.verdicts), 1)   # el reenvío no se volvió a calificar

    # ── G. Datos inválidos ──────────────────────────────────────────────────
    def test_g_entradas_invalidas(self):
        self.send(topic="Tema G", expect=422, response_time_ms=-5)
        self.send(topic="Tema G", expect=422, typing_speed_cpm=99999)
        self.send(topic="Tema G", expect=422, input_mode="telepatia")
        self.send(topic="Tema G", expect=422, client_message_id="id con espacios")
        self.send(topic="Tema G", expect=422, facial_status="sonriendo")
        ps = self.send(topic="Tema G", facial_data="no-es-un-objeto",
                       voice_data=dict(VOICE, voiced_ms=99000, window_ms=1000),
                       interaction_data={"window_ms": 1000, "hidden_ms": 5000})["metadata"]["pattern_status"]
        self.assertEqual(ps["facial"]["status"], "error")
        self.assertEqual(ps["voice"]["status"], "error")
        self.assertEqual(ps["interaction"]["status"], "error")
        # Campos desconocidos (p. ej. una imagen) se descartan y no se guardan
        self.send(topic="Tema G", facial_data=dict(FACIAL, frame_png="iVBORw0KGgo..."))
        self.assertNotIn("frame_png", self.events(self.user_a)[-1].event_data["facial_data"])
        # Voz con muy poca voz: no disponible, no se analiza
        ps = self.send(topic="Tema G", voice_data=dict(VOICE, voiced_ms=300, window_ms=5000),
                       input_mode="voice")["metadata"]["pattern_status"]
        self.assertEqual(ps["voice"]["status"], "unavailable")

    # ── H. Integridad académica ─────────────────────────────────────────────
    def test_h_calificacion_y_tasas_correctas(self):
        meta = self.send(topic="Tema H", question=True, ai=_FakeAI(["INCORRECTO"]), **TYPED)["metadata"]
        pe = meta["pattern_status"]["performance"]
        self.assertEqual(pe["status"], "available")
        self.assertIs(pe["values"]["last_answer_correct"], False)    # antes salía True
        self.assertEqual(pe["values"]["chat_eval_count"], 1)
        self.assertEqual(pe["values"]["chat_error_rate"], 1.0)
        meta = self.send(topic="Tema H", question=True, ai=_FakeAI(["CORRECTO"]), **TYPED)["metadata"]
        pe = meta["pattern_status"]["performance"]
        self.assertIs(pe["values"]["last_answer_correct"], True)
        self.assertEqual(pe["values"]["chat_eval_count"], 2)
        self.assertEqual(pe["values"]["chat_error_rate"], 0.5)
        # Un mensaje que no responde una pregunta no suma intentos
        meta = self.send(topic="Tema H", **TYPED)["metadata"]
        self.assertEqual(meta["pattern_status"]["performance"]["values"]["chat_eval_count"], 2)
        # Borrar caracteres no es un error académico
        meta = self.send(topic="Tema H", **dict(TYPED, corrections=40))["metadata"]
        self.assertEqual(meta["session_stats"]["error_streak"], 0)
        # Riesgo de error solo con >= 3 respuestas calificadas
        self.assertIsNone(meta["error_risk"])
        meta = self.send(topic="Tema H", question=True, ai=_FakeAI(["INCORRECTO"]), **TYPED)["metadata"]
        self.assertIsInstance(meta["error_risk"], float)

    def test_h_calificador_no_confunde_incorrecto(self):
        self.assertEqual(parse_verdict("INCORRECTO")[0], "incorrect")
        self.assertEqual(parse_verdict("incorrecto.")[0], "incorrect")
        self.assertEqual(parse_verdict("CORRECTO")[0], "correct")
        self.assertIsNone(parse_verdict("NEUTRO")[0])
        self.assertEqual(parse_verdict("no sé")[0], GRADING_ERROR)

    # ── I. Permisos y aislamiento ───────────────────────────────────────────
    def test_i_aislamiento_entre_estudiantes(self):
        self.send(topic="Tema I", facial_data=FACIAL, **TYPED)
        r = self.client.get("/api/v1/chat/patterns", headers=self.hb)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["total"], 0)
        self.assertEqual(self.client.get("/api/v1/chat/patterns").status_code, 401)
        # B no tiene consentimiento: su señal facial se descarta en el servidor
        ps = self.send(headers=self.hb, topic="Tema I", facial_data=FACIAL)["metadata"]["pattern_status"]
        self.assertEqual(ps["facial"]["status"], "unavailable")
        self.assertIn("consentimiento", ps["facial"]["reason"])
        # No existe forma de registrar mediciones a nombre de otro estudiante
        self.send(topic="Tema I", user_id=self.user_b, **TYPED)
        self.assertEqual(len([e for e in self.events(self.user_b) if e.event_data.get("topic") == "Tema I"]), 1)

    def test_i_patterns_save_valida_senales(self):
        r = self.client.post("/api/v1/chat/patterns/save", headers=self.h,
                             json={"topic": "Tema I", "facial_data": dict(FACIAL, valence=3)})
        self.assertEqual(r.status_code, 422, r.text)

    def test_estadisticas_sin_valores_inventados(self):
        r = self.client.get("/api/v1/stats/performance", headers=self.hb)
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["cognitive_meta"]["status"], "unavailable")
        self.assertTrue(all(v is None for v in body["cognitive"].values()))
        self.assertIsNone(body["overview"]["best_time"])
        dash = self.client.get("/api/v1/stats/dashboard", headers=self.hb).json()
        self.assertIsNone(dash["progress_percentage"])
        self.assertEqual(dash["study_hours"], 0)   # sin 0,5 h ficticias por sesión


class MotorNeuroconductualTests(unittest.TestCase):
    """J. Estabilidad, reproducibilidad y tratamiento de datos faltantes."""

    def test_sin_datos_no_hay_conclusion(self):
        r = MultimodalCognitiveEngine().add_multimodal_event()
        self.assertEqual(r.state.value, "normal")         # antes: "fatigue" (1.er estado)
        self.assertFalse(r.sufficient_evidence)
        self.assertEqual(r.confidence, 0.0)
        self.assertIsNone(r.attention_level)
        self.assertFalse(r.error_risk_available)
        self.assertFalse(r.should_adapt)

    def test_valores_fuera_de_rango_no_se_sustituyen(self):
        eng = MultimodalCognitiveEngine()
        eng.add_behavioral_event(BehavioralEvent(timestamp=datetime.utcnow(), event_type="response",
                                                 response_time_ms=10, typing_speed_cpm=0,
                                                 outcome_known=False))
        ev = eng.rhythm_analyzer.events[-1]
        self.assertEqual(ev.response_time_ms, 0.0)     # antes 3200 (promedio poblacional)
        self.assertEqual(ev.typing_speed_cpm, 0.0)     # antes 140
        self.assertFalse(eng.add_facial_data(FacialData(timestamp=datetime.utcnow(), attention_score=2.0)))
        ok = eng.add_voice_data(VoiceProsodyData(timestamp=datetime.utcnow(), volume_db=-20.0,
                                                 pitch_mean_hz=1500.0, voiced_ms=3000))
        self.assertTrue(ok)
        v = eng.voice_analyzer.voice_data[-1]
        self.assertEqual(v.volume_db, -20.0)           # antes 60 dB inventados
        self.assertEqual(v.pitch_mean_hz, 1500.0)      # antes 150 Hz inventados

    def test_mensajes_sin_calificar_no_alimentan_el_predictor(self):
        eng = MultimodalCognitiveEngine()
        for i in range(5):
            eng.add_multimodal_event(behavioral=BehavioralEvent(
                timestamp=datetime.utcnow() + timedelta(seconds=i), event_type="response",
                response_time_ms=3000, typing_speed_cpm=150, outcome_known=False))
        self.assertEqual(len(eng.error_predictor.interaction_history), 0)
        r = eng.record_chat_answer("x", had_error=True)
        self.assertEqual(len(eng.error_predictor.interaction_history), 1)
        self.assertFalse(r.error_risk_available)

    def test_reproducible_con_mismas_entradas(self):
        def run():
            eng = MultimodalCognitiveEngine()
            t0 = datetime(2026, 1, 1, 10, 0, 0)
            res = None
            for i in range(6):
                res = eng.add_multimodal_event(behavioral=BehavioralEvent(
                    timestamp=t0 + timedelta(seconds=30 * i), event_type="response",
                    response_time_ms=2500 + 300 * i, typing_speed_cpm=170 - 5 * i, outcome_known=False))
            return res
        a, b = run(), run()
        self.assertEqual(a.state_distribution, b.state_distribution)
        self.assertEqual(a.modality_weights, b.modality_weights)

    def test_estado_v1_no_restaura_calibraciones_invalidas(self):
        eng = MultimodalCognitiveEngine()
        ok = eng.restore_state({"version": 1,
                                "voice": {"baseline_volume": 60.0, "calibrated": True},
                                "facial": {"baseline_attn": 0.9, "calibrated": True},
                                "error_prediction": {"prior": 0.9, "interaction_history": [{"had_error": True}] * 5}})
        self.assertTrue(ok)
        self.assertFalse(eng.voice_analyzer._calibrated)
        self.assertFalse(eng.facial_analyzer._calibrated)
        self.assertEqual(eng.error_predictor.interaction_history, [])
        self.assertEqual(eng.serialize_state()["version"], 2)

    def test_esquemas_de_senales(self):
        sig, err = parse_signal(FacialSignal, dict(FACIAL, valid_frames=10, total_frames=5))
        self.assertIsNone(sig)
        self.assertIn("valid_frames", err)
        sig, err = parse_signal(VoiceSignal, {"volume_db": -20})
        self.assertIsNone(sig)
        self.assertIn("voiced_ms", err)
        self.assertEqual(parse_signal(FacialSignal, None), (None, None))


if __name__ == "__main__":
    unittest.main()
