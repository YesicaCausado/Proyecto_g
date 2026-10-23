"""
Materiales del profesor compartidos con grupos reales (parche 14C).

  profesor sube / comparte con SUS grupos → BD → notificación → el estudiante
  del grupo lo ve y lo descarga; otro estudiante no. No se aceptan grupos
  ajenos ni nombres inventados. Adjuntos reales del Tablero.
"""
from __future__ import annotations

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"
PDF = b"%PDF-1.4\n% material de prueba\n"


class MaterialesCompartidosTests(unittest.TestCase):
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
        inst = Institution(name="Colegio A", dane_code="61100000001", is_active=True)
        db.add(inst)
        db.flush()
        self.ids = {}
        for username, role in (("profe", UserRole.PROFESOR), ("profe2", UserRole.PROFESOR),
                               ("est1", UserRole.ESTUDIANTE), ("est2", UserRole.ESTUDIANTE)):
            u = User(username=username, email=f"{username}@t.edu.co", full_name=username.title(),
                     hashed_password="x", role=role.value, institution_id=inst.id, is_active=True)
            db.add(u)
            db.flush()
            self.ids[username] = u.id
        self.g1 = Classroom(teacher_id=self.ids["profe"], name="Matemáticas 9A", subject="Matemáticas",
                            grade="9", invite_code="MAT9A001", is_active=True, max_students=40)
        self.g2 = Classroom(teacher_id=self.ids["profe"], name="Física 10B", subject="Física",
                            grade="10", invite_code="FIS10B01", is_active=True, max_students=40)
        self.ajeno = Classroom(teacher_id=self.ids["profe2"], name="Química 11A", subject="Química",
                               grade="11", invite_code="QUI11A01", is_active=True, max_students=40)
        db.add_all([self.g1, self.g2, self.ajeno])
        db.flush()
        db.add(Enrollment(student_id=self.ids["est1"], classroom_id=self.g1.id, is_active=True))
        db.add(Enrollment(student_id=self.ids["est2"], classroom_id=self.g2.id, is_active=True))
        db.commit()
        self.g1_id, self.g2_id, self.ajeno_id = self.g1.id, self.g2.id, self.ajeno.id
        db.close()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def folder(self, who="profe"):
        r = self.client.post(f"{API}/teacher/materials/folders", headers=self.h(who), json={"name": "Unidad 1"})
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["id"]

    def upload(self, folder_id, shared=(), who="profe"):
        return self.client.post(
            f"{API}/teacher/materials/files", headers=self.h(who),
            data={"folder_id": str(folder_id), "shared_with": json.dumps(list(shared))},
            files={"file": ("guia.pdf", PDF, "application/pdf")})

    def test_grupos_reales_y_flujo_hasta_el_estudiante(self):
        listing = self.client.get(f"{API}/teacher/materials", headers=self.h("profe")).json()
        self.assertEqual([g["name"] for g in listing["groups"]], ["Física 10B", "Matemáticas 9A"])

        fid = self.folder()
        r = self.upload(fid, shared=[self.g1_id])
        self.assertEqual(r.status_code, 201, r.text)
        mat = r.json()
        self.assertEqual(mat["sharedWith"], [self.g1_id])
        self.assertEqual(mat["sharedGroups"], [{"id": self.g1_id, "name": "Matemáticas 9A"}])

        # El estudiante del grupo lo ve, recibe la notificación y lo descarga.
        mine = self.client.get(f"{API}/student/materials", headers=self.h("est1")).json()["materials"]
        self.assertEqual([m["id"] for m in mine], [mat["id"]])
        self.assertEqual(mine[0]["groups"], ["Matemáticas 9A"])
        d = self.client.get(f"{API}/student/materials/{mat['id']}/download", headers=self.h("est1"))
        self.assertEqual(d.status_code, 200)
        self.assertEqual(d.content, PDF)
        db = self.Session()
        self.assertEqual(db.query(Notification).filter_by(user_id=self.ids["est1"], type="material_compartido").count(), 1)
        self.assertEqual(db.query(Notification).filter_by(user_id=self.ids["est2"]).count(), 0)
        db.close()

        # El estudiante de otro grupo no lo ve ni lo descarga.
        self.assertEqual(self.client.get(f"{API}/student/materials", headers=self.h("est2")).json()["materials"], [])
        self.assertEqual(self.client.get(f"{API}/student/materials/{mat['id']}/download",
                                         headers=self.h("est2")).status_code, 404)

        # Compartir también con el segundo grupo: solo se notifica a los nuevos.
        r = self.client.patch(f"{API}/teacher/materials/files/{mat['id']}", headers=self.h("profe"),
                              json={"sharedWith": [self.g1_id, self.g2_id]})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(self.client.get(f"{API}/student/materials", headers=self.h("est2")).json()["materials"]), 1)
        db = self.Session()
        self.assertEqual(db.query(Notification).filter_by(user_id=self.ids["est1"]).count(), 1)
        self.assertEqual(db.query(Notification).filter_by(user_id=self.ids["est2"]).count(), 1)
        db.close()

        # Dejar de compartir: el estudiante deja de verlo.
        self.client.patch(f"{API}/teacher/materials/files/{mat['id']}", headers=self.h("profe"),
                          json={"sharedWith": []})
        self.assertEqual(self.client.get(f"{API}/student/materials", headers=self.h("est1")).json()["materials"], [])

    def test_vista_previa_recibe_el_archivo_real_y_respeta_permisos(self):
        """La vista previa usa las mismas descargas autorizadas (como blob):
        tipo MIME real, contenido completo y los mismos permisos."""
        fid = self.folder()
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
        pdf = self.upload(fid, shared=[self.g1_id]).json()
        img = self.client.post(f"{API}/teacher/materials/files", headers=self.h("profe"),
                               data={"folder_id": str(fid), "shared_with": json.dumps([self.g1_id])},
                               files={"file": ("diagrama.PNG", png, "image/png")}).json()
        link = self.client.post(f"{API}/teacher/materials/files", headers=self.h("profe"),
                                data={"folder_id": str(fid), "url": "https://example.org/x",
                                      "shared_with": json.dumps([self.g1_id])}).json()

        mine = {m["id"]: m for m in self.client.get(f"{API}/student/materials", headers=self.h("est1")).json()["materials"]}
        self.assertEqual((mine[pdf["id"]]["mimeType"], mine[pdf["id"]]["originalName"]), ("application/pdf", "guia.pdf"))
        self.assertEqual(mine[img["id"]]["mimeType"], "image/png")
        self.assertIsNone(mine[link["id"]]["mimeType"])   # un enlace no tiene archivo que previsualizar

        for mat, body, mime in ((pdf, PDF, "application/pdf"), (img, png, "image/png")):
            r = self.client.get(f"{API}/student/materials/{mat['id']}/download", headers=self.h("est1"))
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.headers["content-type"], mime)
            self.assertEqual(r.content, body)
            t = self.client.get(f"{API}/teacher/materials/files/{mat['id']}/download", headers=self.h("profe"))
            self.assertEqual((t.status_code, t.headers["content-type"], t.content), (200, mime, body))

        # Inexistente, de otro grupo, de otro profesor o con otro rol: no se entrega.
        self.assertEqual(self.client.get(f"{API}/student/materials/999999/download", headers=self.h("est1")).status_code, 404)
        self.assertEqual(self.client.get(f"{API}/student/materials/{pdf['id']}/download", headers=self.h("est2")).status_code, 404)
        self.assertEqual(self.client.get(f"{API}/teacher/materials/files/{pdf['id']}/download", headers=self.h("profe2")).status_code, 404)
        self.assertEqual(self.client.get(f"{API}/student/materials/{pdf['id']}/download", headers=self.h("profe")).status_code, 403)
        self.assertEqual(self.client.get(f"{API}/teacher/materials/files/{pdf['id']}/download", headers=self.h("est1")).status_code, 403)
        self.assertEqual(self.client.get(f"{API}/student/materials/{pdf['id']}/download").status_code, 401)

    def test_no_se_aceptan_grupos_ajenos_ni_inventados(self):
        fid = self.folder()
        self.assertEqual(self.upload(fid, shared=[self.ajeno_id]).status_code, 400)
        self.assertEqual(self.upload(fid, shared=["Cálculo 11A"]).status_code, 400)   # grupo de prueba
        self.assertEqual(self.upload(fid, shared=[99999]).status_code, 400)
        mat = self.upload(fid).json()
        self.assertEqual(self.client.patch(f"{API}/teacher/materials/files/{mat['id']}", headers=self.h("profe"),
                                           json={"sharedWith": [self.ajeno_id]}).status_code, 400)
        # Otro profesor no puede modificarlo.
        self.assertEqual(self.client.patch(f"{API}/teacher/materials/files/{mat['id']}", headers=self.h("profe2"),
                                           json={"sharedWith": []}).status_code, 404)

    def test_enlace_y_limite_de_tamano(self):
        fid = self.folder()
        bad = self.client.post(f"{API}/teacher/materials/files", headers=self.h("profe"),
                               data={"folder_id": str(fid), "name": "Video", "url": "javascript:alert(1)"})
        self.assertEqual(bad.status_code, 400)
        r = self.client.post(f"{API}/teacher/materials/files", headers=self.h("profe"),
                             data={"folder_id": str(fid), "name": "Video", "url": "https://example.org/v",
                                   "shared_with": json.dumps([self.g1_id])})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["url"], "https://example.org/v")
        mine = self.client.get(f"{API}/student/materials", headers=self.h("est1")).json()["materials"]
        self.assertEqual(mine[0]["url"], "https://example.org/v")
        big = self.client.post(f"{API}/teacher/materials/files", headers=self.h("profe"),
                               data={"folder_id": str(fid)},
                               files={"file": ("grande.pdf", b"x" * (4 * 1024 * 1024 + 1), "application/pdf")})
        self.assertEqual(big.status_code, 413)

    def test_adjuntos_reales_del_tablero(self):
        r = self.client.post(f"{API}/teacher/materials/attachments", headers=self.h("profe"),
                             data={"classroom_id": str(self.g1_id)},
                             files={"file": ("taller.pdf", PDF, "application/pdf")})
        self.assertEqual(r.status_code, 201, r.text)
        att = r.json()
        # Publicar con un adjunto solo de nombre (como antes) → rechazado.
        bad = self.client.post(f"{API}/posts", headers=self.h("profe"), json={
            "classroom_id": self.g1_id, "title": "Taller", "content": "", "attachments": ["taller.pdf"]})
        self.assertEqual(bad.status_code, 400)
        # Un adjunto de otro grupo tampoco.
        self.assertEqual(self.client.post(f"{API}/posts", headers=self.h("profe"), json={
            "classroom_id": self.g2_id, "title": "Taller", "attachments": [att]}).status_code, 400)
        ok = self.client.post(f"{API}/posts", headers=self.h("profe"), json={
            "classroom_id": self.g1_id, "title": "Taller", "content": "Resolver", "attachments": [att]})
        self.assertIn(ok.status_code, (200, 201), ok.text)
        posts = self.client.get(f"{API}/posts", headers=self.h("est1")).json()["posts"]
        self.assertEqual(posts[0]["attachments"], [{"id": att["id"], "name": "taller.pdf"}])
        d = self.client.get(f"{API}/student/materials/{att['id']}/download", headers=self.h("est1"))
        self.assertEqual(d.status_code, 200)
        self.assertEqual(self.client.post(f"{API}/teacher/materials/attachments", headers=self.h("profe"),
                                          data={"classroom_id": str(self.ajeno_id)},
                                          files={"file": ("x.pdf", PDF, "application/pdf")}).status_code, 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
