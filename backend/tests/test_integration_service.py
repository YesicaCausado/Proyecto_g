r"""
NeuroLearn AI — Pruebas del motor de Integraciones y Automatizaciones
======================================================================
Valida los mecanismos reales que usa la página Docente Pro → Integraciones:

1. Cifrado/descifrado de tokens con la SECRET_KEY del servidor (roundtrip).
2. Webhook: envío de una petición HTTP POST real a un servidor local de
   prueba y verificación de la respuesta (conexión real de extremo a extremo).
3. Motor de automatizaciones: una automatización "crear_alerta" se configura,
   se persiste y se dispara, y queda registrada una ejecución en la tabla
   automation_executions (trazabilidad real).
4. Acción "webhook": una automatización webhook ejecuta un POST real y se
   marca como ok/error según la respuesta del servidor.

Uso de una base SQLite en memoria — NO toca la base real de Supabase.

Ejecutar (sin necesidad de `pytest`):

    cd backend
    .venv\Scripts\python.exe tests\test_integration_service.py

O con pytest (si está instalado):

    .venv\Scripts\python.exe -m pytest tests\test_integration_service.py -v
"""
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone

# La clave del servidor debe existir ANTES de importar integration_service
# (Settings lee variables de entorno).
os.environ.setdefault("SECRET_KEY", "test-secret-key-para-pruebas-0123456789")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


# ── 0. Servidor HTTP local para probar el webhook real ────────────────────────
class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8", "replace")
        # Guarda el body para poder inspeccionarlo después.
        _Handler.received = body
        data = ('{"ok": true, "echo": %s}' % length).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):  # silencio
        pass


def _start_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    _Handler.received = ""
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server


def test_token_encryption_roundtrip():
    from app.services import integration_service as isvc

    plain_access = "ya29.access_token_prueba_12345"
    plain_refresh = "1//refresh.token_prueba_xyz"

    enc_a = isvc.encrypt_token(plain_access)
    enc_r = isvc.encrypt_token(plain_refresh)

    assert enc_a is not None
    assert enc_r is not None
    # El ciphertext no debe contener el secreto en claro.
    assert "access_token_prueba" not in enc_a

    assert isvc.decrypt_token(enc_a) == plain_access
    assert isvc.decrypt_token(enc_r) == plain_refresh
    # Descifrar un valor inválido devuelve None.
    assert isvc.decrypt_token("no-es-ciphertext") is None
    assert isvc.decrypt_token(None) is None
    print("  ✔ Cifrado/descifrado de tokens OK")


def test_webhook_test_request_is_real():
    """Envía un POST real a un servidor local y verifica la respuesta capturada."""
    from app.services import integration_service as isvc

    server = _start_server()
    try:
        url = f"http://127.0.0.1:{server.server_port}/hook"
        result = isvc.test_webhook(url)
        assert result["ok"] is True, result
        assert result["status_code"] == 200
        assert '"ok": true' in (result["response"] or "")
        assert "webhook.test" in getattr(_Handler, "received", "")
    finally:
        server.shutdown()
    print("  ✔ Webhook real (POST a servidor local) OK")


def test_automation_create_alerta_dispatches_and_records():
    """Crea una automatización 'crear_alerta', la dispara y comprueba ejecución."""
    from sqlalchemy import create_engine, inspect
    from sqlalchemy.orm import sessionmaker
    from app.db.database import Base
    # Registrar TODOS los modelos (igual que main.py) para que SQLAlchemy
    # resuelva las relaciones de User → LearningSession, ExpertBot, etc.
    import app.models.learning      # noqa: F401  (define LearningSession)
    import app.models.expert_bot    # noqa: F401
    import app.models.classroom     # noqa: F401
    import app.models.events        # noqa: F401
    import app.models.messages      # noqa: F401
    from app.models.user import User
    from app.models.institution import Institution
    from app.models.integration import (
        Integration, Automation,
        AutomationTrigger, AutomationAction, AutomationExecution,
    )
    from app.services import integration_service as isvc

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    inst = Institution(id=None, name="Colegio Test", dane_code="123456789",
                       license_type="pro", is_active=True)
    db.add(inst)
    db.commit()
    db.refresh(inst)

    teacher = User(username="prof.test", email="prof@test.co", role="PROFESOR",
                   institution_id=inst.id, is_active=True, hashed_password="x")
    db.add(teacher)
    db.commit()
    db.refresh(teacher)

    autom = Automation(
        institution_id=inst.id,
        created_by=teacher.id,
        name="Alerta de bajo rendimiento",
        trigger=AutomationTrigger.BAJO_RENDIMIENTO,
        action=AutomationAction.CREAR_ALERTA,
        configuration={"threshold": 60},
        enabled=True,
    )
    db.add(autom)
    db.commit()
    db.refresh(autom)

    # Disparo real vía el motor de automatizaciones.
    results = isvc.dispatch_trigger(db, teacher, AutomationTrigger.BAJO_RENDIMIENTO, {
        "event_desc": "Bajo rendimiento: Ana (45%)",
        "title": "Alerta de bajo rendimiento",
        "alert_title": "Alerta automática",
        "alert_message": "Ana cayó por debajo del umbral.",
    })

    assert results, "Debió ejecutarse al menos una automatización"
    assert results[0]["ok"] is True, results[0]

    # Trazabilidad real: debe existir una fila de ejecución.
    execs = db.query(AutomationExecution).filter(
        AutomationExecution.automation_id == autom.id
    ).all()
    assert len(execs) == 1, "Debe haberse registrado una ejecución"
    assert execs[0].status == "ok"
    assert "Ana" in (execs[0].event or "")
    db.close()
    print("  ✔ Automatización 'crear_alerta' con trazabilidad OK")


def test_automation_webhook_action_is_real():
    """Una automatización con acción webhook ejecuta un POST real y registra la respuesta."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.db.database import Base
    import app.models.learning      # noqa: F401
    import app.models.expert_bot    # noqa: F401
    import app.models.classroom     # noqa: F401
    import app.models.events        # noqa: F401
    import app.models.messages      # noqa: F401
    from app.models.user import User
    from app.models.institution import Institution
    from app.models.integration import (
        Integration, IntegrationProvider,
        Automation, AutomationTrigger, AutomationAction, AutomationExecution,
    )
    from app.services import integration_service as isvc

    server = _start_server()
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        inst = Institution(name="Colegio Test", dane_code="987654321",
                           license_type="pro", is_active=True)
        db.add(inst); db.commit(); db.refresh(inst)
        teacher = User(username="prof.webhook", email="wh@test.co", role="PROFESOR",
                       institution_id=inst.id, is_active=True, hashed_password="x")
        db.add(teacher); db.commit(); db.refresh(teacher)

        url = f"http://127.0.0.1:{server.server_port}/hook"
        wh = Integration(institution_id=inst.id, user_id=teacher.id,
                         provider=IntegrationProvider.WEBHOOK,
                         status="connected", config={"url": url})
        db.add(wh)

        autom = Automation(institution_id=inst.id, created_by=teacher.id,
                           name="Actividad → Webhook", trigger=AutomationTrigger.NUEVA_ACTIVIDAD,
                           action=AutomationAction.WEBHOOK, configuration={}, enabled=True)
        db.add(autom); db.commit(); db.refresh(autom)

        results = isvc.dispatch_trigger(db, teacher, AutomationTrigger.NUEVA_ACTIVIDAD, {
            "event_desc": "Nueva actividad en el tablero",
            "title": "Taller de álgebra",
            "content": "Resolver ejercicios 1..10",
        })

        assert results and results[0]["ok"] is True, results
        assert "Webhook respondió 200" in (results[0]["detail"] or "")

        # El webhook recibió el payload real (el título aparece en el body JSON).
        payload = getattr(_Handler, "received", "")
        assert "Taller" in payload

        # Estado del webhook actualizado con el último status.
        db.refresh(wh)
        assert wh.config["last_status"] == 200

        execs = db.query(AutomationExecution).filter(
            AutomationExecution.automation_id == autom.id).all()
        assert len(execs) == 1 and execs[0].status == "ok"
    finally:
        server.shutdown()
        db.close()
    print("  ✔ Automatización 'webhook' (POST real) OK")


def main():
    print("NeuroLearn — motor de Integraciones y Automatizaciones\n")
    tests = [
        test_token_encryption_roundtrip,
        test_webhook_test_request_is_real,
        test_automation_create_alerta_dispatches_and_records,
        test_automation_webhook_action_is_real,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  ✘ {t.__name__}: {e}")
        except Exception as e:  # noqa: BLE001
            import traceback
            print(f"  ✘ {t.__name__} (excepción): {e}")
            traceback.print_exc(limit=2)
    print(f"\nResultado: {passed}/{len(tests)} pruebas OK")
    return 0 if passed == len(tests) else 1


if __name__ == "__main__":
    raise SystemExit(main())