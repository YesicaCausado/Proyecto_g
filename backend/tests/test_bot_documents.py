"""
NeuroLearn IA — Pruebas de la base de conocimiento de los NeuroBots (parche 2).

Cubren el flujo real Profesor → subir documento → extraer → indexar → usar en
el chat, con la API de FastAPI sobre SQLite en memoria. La IA se reemplaza por
un doble que captura el prompt del sistema para comprobar que el NeuroBot
recibe el contenido de sus documentos.

Casos: PDF, DOCX, TXT y Markdown válidos; archivo inválido, demasiado grande,
vacío, MIME que no corresponde, PDF escaneado / protegido / dañado, duplicado;
usuario sin permisos, profesor de otra institución, documento y bot
inexistentes; descarga; eliminación; consulta posterior al NeuroBot
(profesor y estudiante del aula) y estudiante de otra institución.

Ejecutar desde backend/:

    python -m pytest tests/test_bot_documents.py -v
    # o sin pytest:
    python -m unittest tests.test_bot_documents -v
"""
from __future__ import annotations

import io
import logging
import os
import sys
import unittest
import zipfile
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.bot_document import BotDocument, BotDocumentChunk  # noqa: E402
from app.models.classroom import Classroom, ClassroomBot, Enrollment  # noqa: E402
from app.models.expert_bot import ExpertBot  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import bot_documents as svc  # noqa: E402

logging.getLogger("pypdf").setLevel(logging.ERROR)

DOCX_MIME = svc.DOCX_MIME
SECRET_FACT = "El código secreto de la clase es ZETA-47"


# ── Generadores de archivos reales ───────────────────────────────────────────

def make_pdf(lines):
    """PDF mínimo y válido con texto seleccionable (fuente Helvetica)."""
    def esc(t):
        return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    ops = ["BT", "/F1 12 Tf", "72 720 Td", "14 TL"]
    for line in lines:
        ops.append(f"({esc(line)}) Tj T*")
    ops.append("ET")
    stream = "\n".join(ops).encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()


def make_blank_pdf():
    """PDF sin texto (como un documento escaneado)."""
    from pypdf import PdfWriter
    writer = PdfWriter()
    writer.add_blank_page(612, 792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def make_encrypted_pdf():
    from pypdf import PdfReader, PdfWriter
    writer = PdfWriter()
    for page in PdfReader(io.BytesIO(make_pdf(["Contenido protegido de prueba"]))).pages:
        writer.add_page(page)
    writer.encrypt("clave123", algorithm="RC4-128")
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def make_docx(paragraphs):
    """DOCX mínimo y válido (solo word/document.xml y las partes obligatorias)."""
    ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{p}</w:t></w:r></w:p>' for p in paragraphs
    )
    document = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{ns}"><w:body>{body}</w:body></w:document>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '</Relationships>'
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document)
    return buf.getvalue()


TXT_CONTENT = (
    "Guía de Ciencias Naturales — Grado 9\n\n"
    "La fotosíntesis transforma la energía de la luz solar en energía química. "
    "Ocurre en los cloroplastos gracias a la clorofila.\n\n"
    "Las fases de la fotosíntesis son la fase luminosa, en los tilacoides, y el ciclo de Calvin, en el estroma.\n\n"
    f"{SECRET_FACT}; quien lo mencione en el examen recibe una décima extra."
).encode("utf-8")


# ── Pruebas unitarias del servicio (sin BD) ──────────────────────────────────

class ServiceTests(unittest.TestCase):
    def test_extracts_each_format(self):
        cases = [
            ("notas.txt", "text/plain", TXT_CONTENT, "fotosíntesis"),
            ("mitosis.md", "", "# Mitosis\n\nLa **mitosis** produce dos células hijas idénticas.".encode(), "mitosis"),
            ("guia.docx", DOCX_MIME, make_docx(["Capítulo 1", "La célula es la unidad básica de la vida."]), "unidad básica"),
            ("historia.pdf", "application/pdf", make_pdf(["El Grito de Independencia fue el 20 de julio de 1810."]), "20 de julio de 1810"),
        ]
        for name, ctype, raw, expected in cases:
            with self.subTest(name=name):
                clean, ext, _ = svc.validate_upload(name, ctype, raw)
                text, truncated = svc.extract_text(ext, raw)
                self.assertIn(expected, text)
                self.assertFalse(truncated)
                self.assertGreaterEqual(len(svc.chunk_text(text)), 1)

    def test_rejects_invalid_files(self):
        cases = [
            ("programa.exe", "application/x-msdownload", b"MZ" + b"0" * 50, 415),
            ("viejo.doc", "application/msword", b"\xd0\xcf\x11\xe0" + b"0" * 50, 415),
            ("falso.pdf", "application/pdf", b"\x89PNG\r\n" + b"0" * 50, 415),
            ("mime.pdf", "image/png", make_pdf(["texto suficiente para la prueba"]), 415),
            ("binario.txt", "text/plain", b"abc\x00def" * 5, 415),
            ("falso.docx", DOCX_MIME, b"PK\x03\x04" + b"0" * 50, 415),
            ("vacio.txt", "text/plain", b"", 400),
            ("grande.txt", "text/plain", b"a" * (svc.MAX_FILE_BYTES + 1), 413),
        ]
        for name, ctype, raw, status in cases:
            with self.subTest(name=name):
                with self.assertRaises(svc.BotDocumentError) as ctx:
                    svc.validate_upload(name, ctype, raw)
                self.assertEqual(ctx.exception.status_code, status)

    def test_processing_errors(self):
        for name, raw in (
            ("escaneado.pdf", make_blank_pdf()),
            ("protegido.pdf", make_encrypted_pdf()),
            ("danado.pdf", b"%PDF-1.7\n" + b"\x13\x37basura" * 100),
        ):
            with self.subTest(name=name):
                with self.assertRaises(svc.BotDocumentError) as ctx:
                    svc.extract_text("pdf", raw)
                self.assertEqual(ctx.exception.status_code, 422)

    def test_chunking_respects_size(self):
        text = svc.normalize_text(TXT_CONTENT.decode() * 40)
        chunks = svc.chunk_text(text)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c) <= svc.CHUNK_SIZE for c in chunks))

    def test_ranking_finds_relevant_fragment(self):
        rows = [
            (1, "a.txt", 0, "La mitosis tiene profase, metafase, anafase y telofase.", ""),
            (2, "b.txt", 0, "Las fases de la fotosíntesis son la luminosa y el ciclo de Calvin.", ""),
        ]
        rows = [(d, f, i, c, " ".join(svc.tokenize(c))) for d, f, i, c, _ in rows]
        best = svc.rank_fragments("¿Cuáles son las fases de la fotosíntesis?", rows)
        self.assertEqual(best[0].filename, "b.txt")
        self.assertEqual(svc.rank_fragments("hola", rows), [])


# ── Pruebas de la API ────────────────────────────────────────────────────────

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
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
        inst_a = Institution(name="Colegio A", dane_code="11100000001", is_active=True)
        inst_b = Institution(name="Colegio B", dane_code="11100000002", is_active=True)
        db.add_all([inst_a, inst_b])
        db.flush()

        def user(username, role, inst):
            u = User(
                username=username, email=f"{username}@test.edu.co", full_name=username.title(),
                hashed_password="x", role=role, institution_id=inst.id if inst else None,
                is_active=True,
            )
            db.add(u)
            return u

        cls.u = {
            "profe": user("profe_a", UserRole.PROFESOR.value, inst_a),
            "colega": user("profe_a2", UserRole.PROFESOR.value, inst_a),
            "alumno": user("alumno_a", UserRole.ESTUDIANTE.value, inst_a),
            "profe_b": user("profe_b", UserRole.PROFESOR.value, inst_b),
            "alumno_b": user("alumno_b", UserRole.ESTUDIANTE.value, inst_b),
            "admin": user("admin_global", UserRole.ADMIN.value, None),
        }
        db.flush()
        bot = ExpertBot(creator_id=cls.u["profe"].id, name="BioBot", category="Biología",
                        description="Repaso de biología", is_public=False, is_active=True)
        db.add(bot)
        db.flush()
        classroom = Classroom(name="Biología 9A", subject="Biología", teacher_id=cls.u["profe"].id,
                              invite_code="BIO9A1")
        db.add(classroom)
        db.flush()
        db.add(ClassroomBot(classroom_id=classroom.id, bot_id=bot.id))
        db.add(Enrollment(student_id=cls.u["alumno"].id, classroom_id=classroom.id, is_active=True))
        db.commit()
        cls.bot_id = bot.id
        cls.ids = {k: v.id for k, v in cls.u.items()}
        cls.headers = {
            k: {"Authorization": "Bearer " + create_access_token({"sub": v.username})}
            for k, v in cls.u.items()
        }
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    # helpers
    def upload(self, who, name, raw, ctype, bot_id=None):
        return self.client.post(
            f"/api/v1/bots/{bot_id or self.bot_id}/documents",
            headers=self.headers[who],
            files={"file": (name, raw, ctype)},
        )

    def documents(self, who="profe", bot_id=None):
        return self.client.get(f"/api/v1/bots/{bot_id or self.bot_id}/documents", headers=self.headers[who])

    def chat(self, who, message, bot_id=None):
        captured = {}

        async def fake_generate(prompt, system_prompt="", **kwargs):
            captured["system_prompt"] = system_prompt
            return {"response": "Respuesta de prueba", "provider": "fake", "fallback_used": False}

        with mock.patch.object(chat_api.ai_manager, "generate", side_effect=fake_generate), \
                mock.patch.object(chat_api.ai_manager, "providers", ["fake"]):
            resp = self.client.post(
                "/api/v1/chat/message",
                headers=self.headers[who],
                json={"message": message, "topic": "BioBot", "bot_id": bot_id or self.bot_id},
            )
        return resp, captured.get("system_prompt", "")

    # pruebas (orden alfabético = orden de ejecución)
    def test_01_upload_valid_formats(self):
        files = [
            ("fotosintesis.txt", TXT_CONTENT, "text/plain"),
            ("mitosis.md", "# Mitosis\n\nLa mitosis produce dos células hijas idénticas.".encode(), ""),
            ("celula.docx", make_docx(["La célula es la unidad básica de la vida y tiene membrana."]), DOCX_MIME),
            ("independencia.pdf", make_pdf(["El Grito de Independencia fue el 20 de julio de 1810."]), "application/pdf"),
        ]
        for name, raw, ctype in files:
            with self.subTest(name=name):
                r = self.upload("profe", name, raw, ctype)
                self.assertEqual(r.status_code, 201, r.text)
                body = r.json()
                self.assertEqual(body["status"], "procesado")
                self.assertEqual(body["filename"], name)
                self.assertGreaterEqual(body["chunk_count"], 1)

        r = self.documents()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["total"], 4)

        db = self.Session()
        self.assertEqual(db.query(BotDocument).filter_by(bot_id=self.bot_id).count(), 4)
        self.assertGreaterEqual(db.query(BotDocumentChunk).filter_by(bot_id=self.bot_id).count(), 4)
        db.close()

    def test_02_rejects_invalid_uploads(self):
        cases = [
            ("programa.exe", b"MZ" + b"0" * 40, "application/octet-stream", 415),
            ("grande.txt", b"a" * (svc.MAX_FILE_BYTES + 10), "text/plain", 413),
            ("vacio.txt", b"", "text/plain", 400),
            ("escaneado.pdf", make_blank_pdf(), "application/pdf", 422),
            ("fotosintesis_copia.txt", TXT_CONTENT, "text/plain", 409),
        ]
        for name, raw, ctype, status in cases:
            with self.subTest(name=name):
                r = self.upload("profe", name, raw, ctype)
                self.assertEqual(r.status_code, status, r.text)
                self.assertTrue(r.json()["detail"])
        self.assertEqual(self.documents().json()["total"], 4)

    def test_03_permissions_and_isolation(self):
        raw = "Contenido válido de prueba con texto suficiente.".encode()
        # Estudiante: rol sin permiso
        self.assertEqual(self.upload("alumno", "a.txt", raw, "text/plain").status_code, 403)
        self.assertEqual(self.documents("alumno").status_code, 403)
        # Colega de la misma institución y profesor de otra institución: no son dueños
        for who in ("colega", "profe_b"):
            with self.subTest(who=who):
                self.assertEqual(self.upload(who, "a.txt", raw, "text/plain").status_code, 403)
                self.assertEqual(self.documents(who).status_code, 403)
                doc_id = self.documents().json()["documents"][0]["id"]
                r = self.client.delete(f"/api/v1/bots/{self.bot_id}/documents/{doc_id}", headers=self.headers[who])
                self.assertEqual(r.status_code, 403)
        # Administrador sí puede consultar
        self.assertEqual(self.documents("admin").status_code, 200)

    def test_04_not_found(self):
        self.assertEqual(self.documents(bot_id=99999).status_code, 404)
        r = self.client.delete(f"/api/v1/bots/{self.bot_id}/documents/99999", headers=self.headers["profe"])
        self.assertEqual(r.status_code, 404)
        r = self.client.get(f"/api/v1/bots/{self.bot_id}/documents/99999/download", headers=self.headers["profe"])
        self.assertEqual(r.status_code, 404)

    def test_05_download_original(self):
        doc = next(d for d in self.documents().json()["documents"] if d["filename"] == "fotosintesis.txt")
        r = self.client.get(f"/api/v1/bots/{self.bot_id}/documents/{doc['id']}/download", headers=self.headers["profe"])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.content, TXT_CONTENT)

    def test_06_bot_uses_documents_in_chat(self):
        # Profesor dueño prueba su bot
        r, prompt = self.chat("profe", "¿Cuál es el código secreto de la clase?")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("ZETA-47", prompt)
        self.assertIn("fotosintesis.txt", r.json()["metadata"]["knowledge"]["sources"])
        # Estudiante inscrito en el aula donde está asignado el bot
        r, prompt = self.chat("alumno", "¿Cuándo fue el Grito de Independencia?")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("20 de julio de 1810", prompt)
        # Estudiante de otra institución: sin acceso al bot
        r, prompt = self.chat("alumno_b", "¿Cuál es el código secreto de la clase?")
        self.assertEqual(r.status_code, 403)
        self.assertNotIn("ZETA-47", prompt)

    def test_07_delete_removes_content(self):
        doc = next(d for d in self.documents().json()["documents"] if d["filename"] == "fotosintesis.txt")
        r = self.client.delete(f"/api/v1/bots/{self.bot_id}/documents/{doc['id']}", headers=self.headers["profe"])
        self.assertEqual(r.status_code, 200)
        db = self.Session()
        self.assertIsNone(db.query(BotDocument).filter_by(id=doc["id"]).first())
        self.assertEqual(db.query(BotDocumentChunk).filter_by(document_id=doc["id"]).count(), 0)
        db.close()
        # El bot ya no usa ese contenido
        r, prompt = self.chat("profe", "¿Cuál es el código secreto de la clase?")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("ZETA-47", prompt)
        self.assertEqual(self.documents().json()["total"], 3)

    def test_08_my_bots_reports_real_counts(self):
        r = self.client.get("/api/v1/bots/my-bots", headers=self.headers["profe"])
        bot = next(b for b in r.json()["bots"] if b["id"] == self.bot_id)
        self.assertEqual(bot["document_count"], 3)
        self.assertGreaterEqual(bot["query_count"], 2)

    def test_09_delete_bot_removes_documents(self):
        db = self.Session()
        bot = ExpertBot(creator_id=self.ids["profe"], name="Temporal", is_active=True)
        db.add(bot)
        db.commit()
        temp_id = bot.id
        db.close()
        r = self.upload("profe", "temporal.txt", "Texto temporal para eliminar con el bot.".encode(), "text/plain", bot_id=temp_id)
        self.assertEqual(r.status_code, 201, r.text)
        r = self.client.delete(f"/api/v1/bots/{temp_id}", headers=self.headers["profe"])
        self.assertEqual(r.status_code, 200, r.text)
        db = self.Session()
        self.assertEqual(db.query(BotDocument).filter_by(bot_id=temp_id).count(), 0)
        self.assertEqual(db.query(BotDocumentChunk).filter_by(bot_id=temp_id).count(), 0)
        db.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
