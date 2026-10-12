"""
Crea o restablece el Administrador global de NeuroLearn IA.

El Administrador no pertenece a ninguna institución (institution_id = NULL) y es
el único rol que crea instituciones; desde ahí se dan de alta los Súper
Profesores, y estos crean profesores y estudiantes. Este script es la forma de
crear el primer Administrador en una base nueva (local o Supabase) o de
recuperar el acceso si se perdió la contraseña.

Reemplaza a reset_demo_passwords.py, que creaba cuentas con contraseñas
publicadas en el repositorio.

Uso, desde backend/ y con la DATABASE_URL de la base destino en backend/.env o
en el entorno:

    python -m scripts.crear_admin --usuario admin.neurolearn \\
        --correo admin@colegio.edu.co --nombre "Nombre Apellido"

    # Cambiar la contraseña de un Administrador existente:
    python -m scripts.crear_admin --usuario admin.neurolearn --restablecer

La contraseña se pide por teclado dos veces, sin mostrarse, y debe cumplir la
política del sistema (8+ caracteres, mayúscula, minúscula, número y carácter
especial). Para automatizarlo puede darse en la variable de entorno
NEUROLEARN_ADMIN_PASSWORD; nunca como argumento, para que no quede en el
historial de la terminal. El script no imprime la contraseña ni su hash.
"""
from __future__ import annotations

import argparse
import getpass
import importlib
import os
import pkgutil
import re
import sys
from pathlib import Path
from typing import Optional, Tuple

_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import app.models  # noqa: E402

# Registra todos los modelos para que SQLAlchemy resuelva las relaciones sin
# importar app.main (que arrancaría la aplicación completa).
for _module in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module(f"app.models.{_module.name}")

from app.api.auth import get_password_hash, validate_password_strength  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

PASSWORD_ENV = "NEUROLEARN_ADMIN_PASSWORD"
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.\-]{3,50}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AdminError(ValueError):
    """Datos inválidos o conflicto con un usuario existente."""


def crear_o_restablecer_admin(
    db,
    usuario: str,
    password: str,
    correo: Optional[str] = None,
    nombre: Optional[str] = None,
    restablecer: bool = False,
) -> Tuple[User, str]:
    """Crea el Administrador o, con restablecer=True, cambia su contraseña.

    Retorna (usuario, "creado" | "restablecido"). Lanza AdminError sin
    modificar la base si algo no es válido.
    """
    usuario = (usuario or "").strip()
    if not USERNAME_RE.match(usuario):
        raise AdminError("El usuario debe tener entre 3 y 50 caracteres: letras, números, «.», «_» o «-».")

    problema = validate_password_strength(password)
    if problema:
        raise AdminError(problema)

    existente = db.query(User).filter(User.username == usuario).first()

    if existente is not None:
        if existente.role != UserRole.ADMIN.value:
            raise AdminError(
                f"Ya existe el usuario «{usuario}» con el rol {existente.role}. "
                "Elige otro nombre de usuario: este script no cambia el rol de cuentas existentes."
            )
        if not restablecer:
            raise AdminError(
                f"El Administrador «{usuario}» ya existe. Usa --restablecer para cambiar su contraseña."
            )
        existente.hashed_password = get_password_hash(password)
        existente.is_active = True
        existente.must_change_password = False
        db.commit()
        return existente, "restablecido"

    if restablecer:
        raise AdminError(f"No existe un Administrador «{usuario}» para restablecer.")

    correo = (correo or "").strip().lower()
    nombre = (nombre or "").strip()
    if not EMAIL_RE.match(correo):
        raise AdminError("Indica un correo válido con --correo (se usa para recuperar la contraseña).")
    if not nombre:
        raise AdminError("Indica el nombre completo con --nombre.")
    if db.query(User).filter(User.email == correo).first() is not None:
        raise AdminError(f"El correo {correo} ya pertenece a otro usuario.")

    admin = User(
        username=usuario,
        email=correo,
        full_name=nombre,
        hashed_password=get_password_hash(password),
        role=UserRole.ADMIN.value,
        institution_id=None,
        is_active=True,
        must_change_password=False,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin, "creado"


def _leer_password() -> str:
    desde_entorno = os.environ.get(PASSWORD_ENV)
    if desde_entorno:
        return desde_entorno
    if not sys.stdin.isatty():
        raise AdminError(f"No hay terminal para pedir la contraseña; defínela en {PASSWORD_ENV}.")
    primera = getpass.getpass("Contraseña del Administrador: ")
    segunda = getpass.getpass("Repite la contraseña: ")
    if primera != segunda:
        raise AdminError("Las contraseñas no coinciden.")
    return primera


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Crea o restablece el Administrador global de NeuroLearn IA.")
    parser.add_argument("--usuario", required=True, help="Nombre de usuario para iniciar sesión")
    parser.add_argument("--correo", help="Correo del Administrador (obligatorio al crear)")
    parser.add_argument("--nombre", help="Nombre completo (obligatorio al crear)")
    parser.add_argument("--restablecer", action="store_true",
                        help="Cambia la contraseña de un Administrador que ya existe")
    args = parser.parse_args(argv)

    from sqlalchemy import inspect

    from app.db.database import SessionLocal, engine

    if SessionLocal is None or engine is None:
        print("No hay conexión a base de datos: revisa DATABASE_URL.", file=sys.stderr)
        return 2
    if not inspect(engine).has_table(User.__tablename__):
        print("La tabla de usuarios no existe: aplica las migraciones o inicia el backend una vez.",
              file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        password = _leer_password()
        admin, accion = crear_o_restablecer_admin(
            db, args.usuario, password, args.correo, args.nombre, args.restablecer)
        mensaje = f"Administrador «{admin.username}» {accion} (id {admin.id}). Ya puede iniciar sesión."
    except AdminError as exc:
        db.rollback()
        print(f"No se hizo ningún cambio: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()

    print(mensaje)
    return 0


if __name__ == "__main__":
    sys.exit(main())
