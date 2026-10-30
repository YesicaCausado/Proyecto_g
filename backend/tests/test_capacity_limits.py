"""Capacity-limit API and concurrency regression tests using isolated SQLite."""
from __future__ import annotations

import os
import sys
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from fastapi import Depends, HTTPException, Request  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import get_current_user, get_password_hash  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.schemas.schemas import InstitutionCreate  # noqa: E402
from app.services.capacity import (  # noqa: E402
    MAX_STUDENTS_PLATFORM,
    lock_capacity,
    require_student_capacity,
)

API = "/api/v1"


class CapacityLimitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.Session = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)
        cls.client = TestClient(app, raise_server_exceptions=False)
        app.dependency_overrides[get_db] = cls._get_db
        app.dependency_overrides[get_current_user] = cls._get_test_user

    @classmethod
    def _get_db(cls):
        db = cls.Session()
        try:
            yield db
        finally:
            db.close()

    @classmethod
    def _get_test_user(cls, request: Request, db=Depends(get_db)):
        user_id = int(request.headers["x-test-user-id"])
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise RuntimeError("Usuario de prueba no encontrado.")
        return user

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.Session()
        self.institution = Institution(name="Institución de prueba", dane_code="111111111")
        self.db.add(self.institution)
        self.db.flush()
        password_hash = get_password_hash("Testing-Password-2026")
        self.admin = self._user("admin-capacity", UserRole.ADMIN.value, password_hash=password_hash)
        self.super = self._user("super-capacity", UserRole.SUPER_PROFESOR.value, password_hash=password_hash)
        self.teacher = self._user("teacher-capacity", UserRole.PROFESOR.value, password_hash=password_hash)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _user(self, username, role, institution_id=None, password_hash=None):
        user = User(
            username=username,
            email=f"{username}@example.test",
            full_name=username,
            hashed_password=password_hash or get_password_hash("Testing-Password-2026"),
            role=role,
            institution_id=institution_id if institution_id is not None else self.institution.id,
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def _headers(self, user):
        return {"x-test-user-id": str(user.id)}

    def _classroom(self, name="Aula de prueba", max_students=200):
        classroom = Classroom(
            teacher_id=self.teacher.id,
            name=name,
            subject="Matemáticas",
            grade="11",
            invite_code=f"{name[:4].upper()}{self.db.query(Classroom).count():04d}",
            max_students=max_students,
        )
        self.db.add(classroom)
        self.db.flush()
        return classroom

    def _student(self, number):
        return self._user(
            f"student-{number}",
            UserRole.ESTUDIANTE.value,
            password_hash="hashed-test-password",
        )

    def _institution_payload(self, suffix):
        return {
            "name": f"Colegio {suffix}",
            "dane_code": f"{suffix:012d}",
            "sp_full_name": "Rector de prueba",
            "sp_document_type": "CC",
            "sp_document_number": f"{suffix + 100000:07d}",
            "sp_email": f"rector-{suffix}@example.test",
        }

    def _student_csv(self, *numbers):
        rows = ["nombre_completo,tipo_documento,numero_documento,fecha_nacimiento"]
        rows.extend(f"Estudiante de prueba,TI,{n},2000-01-01" for n in numbers)
        return "\n".join(rows)

    def test_institution_40th_creation_and_41st_rejection(self):
        for n in range(2, 40):
            self.db.add(Institution(name=f"Existente {n}", dane_code=f"{n:012d}", is_active=True))
        self.db.commit()

        with mock.patch("app.api.credentials.send_credentials_email"):
            created = self.client.post(
                f"{API}/admin/institutions",
                headers=self._headers(self.admin),
                json=self._institution_payload(41),
            )
            self.assertEqual(created.status_code, 201, created.text)
            rejected = self.client.post(
                f"{API}/admin/institutions",
                headers=self._headers(self.admin),
                json=self._institution_payload(42),
            )
        self.assertEqual(rejected.status_code, 409, rejected.text)
        self.assertIn("40", rejected.json()["detail"])
        self.assertEqual(self.db.query(Institution).filter(Institution.is_active.is_(True)).count(), 40)

    def test_alternate_institution_creation_handler_enforces_same_cap(self):
        from app.api.admin_users import create_institution_admin

        for n in range(2, 42):
            self.db.add(Institution(name=f"Existente {n}", dane_code=f"{n:012d}", is_active=True))
        self.db.commit()
        payload = InstitutionCreate(**self._institution_payload(77))
        with self.assertRaises(Exception) as caught:
            create_institution_admin(payload, self.db, self.admin)
        self.assertEqual(getattr(caught.exception, "status_code", None), 409)

    def test_eighth_classroom_is_allowed_and_ninth_is_rejected(self):
        for n in range(7):
            self._classroom(f"Existente {n}")
        self.db.commit()

        eighth = self.client.post(
            f"{API}/classrooms/",
            headers=self._headers(self.teacher),
            json={"name": "Aula octava", "subject": "Matemáticas", "max_students": 200},
        )
        self.assertEqual(eighth.status_code, 201, eighth.text)
        self.assertEqual(eighth.json()["max_students"], 200)

        rejected = self.client.post(
            f"{API}/super/classrooms",
            headers=self._headers(self.super),
            json={
                "name": "Aula novena",
                "subject": "Matemáticas",
                "teacher_id": self.teacher.id,
                "max_students": 200,
            },
        )
        self.assertEqual(rejected.status_code, 409, rejected.text)
        self.assertIn("8 aulas", rejected.json()["detail"])
        self.assertEqual(self.db.query(Classroom).count(), 8)

    def test_200th_enrollment_is_allowed_and_201st_is_rejected(self):
        classroom = self._classroom(max_students=200)
        students = [self._student(n) for n in range(1, 202)]
        for student in students[:199]:
            self.db.add(Enrollment(student_id=student.id, classroom_id=classroom.id, is_active=True))
        self.db.commit()

        accepted = self.client.post(
            f"{API}/classrooms/join",
            headers=self._headers(students[199]),
            json={"invite_code": classroom.invite_code},
        )
        self.assertEqual(accepted.status_code, 200, accepted.text)
        rejected = self.client.post(
            f"{API}/classrooms/join",
            headers=self._headers(students[200]),
            json={"invite_code": classroom.invite_code},
        )
        self.assertEqual(rejected.status_code, 409, rejected.text)
        self.assertIn("200", rejected.json()["detail"])
        self.assertEqual(
            self.db.query(Enrollment)
            .filter(Enrollment.classroom_id == classroom.id, Enrollment.is_active.is_(True))
            .count(),
            200,
        )

    def test_individual_student_creation_stops_at_1600(self):
        for n in range(1599):
            self._student(n)
        self.db.commit()
        payload = {
            "full_name": "Estudiante de prueba",
            "document_type": "TI",
            "document_number": "9001600",
            "birth_date": "2000-01-01",
            "guardian_authorization_confirmed": True,
        }
        accepted = self.client.post(
            f"{API}/super/students",
            headers=self._headers(self.super),
            json=payload,
        )
        self.assertEqual(accepted.status_code, 201, accepted.text)
        payload["document_number"] = "9001601"
        rejected = self.client.post(
            f"{API}/super/students",
            headers=self._headers(self.super),
            json=payload,
        )
        self.assertEqual(rejected.status_code, 409, rejected.text)
        self.assertEqual(
            self.db.query(User)
            .filter(
                User.institution_id == self.institution.id,
                User.role == UserRole.ESTUDIANTE.value,
                User.is_active.is_(True),
            )
            .count(),
            1600,
        )

    def test_platform_student_capacity_rejects_creation_without_partial_user(self):
        payload = {
            "full_name": "Estudiante fuera de capacidad",
            "document_type": "TI",
            "document_number": "90064001",
            "birth_date": "2000-01-01",
            "guardian_authorization_confirmed": True,
        }
        with mock.patch(
            "app.services.capacity.platform_student_count",
            return_value=MAX_STUDENTS_PLATFORM,
        ):
            response = self.client.post(
                f"{API}/super/students",
                headers=self._headers(self.super),
                json=payload,
            )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn(str(MAX_STUDENTS_PLATFORM), response.json()["detail"])
        self.assertEqual(
            self.db.query(User)
            .filter(User.document_number == payload["document_number"])
            .count(),
            0,
        )

    def test_student_reactivation_cannot_overfill_existing_classroom(self):
        classroom = self._classroom(max_students=1)
        active_student = self._student(701)
        inactive_student = self._student(702)
        inactive_student.is_active = False
        self.db.add_all([
            Enrollment(student_id=active_student.id, classroom_id=classroom.id, is_active=True),
            Enrollment(student_id=inactive_student.id, classroom_id=classroom.id, is_active=True),
        ])
        self.db.commit()

        response = self.client.put(
            f"{API}/super/students/{inactive_student.id}",
            headers=self._headers(self.super),
            json={"is_active": True},
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.db.refresh(inactive_student)
        self.assertFalse(inactive_student.is_active)
        self.assertEqual(
            self.db.query(Enrollment)
            .filter(Enrollment.classroom_id == classroom.id, Enrollment.is_active.is_(True))
            .count(),
            2,
        )

    def test_bulk_import_is_atomic_when_capacity_is_insufficient(self):
        for n in range(1599):
            self._student(n)
        self.db.commit()
        response = self.client.post(
            f"{API}/super/students/bulk",
            headers=self._headers(self.super),
            data={"authorization_confirmed": "true"},
            files={"file": ("students.csv", self._student_csv(990001, 990002), "text/csv")},
        )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("No se creó ningún registro", response.json()["detail"])
        self.assertEqual(
            self.db.query(User)
            .filter(User.institution_id == self.institution.id, User.role == UserRole.ESTUDIANTE.value)
            .count(),
            1599,
        )

    def test_bulk_import_succeeds_when_institution_and_classroom_have_space(self):
        for n in range(1598):
            self._student(n)
        classroom = self._classroom(max_students=2)
        self.db.commit()
        response = self.client.post(
            f"{API}/super/students/bulk",
            headers=self._headers(self.super),
            data={"authorization_confirmed": "true", "classroom_id": str(classroom.id)},
            files={"file": ("students.csv", self._student_csv(991001, 991002), "text/csv")},
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["total_created"], 2)
        self.assertEqual(response.json()["enrolled"], 2)

    def test_bulk_import_rejects_classroom_overflow_without_partial_accounts(self):
        classroom = self._classroom(max_students=1)
        self.db.commit()
        response = self.client.post(
            f"{API}/super/students/bulk",
            headers=self._headers(self.super),
            data={"authorization_confirmed": "true", "classroom_id": str(classroom.id)},
            files={"file": ("students.csv", self._student_csv(992001, 992002), "text/csv")},
        )
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(
            self.db.query(User)
            .filter(User.institution_id == self.institution.id, User.role == UserRole.ESTUDIANTE.value)
            .count(),
            0,
        )
        self.assertEqual(self.db.query(Enrollment).filter_by(classroom_id=classroom.id).count(), 0)

    def test_capacity_endpoints_keep_role_permissions(self):
        admin_capacity = self.client.get(
            f"{API}/admin/capacity",
            headers=self._headers(self.admin),
        )
        self.assertEqual(admin_capacity.status_code, 200, admin_capacity.text)
        self.assertEqual(admin_capacity.json()["institutions_limit"], 40)
        self.assertEqual(admin_capacity.json()["students_limit"], MAX_STUDENTS_PLATFORM)
        self.assertEqual(admin_capacity.json()["students_used"], 0)
        denied = self.client.get(
            f"{API}/admin/capacity",
            headers=self._headers(self.super),
        )
        self.assertEqual(denied.status_code, 403, denied.text)
        institution_capacity = self.client.get(
            f"{API}/institution/capacity",
            headers=self._headers(self.teacher),
        )
        self.assertEqual(institution_capacity.status_code, 200, institution_capacity.text)
        institution_denied = self.client.get(
            f"{API}/institution/capacity",
            headers=self._headers(self.admin),
        )
        self.assertEqual(institution_denied.status_code, 403, institution_denied.text)

    def test_local_transaction_lock_serializes_concurrent_capacity_checks(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = create_engine(f"sqlite:///{Path(temp_dir) / 'capacity.db'}", connect_args={"timeout": 5})
            Base.metadata.create_all(bind=engine)
            Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
            barrier = threading.Barrier(2)

            def create_if_available(suffix):
                db = Session()
                try:
                    barrier.wait(timeout=5)
                    lock_capacity(db, "platform")
                    used = db.query(Institution).filter(Institution.is_active.is_(True)).count()
                    if used < 1:
                        db.add(Institution(name=f"Concurrent {suffix}", dane_code=f"{suffix:012d}"))
                        time.sleep(0.02)
                        db.commit()
                        return True
                    db.rollback()
                    return False
                finally:
                    db.close()

            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(create_if_available, (71, 72)))
            check = Session()
            try:
                self.assertEqual(sum(results), 1)
                self.assertEqual(check.query(Institution).filter(Institution.is_active.is_(True)).count(), 1)
            finally:
                check.close()
                engine.dispose()

    def test_concurrent_student_creations_cannot_exceed_platform_capacity(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = create_engine(
                f"sqlite:///{Path(temp_dir) / 'students.db'}",
                connect_args={"timeout": 5},
            )
            Base.metadata.create_all(bind=engine)
            Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
            setup = Session()
            institution = Institution(name="Institución concurrente", dane_code="222222222")
            setup.add(institution)
            setup.commit()
            institution_id = institution.id
            setup.close()
            barrier = threading.Barrier(2)

            def create_if_available(suffix):
                db = Session()
                try:
                    barrier.wait(timeout=5)
                    require_student_capacity(db, institution_id)
                    db.add(User(
                        username=f"concurrent-student-{suffix}",
                        email=f"concurrent-{suffix}@example.test",
                        full_name="Estudiante concurrente",
                        hashed_password="hashed-test-password",
                        role=UserRole.ESTUDIANTE.value,
                        institution_id=institution_id,
                        is_active=True,
                    ))
                    db.commit()
                    return True
                except HTTPException:
                    db.rollback()
                    return False
                finally:
                    db.close()

            try:
                with mock.patch("app.services.capacity.MAX_STUDENTS_PLATFORM", 1):
                    with ThreadPoolExecutor(max_workers=2) as pool:
                        results = list(pool.map(create_if_available, (81, 82)))
                check = Session()
                try:
                    self.assertEqual(sum(results), 1)
                    self.assertEqual(
                        check.query(User)
                        .filter(
                            User.role == UserRole.ESTUDIANTE.value,
                            User.is_active.is_(True),
                        )
                        .count(),
                        1,
                    )
                finally:
                    check.close()
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
