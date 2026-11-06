"""
NeuroLearn IA — Carga masiva de profesores y estudiantes (plantillas CSV).

Comprueba que el archivo que genera el botón «Descargar plantilla» del Súper
Profesor (UsersTabs.tsx: BOM UTF-8, punto y coma, CRLF) pasa por la revisión y la
creación, y que también se aceptan los formatos con que Excel en español
vuelve a guardarlo (punto y coma, Windows-1252, «sep=,», fecha DD/MM/AAAA).

SQLite en memoria. Ejecutar desde backend/:

    python -m pytest tests/test_carga_masiva.py -v
"""
from __future__ import annotations

import os
import sys
import unittest
import unittest.mock
import csv
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token, verify_password  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"

# Idénticas a los encabezados descargados desde UsersTabs.tsx.
TEACHER_HEADERS = "nombre_completo,tipo_documento,numero_documento,correo,area"
TEACHER_EXAMPLE = "Carlos Alvarez,CC,1023456789,carlos.alvarez.docente@example.com,Matemáticas"
STUDENT_HEADERS = (
    "nombre_completo,tipo_documento,numero_documento,correo,grado,fecha_nacimiento,nombre_acudiente"
)
STUDENT_EXAMPLE = (
    "Carlos Alvarez,TI,1098765432,carlos.alvarez.estudiante@example.com,10°,2009-05-14,Maria Alvarez"
)


def template_bytes(headers: str, *rows: str, delimiter: str = ",") -> bytes:
    source_rows = [next(csv.reader([row])) for row in (headers, *rows)]
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=delimiter, lineterminator="\r\n", quoting=csv.QUOTE_ALL)
    writer.writerows(source_rows)
    separator = f"sep={delimiter}\r\n" if delimiter != "," else ""
    return ("\ufeff" + separator + output.getvalue()).encode("utf-8")


class CargaMasivaTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        def _get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        self.client = TestClient(app, raise_server_exceptions=False)
        db = self.Session()
        inst = Institution(name="Colegio Pruebas", dane_code="71100000001", is_active=True)
        db.add(inst)
        db.flush()
        for username, role in (("super", UserRole.SUPER_PROFESOR), ("profe", UserRole.PROFESOR),
                               ("est", UserRole.ESTUDIANTE)):
            db.add(User(username=username, email=f"{username}@t.edu.co", full_name=username.title(),
                        hashed_password="x", role=role.value, institution_id=inst.id, is_active=True))
        db.commit()
        db.close()
        self.mail = unittest.mock.patch("app.api.credentials.send_credentials_email")
        self.mail_mock = self.mail.start()
        self.mail_mock.return_value = True

    def tearDown(self):
        self.mail.stop()
        app.dependency_overrides.pop(get_db, None)

    def h(self, username="super"):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def send(self, kind: str, step: str, content: bytes, who="super"):
        data = {"authorization_confirmed": "true"} if kind == "students" and step == "bulk" else None
        return self.client.post(f"{API}/super/{kind}/{step}", headers=self.h(who),
                                files={"file": ("lote.csv", content, "text/csv")}, data=data)

    def user(self, doc):
        db = self.Session()
        try:
            return db.query(User).filter_by(document_number=doc).first()
        finally:
            db.close()

    def user_by_username(self, username):
        db = self.Session()
        try:
            return db.query(User).filter_by(username=username).first()
        finally:
            db.close()

    # ── Plantillas tal como se descargan ─────────────────────────────────
    def test_plantilla_de_profesores_completa_el_flujo(self):
        content = template_bytes(TEACHER_HEADERS, TEACHER_EXAMPLE, delimiter=";")
        content += b'"# Instrucciones: reemplaza la fila de ejemplo; conserva las columnas."\r\n'
        preview = self.send("teachers", "preview", content)
        self.assertEqual(preview.status_code, 200, preview.text)
        self.assertEqual((preview.json()["total_valid"], preview.json()["total_errors"]), (1, 0))
        r = self.send("teachers", "bulk", content)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["total_created"], 1)
        u = self.user("1023456789")
        self.assertEqual((u.full_name, u.role, u.document_type, u.subject_area, u.email),
                         ("Carlos Alvarez", "profesor", "CC", "Matemáticas", "carlos.alvarez.docente@example.com"))
        # Volver a subir el mismo archivo no duplica.
        again = self.send("teachers", "bulk", content)
        self.assertEqual(again.status_code, 422)
        self.assertEqual(again.json()["detail"]["errors"][0]["error"], "Documento duplicado en el sistema")
        db = self.Session()
        self.assertEqual(        db.query(User).filter_by(document_number="1023456789").count(), 1)
        db.close()

    def test_plantilla_de_estudiantes_completa_el_flujo(self):
        content = template_bytes(STUDENT_HEADERS, STUDENT_EXAMPLE, delimiter=";")
        content += b'"# Instrucciones: reemplaza la fila de ejemplo; conserva las columnas."\r\n'
        preview = self.send("students", "preview", content).json()
        self.assertEqual((preview["total_valid"], preview["total_errors"]), (1, 0))
        r = self.send("students", "bulk", content)
        self.assertEqual(r.status_code, 201, r.text)
        u = self.user("1098765432")
        self.assertEqual((u.full_name, u.role, u.document_type, u.grade, u.birth_date),
                         ("Carlos Alvarez", "estudiante", "TI", "10°", "2009-05-14"))
        self.assertEqual(u.guardian_name, "Maria Alvarez")
        self.assertIsNotNone(u.guardian_authorized_at)

    def test_plantilla_de_estudiantes_admite_varios_registros(self):
        second_student = (
            "Lucía Ríos,TI,1098765433,lucia.rios@colegio.edu.co,9°,2010-08-20,Paula Ríos"
        )
        content = template_bytes(
            STUDENT_HEADERS, STUDENT_EXAMPLE, second_student, delimiter=";"
        )

        preview = self.send("students", "preview", content).json()
        self.assertEqual((preview["total_valid"], preview["total_errors"]), (2, 0))

        response = self.send("students", "bulk", content)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["total_created"], 2)

    def test_creacion_individual_de_menor_solo_requiere_nombre_del_acudiente(self):
        response = self.client.post(
            f"{API}/super/students",
            headers=self.h(),
            json={
                "full_name": "Ana Gomez",
                "document_type": "TI",
                "document_number": "6000000002",
                "email": "ana2@colegio.edu.co",
                "birth_date": "2010-05-14",
                "guardian_authorization_confirmed": True,
                "guardian_name": "Maria Gomez",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        student = self.user("6000000002")
        self.assertEqual(student.guardian_name, "Maria Gomez")
        self.assertIsNone(student.guardian_consent_date)
        self.assertIsNone(student.guardian_authorization_reference)

    def test_creacion_individual_de_menor_sin_nombre_del_acudiente_es_rechazada(self):
        response = self.client.post(
            f"{API}/super/students",
            headers=self.h(),
            json={
                "full_name": "Ana Gomez",
                "document_type": "TI",
                "document_number": "6000000003",
                "email": "ana3@colegio.edu.co",
                "birth_date": "2010-05-14",
                "guardian_authorization_confirmed": True,
            },
        )
        self.assertEqual(response.status_code, 400, response.text)
        self.assertIn("nombre del acudiente", response.json()["detail"])

    def test_edicion_registra_autorizacion_con_solo_nombre_del_acudiente(self):
        student = self.user_by_username("est")
        response = self.client.put(
            f"{API}/super/students/{student.id}",
            headers=self.h(),
            json={"guardian_name": "Maria Gomez", "guardian_authorized": True},
        )
        self.assertEqual(response.status_code, 200, response.text)
        updated = self.user_by_username("est")
        self.assertEqual(updated.guardian_name, "Maria Gomez")
        self.assertIsNotNone(updated.guardian_authorized_at)

    def test_plantilla_solo_con_encabezados_no_crea_usuarios(self):
        content = template_bytes(STUDENT_HEADERS)
        preview = self.send("students", "preview", content)
        self.assertEqual(preview.status_code, 200, preview.text)
        self.assertEqual((preview.json()["total_valid"], preview.json()["total_errors"]), (0, 0))
        db = self.Session()
        try:
            self.assertEqual(db.query(User).filter_by(document_number="1098765432").count(), 0)
        finally:
            db.close()

    # ── Como lo guarda Excel en español ──────────────────────────────────
    def test_excel_en_espanol_punto_y_coma_ansi_y_fecha_local(self):
        content = (
            STUDENT_HEADERS.replace(",", ";") + "\r\n"
            "José Peña;ti;2000000001;jose@colegio.edu.co;11°;14/05/2000;;;;\r\n"
        ).encode("cp1252")
        preview = self.send("students", "preview", content)
        self.assertEqual(preview.status_code, 200, preview.text)
        self.assertEqual(preview.json()["total_valid"], 1, preview.json())
        self.assertEqual(self.send("students", "bulk", content).status_code, 201)
        u = self.user("2000000001")
        self.assertEqual((u.full_name, u.document_type, u.grade, u.birth_date), ("José Peña", "TI", "11°", "2000-05-14"))

    def test_linea_sep_de_excel(self):
        content = ("sep=,\r\n" + TEACHER_HEADERS + "\r\nLuz Ríos,CE,3000000001,luz@colegio.edu.co,\r\n").encode("utf-8")
        self.assertEqual(self.send("teachers", "preview", content).json()["total_valid"], 1)

    # ── Errores comprensibles ────────────────────────────────────────────
    def test_encabezado_incompleto_devuelve_400_con_las_columnas(self):
        r = self.send("teachers", "preview", b"nombre_completo,tipo_documento,numero_documento\r\nX,CC,1\r\n")
        self.assertEqual(r.status_code, 400)
        missing_columns = [e["column"] for e in r.json()["detail"]["errors"]]
        self.assertIn("correo", missing_columns)
        missing_student_email = self.send(
            "students", "preview",
            b"nombre_completo,tipo_documento,numero_documento\r\nAna,TI,1234567890\r\n",
        )
        self.assertEqual(missing_student_email.status_code, 400)
        self.assertIn("correo", [e["column"] for e in missing_student_email.json()["detail"]["errors"]])
        self.assertEqual(self.send("students", "bulk", b"").status_code, 400)

    def test_encabezados_extras_y_duplicados_son_rechazados(self):
        extra = self.send(
            "teachers",
            "preview",
            b"nombre_completo,tipo_documento,numero_documento,correo,area,contrase\xc3\xb1a\r\n",
        )
        self.assertEqual(extra.status_code, 400)
        self.assertTrue(any(e["column"] == "contraseña" for e in extra.json()["detail"]["errors"]))
        duplicate = self.send(
            "teachers",
            "preview",
            b"nombre_completo,tipo_documento,numero_documento,correo,area,correo\r\n",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertTrue(any(e["error"] == "Encabezado duplicado" for e in duplicate.json()["detail"]["errors"]))

    def test_filas_cortas_o_con_columnas_adicionales_indican_fila_y_columna(self):
        short = self.send(
            "teachers",
            "preview",
            b"nombre_completo,tipo_documento,numero_documento,correo,area\r\nAna,CC,5000000001,ana@example.com\r\n",
        )
        self.assertEqual(short.status_code, 200)
        self.assertEqual(short.json()["errors"][0]["row"], 2)
        self.assertEqual(short.json()["errors"][0]["column"], "area")

        extra = self.send(
            "teachers",
            "preview",
            b"nombre_completo,tipo_documento,numero_documento,correo,area\r\nAna,CC,5000000001,ana@example.com,Matem\xc3\xa1ticas,extra\r\n",
        )
        self.assertEqual(extra.status_code, 200)
        self.assertEqual(extra.json()["errors"][0]["column"], "columnas_adicionales")

    def test_creacion_individual_de_estudiante_exige_correo(self):
        response = self.client.post(
            f"{API}/super/students",
            headers=self.h(),
            json={
                "full_name": "Ana Gomez",
                "document_type": "TI",
                "document_number": "6000000001",
                "guardian_authorization_confirmed": True,
            },
        )
        self.assertEqual(response.status_code, 422, response.text)
        self.assertTrue(any(error["field"] == "email" for error in response.json()["errors"]))

    def test_filas_invalidas_indican_fila_y_campo(self):
        content = template_bytes(
            STUDENT_HEADERS,
            "Uno,XX,4000000001,uno@colegio.edu.co,9,,,,",  # fila 2: tipo de documento
            "Dos,TI,4000000002,dos@colegio.edu.co,9,31/02/2009,,,,",  # fila 3: fecha imposible
            "Tres,TI,4000000003,correo-malo,9,,,,",  # fila 4: correo
            "Cuatro,TI,4000000004,cuatro@colegio.edu.co,9,2000-01-20,,,,",  # fila 5: válida
        )
        preview = self.send("students", "preview", content).json()
        errors = {e["row"]: e["error"] for e in preview["errors"]}
        self.assertEqual(preview["total_valid"], 1)
        self.assertEqual(preview["errors"][0]["column"], "tipo_documento")
        self.assertIn("fecha_nacimiento", errors[3])
        self.assertIn("Correo inválido", errors[4])
        bulk = self.send("students", "bulk", content)
        self.assertEqual(bulk.status_code, 422)
        self.assertEqual(bulk.json()["detail"]["errors"][0]["row"], 2)
        self.assertTrue(all(error.get("column") for error in bulk.json()["detail"]["errors"]))
        self.assertIsNone(self.user("4000000001"))
        self.assertIsNone(self.user("4000000004"))

    def test_revision_de_profesores_detecta_duplicados_del_archivo(self):
        content = template_bytes(
            TEACHER_HEADERS,
            "Ana,CC,5000000001,ana@colegio.edu.co,",
            "Ana Repetida,CC,5000000001,otra@colegio.edu.co,",
            "Beto,CC,5000000002,ana@colegio.edu.co,",
        )
        preview = self.send("teachers", "preview", content).json()
        bulk = self.send("teachers", "bulk", content)
        self.assertEqual((preview["total_valid"], preview["total_errors"]), (1, 2))
        self.assertEqual(bulk.status_code, 422)
        self.assertEqual(len(bulk.json()["detail"]["errors"]), 2)
        self.assertIsNone(self.user("5000000001"))

    def test_super_profesor_regenera_credenciales_y_obliga_nuevo_cambio_de_clave(self):
        teacher = self.user_by_username("profe")
        previous_session = create_access_token({"sub": "profe"})
        response = self.client.post(
            f"{API}/super/teachers/{teacher.id}/credentials/regenerate",
            headers=self.h(),
        )
        self.assertEqual(response.status_code, 200, response.text)
        credential = response.json()
        updated = self.user_by_username("profe")
        self.assertEqual(credential["username"], "profe")
        self.assertTrue(credential["email_sent"])
        self.assertTrue(verify_password(credential["temp_password"], updated.hashed_password))
        self.assertTrue(updated.must_change_password)
        self.assertIsNotNone(updated.sessions_valid_after)
        self.mail_mock.assert_called_once()
        stale_session = self.client.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {previous_session}"},
        )
        self.assertEqual(stale_session.status_code, 401)
        login = self.client.post(
            f"{API}/auth/login",
            json={"username": credential["username"], "password": credential["temp_password"]},
        )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertTrue(login.json()["must_change_password"])

    def test_super_profesor_regenera_credenciales_de_estudiantes(self):
        student = self.user_by_username("est")
        response = self.client.post(
            f"{API}/super/students/{student.id}/credentials/regenerate",
            headers=self.h(),
        )
        self.assertEqual(response.status_code, 200, response.text)
        credential = response.json()
        updated = self.user_by_username("est")
        self.assertEqual(credential["username"], "est")
        self.assertTrue(verify_password(credential["temp_password"], updated.hashed_password))
        self.assertTrue(updated.must_change_password)

    def test_regeneracion_informa_si_no_se_pudo_enviar_el_correo(self):
        self.mail_mock.return_value = False
        teacher = self.user_by_username("profe")
        response = self.client.post(
            f"{API}/super/teachers/{teacher.id}/credentials/regenerate",
            headers=self.h(),
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["email_sent"])
        self.assertTrue(verify_password(
            response.json()["temp_password"],
            self.user_by_username("profe").hashed_password,
        ))

    def test_super_profesor_no_puede_regenerar_un_rol_ajeno_o_otra_institucion(self):
        student = self.user_by_username("est")
        wrong_role = self.client.post(
            f"{API}/super/teachers/{student.id}/credentials/regenerate",
            headers=self.h(),
        )
        self.assertEqual(wrong_role.status_code, 404)
        db = self.Session()
        other = Institution(name="Otra institución", dane_code="71100000002", is_active=True)
        db.add(other)
        db.flush()
        foreign_student = User(
            username="estudiante_ajeno",
            email="ajeno@example.com",
            full_name="Estudiante Ajeno",
            hashed_password="x",
            role=UserRole.ESTUDIANTE.value,
            institution_id=other.id,
            is_active=True,
        )
        db.add(foreign_student)
        db.commit()
        foreign_id = foreign_student.id
        db.close()
        foreign = self.client.post(
            f"{API}/super/students/{foreign_id}/credentials/regenerate",
            headers=self.h(),
        )
        self.assertEqual(foreign.status_code, 404)
        forbidden = self.client.post(
            f"{API}/super/students/{student.id}/credentials/regenerate",
            headers=self.h("profe"),
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_solo_el_super_profesor_puede_cargar(self):
        content = template_bytes(TEACHER_HEADERS, TEACHER_EXAMPLE)
        for who in ("profe", "est"):
            for kind in ("teachers", "students"):
                for step in ("preview", "bulk"):
                    self.assertEqual(self.send(kind, step, content, who=who).status_code, 403, (who, kind, step))
        self.assertIsNone(self.user("1234567890"))


if __name__ == "__main__":
    unittest.main()
