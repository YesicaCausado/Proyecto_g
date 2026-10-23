"""
NeuroLearn IA — Respuesta de los errores de validación (422).

FastAPI responde por defecto `{"detail": [ {loc, msg, type, input}, … ]}` con
mensajes en inglés y devolviendo el valor recibido (que puede ser una
contraseña). Aquí se responde:

    {
      "detail": "<primer error, en español, listo para mostrar>",
      "errors": [{"field": "email", "message": "…"}, …]
    }

`detail` sigue siendo un texto para todas las pantallas que ya muestran
`err.response.data.detail`; `errors` permite marcar cada campo del formulario.
Nunca se devuelve el valor enviado.
"""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Nombre visible de los campos más comunes (el resto usa el nombre técnico).
FIELD_LABELS = {
    "full_name": "Nombre completo", "sp_full_name": "Nombre del Súper Profesor",
    "name": "Nombre", "title": "Título", "description": "Descripción",
    "email": "Correo electrónico", "sp_email": "Correo del Súper Profesor",
    "document_number": "Número de documento", "sp_document_number": "Número de documento",
    "document_type": "Tipo de documento", "sp_document_type": "Tipo de documento",
    "dane_code": "Código DANE", "phone": "Teléfono", "address": "Dirección",
    "website": "Sitio web", "password": "Contraseña", "new_password": "Nueva contraseña",
    "current_password": "Contraseña actual", "username": "Usuario",
    "birth_date": "Fecha de nacimiento", "grade": "Grado", "subject": "Materia",
    "subject_area": "Área", "content": "Contenido", "message": "Mensaje",
    "event_date": "Fecha", "event_time": "Hora", "date": "Fecha",
    "due_date": "Fecha de entrega", "invite_code": "Código de invitación",
    "max_students": "Cupo máximo", "duration": "Duración", "attempts": "Intentos",
    "points": "Puntos", "url": "Enlace", "topic": "Tema", "count": "Cantidad",
    "goal_interactions": "Meta de interacciones", "guardian_name": "Nombre del acudiente",
    "color": "Color", "category": "Categoría", "text": "Texto", "body": "Mensaje",
}


def _label(field: str) -> str:
    return FIELD_LABELS.get(field, field)


def _message(err: Dict[str, Any]) -> str:
    kind = err.get("type", "")
    ctx = err.get("ctx") or {}
    loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path", "form")]
    field = loc[-1] if loc else ""
    label = _label(field) if field and not field.isdigit() else "El valor"
    if kind == "value_error":
        # Mensaje propio de los validadores (app/core/validators.py).
        return str(ctx.get("error") or err.get("msg", "")).removeprefix("Value error, ")
    if kind == "missing":
        return f"{label}: este campo es obligatorio."
    if kind == "string_too_short":
        return f"{label}: debe tener al menos {ctx.get('min_length')} caracteres."
    if kind == "string_too_long":
        return f"{label}: no puede superar {ctx.get('max_length')} caracteres."
    if kind == "too_long":
        return f"{label}: admite como máximo {ctx.get('max_length')} elementos."
    if kind == "too_short":
        return f"{label}: necesita al menos {ctx.get('min_length')} elementos."
    if kind == "string_pattern_mismatch":
        return f"{label}: el formato no es válido."
    if kind in ("greater_than_equal", "greater_than"):
        return f"{label}: el valor mínimo permitido es {ctx.get('ge', ctx.get('gt'))}."
    if kind in ("less_than_equal", "less_than"):
        return f"{label}: el valor supera el máximo permitido ({ctx.get('le', ctx.get('lt'))})."
    if kind in ("int_parsing", "int_type", "int_from_float"):
        return f"{label}: debe ser un número entero."
    if kind in ("float_parsing", "float_type", "finite_number"):
        return f"{label}: debe ser un número válido."
    if kind in ("bool_parsing", "bool_type"):
        return f"{label}: debe ser verdadero o falso."
    if kind in ("literal_error", "enum"):
        return f"{label}: valor no permitido."
    if kind in ("string_type",):
        return f"{label}: debe ser texto."
    if kind in ("list_type", "dict_type", "model_type", "model_attributes_type"):
        return f"{label}: el formato enviado no es válido."
    if kind in ("json_invalid", "json_type"):
        return "La solicitud no tiene un formato JSON válido."
    return f"{label}: el valor no es válido."


def validation_payload(exc: RequestValidationError) -> Dict[str, Any]:
    errors: List[Dict[str, str]] = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path", "form")]
        errors.append({"field": ".".join(loc), "message": _message(err)})
    detail = errors[0]["message"] if errors else "Los datos enviados no son válidos."
    return {"detail": detail, "errors": errors}


async def _handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content=validation_payload(exc))


def install(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, _handler)
