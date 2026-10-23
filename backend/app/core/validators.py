"""
NeuroLearn IA — Reglas de validación de los datos que llegan a la API.

Fuente única de las reglas por TIPO de campo (nombres, correos, documentos,
teléfonos, fechas, URL, códigos, textos). Las usan los esquemas Pydantic
(`app/schemas/schemas.py` y los modelos de cada router) y los endpoints que
reciben formularios o CSV. El frontend aplica las mismas reglas en
`frontend/src/utils/validation.ts`: si cambia una regla aquí, cámbiala allí.

Cada función devuelve el valor normalizado o lanza ValueError con un mensaje
en español pensado para mostrarse tal cual junto al campo. Dentro de un
validador de Pydantic ese ValueError se convierte en un 422 (ver
`app/core/validation_errors.py`); fuera de Pydantic, usa `or_400`.

Lo que NO hacen estas reglas: escapar HTML ni filtrar «caracteres
peligrosos». Los textos se guardan tal como los escribe el usuario y se
protegen al mostrarlos (React escapa por defecto) y con consultas
parametrizadas (SQLAlchemy). Bloquear «<» o comillas rompería textos legítimos.
"""
from __future__ import annotations

import ipaddress
import re
import socket
import unicodedata
from datetime import date
from typing import Callable, Optional, TypeVar
from urllib.parse import urlsplit

from fastapi import HTTPException

T = TypeVar("T")

# Caracteres de control (se conservan \t, \n y \r en los textos multilínea).
_CONTROL_MULTILINE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f  ]")
_CONTROL_SINGLE = re.compile(r"[\x00-\x1f\x7f  ]")


def or_400(fn: Callable[..., T], *args, **kwargs) -> T:
    """Ejecuta una regla fuera de Pydantic: un ValueError se responde como 400."""
    try:
        return fn(*args, **kwargs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


# ─── Textos ──────────────────────────────────────────────────────────────────

def clean_text(
    value: Optional[str],
    *,
    label: str,
    max_len: int,
    min_len: int = 1,
    required: bool = True,
    multiline: bool = False,
) -> Optional[str]:
    """Texto libre (títulos, descripciones, mensajes, comentarios).

    Admite letras, números, puntuación, emojis y, si `multiline`, saltos de
    línea. Quita espacios externos y caracteres de control invisibles; un
    valor formado solo por espacios cuenta como vacío.
    """
    if value is None:
        if required:
            raise ValueError(f"{label} es obligatorio.")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{label} debe ser texto.")
    text = unicodedata.normalize("NFC", value)
    text = (_CONTROL_MULTILINE if multiline else _CONTROL_SINGLE).sub("" if multiline else " ", text)
    text = text.replace("\r\n", "\n").strip()
    if not multiline:
        text = re.sub(r"\s+", " ", text)
    if not text:
        if required:
            raise ValueError(f"{label} es obligatorio.")
        return ""
    if len(text) < min_len:
        raise ValueError(f"{label} debe tener al menos {min_len} caracteres.")
    if len(text) > max_len:
        raise ValueError(f"{label} no puede superar {max_len} caracteres (tiene {len(text)}).")
    return text


# ─── Nombres de personas ─────────────────────────────────────────────────────

# Una palabra del nombre: letras (cualquier alfabeto, con tildes, ñ o
# diéresis) unidas por guion o apóstrofo, y un punto final opcional para
# abreviaturas («Ma. José»). Ej.: «María», «Ana-Lucía», «O'Neill», «D’Ángelo».
_NAME_WORD = re.compile(r"^[^\W\d_]+(?:[-'’][^\W\d_]+)*\.?$")


def person_name(value: Optional[str], *, label: str = "El nombre", max_len: int = 100,
                required: bool = True) -> Optional[str]:
    """Nombre o apellido de una persona. Conserva mayúsculas y tildes."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValueError(f"{label} es obligatorio.")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{label} debe ser texto.")
    text = " ".join(unicodedata.normalize("NFC", value).split())
    if any(ch.isdigit() for ch in text):
        raise ValueError(f"{label} no puede contener números.")
    if not all(_NAME_WORD.match(word) for word in text.split(" ")):
        raise ValueError(
            f"{label} solo admite letras, espacios, guiones y apóstrofos."
        )
    if sum(ch.isalpha() for ch in text) < 2:
        raise ValueError(f"{label} debe tener al menos 2 letras.")
    if len(text) > max_len:
        raise ValueError(f"{label} no puede superar {max_len} caracteres.")
    return text


# ─── Correo electrónico ──────────────────────────────────────────────────────

# Parte local: caracteres permitidos por RFC 5322 sin comillas; dominio con
# etiquetas alfanuméricas (guion interno) y un TLD de al menos 2 letras.
_EMAIL_LOCAL = re.compile(r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$")
_EMAIL_LABEL = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")


def email(value: Optional[str], *, label: str = "El correo electrónico", max_len: int = 100,
          required: bool = True) -> Optional[str]:
    """Correo normalizado en minúsculas (las cuentas lo comparan sin distinguir
    mayúsculas). Valida el formato, no que la dirección exista."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValueError(f"{label} es obligatorio.")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{label} debe ser texto.")
    text = value.strip().lower()
    message = "Introduce un correo electrónico con un formato válido (ej.: nombre@colegio.edu.co)."
    if any(ch.isspace() for ch in text) or text.count("@") != 1:
        raise ValueError(message)
    local, domain = text.split("@")
    labels = domain.split(".")
    if (
        not local or len(local) > 64 or not _EMAIL_LOCAL.match(local)
        or len(labels) < 2 or not all(_EMAIL_LABEL.match(part) for part in labels)
        or not re.fullmatch(r"[a-z]{2,63}", labels[-1])
    ):
        raise ValueError(message)
    if len(text) > max_len:
        raise ValueError(f"{label} no puede superar {max_len} caracteres.")
    return text


# ─── Documentos de identidad ─────────────────────────────────────────────────

# Tipos admitidos por la plataforma y su formato. Los números se guardan como
# TEXTO: así se conservan los ceros iniciales. Rangos amplios a propósito
# (cédulas antiguas más cortas, TI de formatos anteriores); ver docs.
DOCUMENT_RULES = {
    "CC": {"pattern": r"\d+", "min": 4, "max": 10, "hint": "solo números"},
    "TI": {"pattern": r"\d+", "min": 6, "max": 11, "hint": "solo números"},
    "CE": {"pattern": r"\d+", "min": 4, "max": 10, "hint": "solo números"},
    "PA": {"pattern": r"[A-Z0-9]+", "min": 5, "max": 20, "hint": "letras y números, sin espacios"},
}
DOCUMENT_LABELS = {
    "CC": "cédula de ciudadanía",
    "TI": "tarjeta de identidad",
    "CE": "cédula de extranjería",
    "PA": "pasaporte",
}


def document_type(value: Optional[str]) -> str:
    code = (value or "").strip().upper()
    if code not in DOCUMENT_RULES:
        raise ValueError("Tipo de documento inválido: usa CC, TI, CE o PA.")
    return code


def document_number(value: Optional[str], doc_type: str) -> str:
    """Número de documento según su tipo (texto, sin convertir a número)."""
    if value is None or not str(value).strip():
        raise ValueError("El número de documento es obligatorio.")
    text = str(value).strip()
    rule = DOCUMENT_RULES[doc_type]
    if doc_type == "PA":
        text = text.upper()
    if any(ch.isspace() for ch in text):
        raise ValueError("El número de documento no puede contener espacios.")
    if not re.fullmatch(rule["pattern"], text):
        raise ValueError(
            f"El número de {DOCUMENT_LABELS[doc_type]} admite {rule['hint']}."
        )
    if not rule["min"] <= len(text) <= rule["max"]:
        raise ValueError(
            f"El número de {DOCUMENT_LABELS[doc_type]} debe tener entre "
            f"{rule['min']} y {rule['max']} caracteres."
        )
    return text


# ─── Teléfono ────────────────────────────────────────────────────────────────

def phone(value: Optional[str], *, label: str = "El teléfono", required: bool = False) -> Optional[str]:
    """Teléfono nacional o internacional: «+» solo al inicio, dígitos y como
    formato espacios, guiones o paréntesis. Entre 7 y 15 dígitos (E.164)."""
    if value is None or not str(value).strip():
        if required:
            raise ValueError(f"{label} es obligatorio.")
        return None
    text = " ".join(str(value).split())
    if not re.fullmatch(r"\+?[\d\s()\-]+", text):
        raise ValueError(f"{label} solo admite números, «+» al inicio, espacios, guiones o paréntesis.")
    digits = re.sub(r"\D", "", text)
    if not 7 <= len(digits) <= 15:
        raise ValueError(f"{label} debe tener entre 7 y 15 dígitos.")
    return text


# ─── Fechas y horas ──────────────────────────────────────────────────────────

def iso_date(value: Optional[str], *, label: str = "La fecha", required: bool = True,
             min_year: int = 1900, max_year: int = 2100) -> Optional[str]:
    """Fecha AAAA-MM-DD real (rechaza 2025-02-30) dentro de un rango razonable."""
    if value is None or not str(value).strip():
        if required:
            raise ValueError(f"{label} es obligatoria.")
        return None
    text = str(value).strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        raise ValueError(f"{label} debe tener el formato AAAA-MM-DD.")
    try:
        parsed = date.fromisoformat(text)
    except ValueError:
        raise ValueError(f"{label} no es una fecha válida.") from None
    if not min_year <= parsed.year <= max_year:
        raise ValueError(f"{label} debe estar entre {min_year} y {max_year}.")
    return text


def birth_date(value, *, today: Optional[date] = None) -> Optional[str]:
    """Fecha de nacimiento: acepta AAAA-MM-DD o DD/MM/AAAA (CSV de Excel), no
    futura ni anterior a 1900. Devuelve AAAA-MM-DD. No impone edad mínima."""
    if value is None or not str(value).strip():
        return None
    from app.services.consent_service import _parse_birth_date
    parsed = _parse_birth_date(str(value).strip())
    if parsed is None or len(str(value).strip()) > 10:
        raise ValueError("La fecha de nacimiento no es válida (usa AAAA-MM-DD, p. ej. 2009-05-14).")
    if parsed > (today or date.today()):
        raise ValueError("La fecha de nacimiento no puede ser posterior al día de hoy.")
    if parsed.year < 1900:
        raise ValueError("La fecha de nacimiento debe ser posterior a 1900.")
    return parsed.isoformat()


_TIME_24 = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_TIME_12 = re.compile(r"^(0?[1-9]|1[0-2]):[0-5]\d\s?([AaPp]\.?\s?[Mm]\.?)$")


def clock_time(value: Optional[str], *, label: str = "La hora") -> Optional[str]:
    """Hora HH:MM (24 h, la del control <input type="time">) o «h:mm AM/PM»."""
    if value is None or not str(value).strip():
        return None
    text = str(value).strip()
    if not (_TIME_24.match(text) or _TIME_12.match(text)):
        raise ValueError(f"{label} debe tener el formato HH:MM.")
    return text


# ─── URL ─────────────────────────────────────────────────────────────────────

def http_url(value: Optional[str], *, label: str = "El enlace", max_len: int = 500,
             required: bool = True) -> Optional[str]:
    """Enlace web http(s) con dominio. Rechaza otros esquemas (javascript:,
    data:, file:…) que al abrirse ejecutarían código o leerían archivos."""
    if value is None or not str(value).strip():
        if required:
            raise ValueError(f"{label} es obligatorio.")
        return None
    text = str(value).strip()
    if any(ch.isspace() for ch in text):
        raise ValueError(f"{label} no puede contener espacios.")
    if len(text) > max_len:
        raise ValueError(f"{label} no puede superar {max_len} caracteres.")
    parts = urlsplit(text)
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        raise ValueError(f"{label} debe ser una dirección web que empiece por https://")
    if parts.username or parts.password:
        raise ValueError(f"{label} no puede incluir usuario ni contraseña.")
    return text


def is_public_host(url: str) -> bool:
    """True si el host de la URL resuelve solo a direcciones públicas.

    Evita que un webhook se use para llegar a la red interna del servidor
    (localhost, 10.x, 192.168.x, metadatos 169.254.169.254…).
    """
    host = urlsplit(url).hostname or ""
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError, OSError):
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0].split("%")[0])
        except ValueError:
            return False
        if not ip.is_global or ip.is_multicast:
            return False
    return bool(infos)


# ─── Códigos e identificadores institucionales ───────────────────────────────

def invite_code(value: Optional[str]) -> str:
    """Código de invitación de un grupo: 8 letras o números (no distingue
    mayúsculas; se aceptan espacios externos al pegarlo)."""
    text = (value or "").strip().upper()
    if not text:
        raise ValueError("Debes ingresar un código de invitación.")
    if not re.fullmatch(r"[A-Z0-9]{8}", text):
        raise ValueError("El código de invitación tiene 8 letras o números, sin espacios ni símbolos.")
    return text


def dane_code(value: Optional[str]) -> str:
    """Código DANE de la institución: solo dígitos (5 a 12)."""
    text = (value or "").strip()
    if not text:
        raise ValueError("El código DANE es obligatorio.")
    if not text.isdigit() or not text.isascii():
        raise ValueError("El código DANE solo admite números.")
    if not 5 <= len(text) <= 12:
        raise ValueError("El código DANE debe tener entre 5 y 12 dígitos.")
    return text


def grade(value: Optional[str], *, required: bool = False) -> Optional[str]:
    """Grado escolar: «10°», «11-A», «Décimo», «9 B» (máx. 20 caracteres)."""
    if value is None or not str(value).strip():
        if required:
            raise ValueError("El grado es obligatorio.")
        return "" if value is not None else None
    text = " ".join(str(value).split())
    if not re.fullmatch(r"[^\W_]+(?:[\s\-./°º#][^\W_]*)*[°º]?", text):
        raise ValueError("El grado solo admite letras, números, «°», guion o espacio (ej.: 10°, 11-A).")
    if len(text) > 20:
        raise ValueError("El grado no puede superar 20 caracteres.")
    return text


def hex_color(value: Optional[str], *, default: str) -> str:
    """Color #RRGGBB (se aplica en estilos: no se acepta CSS arbitrario)."""
    text = (value or "").strip()
    if not text:
        return default
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", text):
        raise ValueError("El color debe tener el formato #RRGGBB.")
    return text.upper()


# ─── Imágenes y archivos ─────────────────────────────────────────────────────

def image_matches(raw: bytes, mime: str) -> bool:
    """¿Los primeros bytes corresponden al tipo de imagen declarado?
    (un .png que en realidad es HTML o un ejecutable se rechaza)."""
    mime = mime.lower()
    if mime == "image/png":
        return raw.startswith(b"\x89PNG\r\n\x1a\n")
    if mime in ("image/jpeg", "image/jpg"):
        return raw.startswith(b"\xff\xd8\xff")
    if mime == "image/gif":
        return raw.startswith((b"GIF87a", b"GIF89a"))
    if mime == "image/webp":
        return raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    return False


def safe_filename(name: Optional[str], *, default: str = "archivo", max_len: int = 255) -> str:
    """Nombre de archivo sin rutas («../», «C:\\»), sin caracteres de control
    ni separadores, y con longitud acotada. Conserva tildes y espacios."""
    base = (name or "").replace("\\", "/").rsplit("/", 1)[-1]
    base = "".join(ch for ch in unicodedata.normalize("NFC", base) if ch.isprintable() and ch not in '<>:"|?*')
    base = base.strip().lstrip(".").strip()
    if not base:
        return default
    if len(base) > max_len:
        stem, dot, ext = base.rpartition(".")
        base = (stem[: max_len - len(ext) - 1] + dot + ext) if dot and len(ext) <= 10 else base[:max_len]
    return base


# ─── Contraseñas ─────────────────────────────────────────────────────────────

PASSWORD_MIN = 8
# bcrypt solo usa los primeros 72 bytes; un tope evita además cargas enormes.
PASSWORD_MAX = 128


def password_policy_error(password) -> Optional[str]:
    """None si la contraseña cumple la política; si no, el motivo.

    Mínimo 8 y máximo 128 caracteres, con mayúscula, minúscula, número y un
    carácter especial (cualquier símbolo o espacio; la «ñ» y las vocales con
    tilde cuentan como letras). La contraseña no se recorta ni se transforma.
    """
    if not isinstance(password, str) or not password:
        return "La contraseña es obligatoria."
    if len(password) < PASSWORD_MIN:
        return f"La contraseña debe tener al menos {PASSWORD_MIN} caracteres."
    if len(password) > PASSWORD_MAX:
        return f"La contraseña no puede superar {PASSWORD_MAX} caracteres."
    if not any(ch.isupper() for ch in password):
        return "La contraseña debe incluir una letra mayúscula."
    if not any(ch.islower() for ch in password):
        return "La contraseña debe incluir una letra minúscula."
    if not any(ch.isdigit() for ch in password):
        return "La contraseña debe incluir un número."
    if all(ch.isalnum() for ch in password):
        return "La contraseña debe incluir un carácter especial (por ejemplo ! @ # ? o un espacio)."
    if any(unicodedata.category(ch) == "Cc" for ch in password):
        return "La contraseña contiene caracteres de control no permitidos."
    return None


def parse_int_list(raw, *, label: str = "Los identificadores", max_items: int = 500) -> list:
    """Lista de ids enteros positivos (bulk-delete, selecciones)."""
    if not isinstance(raw, list) or not raw:
        raise ValueError("Debes enviar al menos un ID válido.")
    if len(raw) > max_items:
        raise ValueError(f"Puedes enviar como máximo {max_items} elementos a la vez.")
    out = []
    for item in raw:
        if isinstance(item, bool) or not isinstance(item, int) or item <= 0:
            raise ValueError(f"{label} deben ser números enteros positivos.")
        out.append(item)
    return out
