# CU-03 Recuperar contraseña — Configuración de Brevo y Vercel

Requisito: RF-ES-005 / RF-29 «El sistema debe permitir recuperar la contraseña mediante correo electrónico».

## 1. Cómo funciona

| Paso | Pantalla / endpoint | Qué hace |
|---|---|---|
| 1 | `/forgot-password` → `POST /api/v1/auth/forgot-password` | El usuario escribe su usuario (n.º de documento) o su correo. Si la cuenta es elegible, se envía un enlace por Brevo. La respuesta es siempre la misma. |
| 2 | `/reset-password?token=…` → `POST /api/v1/auth/reset-password/validate` | La pantalla comprueba que el enlace exista, no esté usado y no haya vencido. |
| 3 | `/reset-password` → `POST /api/v1/auth/reset-password` | Se guarda la nueva contraseña, se anula el enlace y se envía un aviso de cambio. |

Código:

- Caso de uso: `backend/app/services/password_reset_service.py`
- Persistencia: `backend/app/repositories/password_reset_repository.py`
- Correo (puerto + adaptadores): `backend/app/services/mail/`
- Endpoints: `backend/app/api/auth.py` (sección CU-03)
- Pantallas: `frontend/src/pages/auth/ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`

## 2. Reglas de negocio

- **RN-CU03-01** La solicitud nunca revela si la cuenta existe, está inactiva o no tiene correo, y tarda al menos 1,5 s en responder.
- **RN-CU03-02** Solo se envía a correos reales. Los estudiantes creados sin correo tienen `{documento}@neurolearn.local` y deben pedir el restablecimiento al Administrador (CU-42 `POST /admin/users/{id}/reset-password`).
- **RN-CU03-03** El enlace vence a los 15 minutos y sirve una sola vez. Pedir uno nuevo anula los anteriores.
- **RN-CU03-04** Máximo 1 solicitud por minuto y 3 por hora por cuenta (guardado en BD, funciona en Vercel).
- **RN-CU03-05** La BD guarda solo el hash SHA-256 del token (columna `password_reset_tokens.token`).
- **RN-CU03-06** La nueva contraseña cumple la política (8+ caracteres, mayúscula, minúscula, número, carácter especial), debe ser distinta de la actual y quita `must_change_password`.
- **RN-CU03-07** Tras el cambio se envía un aviso al correo (si falla, el cambio se mantiene).
- Cada solicitud y cada cambio quedan en `audit_logs` (`password_reset_requested`, `password_reset_completed`).

## 3. Configurar Brevo (una sola vez)

1. Crear una cuenta gratuita en brevo.com (300 correos/día).
2. **Remitente**: *Senders, Domains & Dedicated IPs → Senders → Add a sender*. Usar un correo del equipo (por ejemplo, una cuenta de Gmail creada para el proyecto) y confirmar el código que llega a ese buzón. No hace falta dominio propio.
3. **API key**: *SMTP & API → API keys → Generate a new API key*. Copiarla (empieza por `xkeysib-`).
4. **IP autorizadas**: en *Security → Authorised IPs* desactivar el bloqueo de IP desconocidas. Vercel no tiene IP fija; si el bloqueo está activo, Brevo responde `401 unrecognised IP address` y el log del backend lo indica.

> Entregabilidad: con un remitente de Gmail/Hotmail, Brevo reemplaza la dirección visible por una de su propio dominio para cumplir las reglas de Gmail, Yahoo y Microsoft. Los correos llegan, pero pueden caer en spam. Para la etapa comercial basta con comprar un dominio, autenticarlo en Brevo (DKIM/DMARC) y cambiar `EMAIL_FROM`; no se modifica código.

## 4. Variables de entorno

En Vercel: *Project → Settings → Environment Variables* (Production y Preview). Luego hacer *Redeploy*.

| Variable | Ejemplo | Obligatoria |
|---|---|---|
| `BREVO_API_KEY` (o `RESEND_API_KEY`) | `xkeysib-…` | Sí |
| `EMAIL_FROM` | `NeuroLearn IA <neurolearn.soporte@gmail.com>` | Sí (debe ser el remitente verificado) |
| `FRONTEND_URL` | `https://neurolearnym.vercel.app` | Recomendada (si falta, se usa el dominio de producción de Vercel) |
| `EMAIL_PROVIDER` | `brevo` | No (por defecto `brevo`) |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `15` | No |

Compatibilidad: si `BREVO_API_KEY` no existe, el backend usa `RESEND_API_KEY` (nombre heredado que ya contenía la key de Brevo). Se recomienda renombrarla a `BREVO_API_KEY` para que el nombre coincida con el proveedor.

## 5. Desarrollo local

En `backend/.env`:

```
EMAIL_PROVIDER=console
FRONTEND_URL=http://localhost:5173
```

Con `console` el correo no se envía: el enlace aparece en la consola de `uvicorn`. Para probar el envío real, usar `EMAIL_PROVIDER=brevo` con `BREVO_API_KEY` y `EMAIL_FROM`.

Pruebas unitarias (no requieren BD ni red):

```
cd backend
python -m pytest tests/test_password_reset_service.py -v
```

## 6. Verificación en producción

1. Iniciar sesión como Administrador → *Configuración del sistema*: «Email (Brevo)» debe mostrar *Configurado ✓*.
2. En `/forgot-password` escribir el documento de un estudiante que tenga correo real.
3. Revisar el buzón (y spam). En Brevo: *Transactional → Logs* muestra el envío con la etiqueta `recuperar-contrasena`.
4. Abrir el enlace, fijar la contraseña e iniciar sesión.
5. Si no llega: revisar *Vercel → Logs* filtrando por `CU-03`.

## 7. Limitaciones conocidas (trabajo futuro)

- Cambiar la contraseña no cierra las sesiones ya abiertas: los JWT emitidos siguen válidos hasta vencer (24 h). Requiere guardar `password_changed_at` en `users` y compararlo con la fecha de emisión del token.
- El límite global por IP (`check_rate_limit`) vive en memoria de cada instancia de Vercel; el límite por cuenta (RN-CU03-04) sí es persistente.
- El remitente configurado desde el panel del Administrador (`PATCH /admin/config`) solo dura mientras viva la instancia serverless; el valor permanente es la variable `EMAIL_FROM`.
