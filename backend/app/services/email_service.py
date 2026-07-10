"""
NeuroLearn IA — Servicio de Email
Usa Resend como proveedor. Falla silenciosamente en desarrollo
si no hay API key configurada para no bloquear el flujo.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_resend():
    """Importa resend de forma lazy para evitar error si no está instalado."""
    try:
        import resend
        return resend
    except ImportError:
        logger.warning("⚠️ Librería 'resend' no instalada. Ejecuta: pip install resend")
        return None


def send_password_reset_email(
    to_email: str,
    to_name: str,
    reset_token: str,
    ip_address: Optional[str] = None,
) -> bool:
    """
    Envía el correo de recuperación de contraseña.
    Devuelve True si se envió correctamente, False si falló.
    """
    if not settings.RESEND_API_KEY:
        logger.warning(
            "⚠️ RESEND_API_KEY no configurada. "
            f"Token de recuperación para {to_email}: {reset_token}"
        )
        return False

    resend = _get_resend()
    if not resend:
        return False

    resend.api_key = settings.RESEND_API_KEY

    # URL del frontend para resetear contraseña
    base_url = "http://localhost:5173" if settings.DEBUG else "https://neurolearn.app"
    reset_url = f"{base_url}/reset-password?token={reset_token}"

    ip_info = f"<p style='color:#787774;font-size:12px;'>Solicitud realizada desde IP: {ip_address}</p>" if ip_address else ""

    html_content = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                 background:#F7F6F3; margin:0; padding:40px 20px;">
      <div style="max-width:480px; margin:0 auto; background:white;
                  border:1px solid #E9E9E7; border-radius:8px; overflow:hidden;">

        <!-- Header -->
        <div style="background:#37352F; padding:32px; text-align:center;">
          <h1 style="color:white; margin:0; font-size:20px; font-weight:700;">
            NeuroLearn IA
          </h1>
          <p style="color:#9B9A97; margin:8px 0 0; font-size:13px;">
            Plataforma Inteligente de Aprendizaje
          </p>
        </div>

        <!-- Contenido -->
        <div style="padding:32px;">
          <h2 style="color:#191919; font-size:18px; margin:0 0 8px;">
            Recupera tu contraseña
          </h2>
          <p style="color:#787774; font-size:14px; line-height:1.6; margin:0 0 24px;">
            Hola <strong style="color:#37352F;">{to_name}</strong>,<br><br>
            Recibimos una solicitud para restablecer la contraseña de tu cuenta.
            Si no realizaste esta solicitud, puedes ignorar este mensaje con seguridad.
          </p>

          <!-- Botón -->
          <div style="text-align:center; margin:32px 0;">
            <a href="{reset_url}"
               style="display:inline-block; background:#37352F; color:white;
                      text-decoration:none; padding:14px 32px; border-radius:6px;
                      font-size:14px; font-weight:600;">
              Restablecer contraseña
            </a>
          </div>

          <!-- Advertencia -->
          <div style="background:#FDF4EC; border:1px solid #F2D2B7;
                      border-radius:6px; padding:16px; margin:24px 0;">
            <p style="color:#D9730D; font-size:13px; margin:0;">
              ⚠️ Este enlace expira en <strong>15 minutos</strong> y
              solo puede usarse una vez.
            </p>
          </div>

          <!-- Link alternativo -->
          <p style="color:#9B9A97; font-size:12px; margin:16px 0 0;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </p>
          <p style="color:#0B6E99; font-size:12px; word-break:break-all;
                    margin:4px 0 0;">
            {reset_url}
          </p>

          {ip_info}
        </div>

        <!-- Footer -->
        <div style="border-top:1px solid #E9E9E7; padding:20px 32px;
                    text-align:center;">
          <p style="color:#9B9A97; font-size:12px; margin:0;">
            NeuroLearn IA · Sistema educativo con inteligencia artificial
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": "Recupera tu contraseña — NeuroLearn IA",
            "html": html_content,
        })
        logger.info(f"✅ Email de recuperación enviado a {to_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Error enviando email a {to_email}: {e}")
        return False