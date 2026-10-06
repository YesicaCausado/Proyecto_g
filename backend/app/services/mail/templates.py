"""
NeuroLearn IA — Plantillas de correo transaccional.

Cada función devuelve asunto, HTML y texto plano. El texto plano mejora la
entregabilidad y sirve como respaldo en clientes que no muestran HTML.

Todo valor dinámico se escapa con ``html.escape`` (los nombres los digitan
administradores o vienen de archivos CSV).
"""
from __future__ import annotations

from dataclasses import dataclass
from html import escape
from typing import Optional

BRAND = "NeuroLearn IA"


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


def _layout(title: str, body_html: str) -> str:
    """Estructura común (mismo estilo de los correos anteriores)."""
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F6F3;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E9E9E7;border-radius:8px;overflow:hidden;">
    <div style="background:#37352F;padding:32px;text-align:center;">
      <h1 style="color:#FFFFFF;margin:0;font-size:20px;font-weight:700;">{BRAND}</h1>
      <p style="color:#9B9A97;margin:8px 0 0;font-size:13px;">Plataforma Inteligente de Aprendizaje</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#191919;font-size:18px;margin:0 0 8px;">{escape(title)}</h2>
      {body_html}
    </div>
    <div style="border-top:1px solid #E9E9E7;padding:20px 32px;text-align:center;">
      <p style="color:#9B9A97;font-size:12px;margin:0;">{BRAND} · Sistema educativo con inteligencia artificial</p>
    </div>
  </div>
</body>
</html>"""


def _button(url: str, label: str) -> str:
    return (
        '<div style="text-align:center;margin:32px 0;">'
        f'<a href="{escape(url, quote=True)}" style="display:inline-block;background:#37352F;color:#FFFFFF;'
        'text-decoration:none;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:600;">'
        f"{escape(label)}</a></div>"
    )


def _warning(html_text: str) -> str:
    return (
        '<div style="background:#FDF4EC;border:1px solid #F2D2B7;border-radius:6px;padding:16px;margin:24px 0;">'
        f'<p style="color:#D9730D;font-size:13px;margin:0;">{html_text}</p></div>'
    )


def _paragraph(html_text: str) -> str:
    return f'<p style="color:#787774;font-size:14px;line-height:1.6;margin:0 0 16px;">{html_text}</p>'


# ─── CU-03 Recuperar contraseña ──────────────────────────────────────────────

def render_password_reset_email(
    recipient_name: str,
    reset_url: str,
    expires_in_minutes: int,
) -> RenderedEmail:
    name = escape(recipient_name)
    body = (
        _paragraph(
            f'Hola <strong style="color:#37352F;">{name}</strong>,<br><br>'
            "Recibimos una solicitud para restablecer la contraseña de tu cuenta. "
            "Si no la realizaste, ignora este mensaje: tu contraseña no cambiará."
        )
        + _button(reset_url, "Restablecer contraseña")
        + _warning(
            f"Este enlace expira en <strong>{expires_in_minutes} minutos</strong> "
            "y solo puede usarse una vez."
        )
        + '<p style="color:#9B9A97;font-size:12px;margin:16px 0 0;">'
        "Si el botón no funciona, copia y pega este enlace en tu navegador:</p>"
        f'<p style="color:#0B6E99;font-size:12px;word-break:break-all;margin:4px 0 0;">{escape(reset_url)}</p>'
    )
    text = (
        f"Hola {recipient_name},\n\n"
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta en "
        f"{BRAND}.\n\nAbre este enlace para crear una nueva contraseña:\n{reset_url}\n\n"
        f"El enlace expira en {expires_in_minutes} minutos y solo puede usarse una vez.\n"
        "Si no realizaste esta solicitud, ignora este mensaje.\n"
    )
    return RenderedEmail(
        subject=f"Restablece tu contraseña — {BRAND}",
        html=_layout("Restablece tu contraseña", body),
        text=text,
    )


def render_password_changed_email(
    recipient_name: str,
    login_url: str,
    ip_address: Optional[str] = None,
) -> RenderedEmail:
    name = escape(recipient_name)
    ip_line = (
        f'<p style="color:#9B9A97;font-size:12px;margin:0;">Cambio realizado desde la IP {escape(ip_address)}.</p>'
        if ip_address
        else ""
    )
    body = (
        _paragraph(
            f'Hola <strong style="color:#37352F;">{name}</strong>,<br><br>'
            "Te confirmamos que la contraseña de tu cuenta fue cambiada correctamente."
        )
        + _warning(
            "Si <strong>no</strong> hiciste este cambio, avisa de inmediato a tu docente "
            "o al administrador de tu institución."
        )
        + _button(login_url, "Iniciar sesión")
        + ip_line
    )
    text = (
        f"Hola {recipient_name},\n\n"
        f"La contraseña de tu cuenta en {BRAND} fue cambiada correctamente.\n"
        "Si no hiciste este cambio, avisa de inmediato a tu docente o al "
        "administrador de tu institución.\n\n"
        f"Iniciar sesión: {login_url}\n"
    )
    return RenderedEmail(
        subject=f"Tu contraseña fue cambiada — {BRAND}",
        html=_layout("Tu contraseña fue cambiada", body),
        text=text,
    )


# ─── Credenciales iniciales (CU-28 / CU-29 / CU-37) ─────────────────────────

ROLE_LABELS = {
    "super_profesor": "Rector / Coordinador",
    "profesor": "Docente",
    "estudiante": "Estudiante",
}


def render_credentials_email(
    recipient_name: str,
    username: str,
    temp_password: str,
    role: str,
    login_url: str,
) -> RenderedEmail:
    role_label = ROLE_LABELS.get(role, role.capitalize())
    body = (
        _paragraph(
            f'Hola <strong style="color:#37352F;">{escape(recipient_name)}</strong>,<br><br>'
            f'Tu cuenta fue creada en {BRAND} con el rol de '
            f'<strong style="color:#37352F;">{escape(role_label)}</strong>. '
            "Estas son tus credenciales de acceso temporales:"
        )
        + '<div style="background:#F7F6F3;border:1px solid #E9E9E7;border-radius:6px;padding:20px;margin:0 0 24px;">'
        '<span style="color:#9B9A97;font-size:12px;">Usuario</span><br>'
        f'<strong style="color:#191919;font-size:16px;font-family:monospace;">{escape(username)}</strong><br><br>'
        '<span style="color:#9B9A97;font-size:12px;">Contraseña temporal</span><br>'
        f'<strong style="color:#191919;font-size:16px;font-family:monospace;">{escape(temp_password)}</strong>'
        "</div>"
        + _warning("Deberás <strong>cambiar esta contraseña</strong> en tu primer inicio de sesión.")
        + _button(login_url, "Ingresar a la plataforma")
    )
    text = (
        f"Hola {recipient_name},\n\n"
        f"Tu cuenta fue creada en {BRAND} con el rol de {role_label}.\n\n"
        f"Usuario: {username}\nContraseña temporal: {temp_password}\n\n"
        "Deberás cambiar esta contraseña en tu primer inicio de sesión.\n"
        f"Ingresar: {login_url}\n"
    )
    return RenderedEmail(
        subject=f"Tus credenciales de acceso — {BRAND}",
        html=_layout(f"Bienvenido a {BRAND}", body),
        text=text,
    )
