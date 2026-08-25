# Fix: Error 403 Forbidden en `POST /api/v1/auth/login` (producción)

## Síntoma

En producción (`https://neurolearnym.vercel.app`) el login falla con:

```
POST https://neurolearnym.vercel.app/api/v1/auth/login 403 (Forbidden)
```

## Causa raíz

El endpoint `POST /api/v1/auth/login` (`backend/app/api/auth.py`) llama a
`check_origin(request)` (validación CSRF de origen). Esto compara el encabezado
`Origin`/`Referer` del navegador contra `settings.ALLOWED_ORIGINS`.

La lista global en `backend/app/core/config.py` solo contenía orígenes
`localhost`. Como `CSRF_ORIGIN_ENFORCEMENT` está por defecto en `true`, el
dominio de producción quedaba rechazado → `403 "Origen no permitido."`.

## Corrección aplicada

En `backend/app/core/config.py`, se agregó el dominio de producción:

```python
ALLOWED_ORIGINS: list = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8000",
    "https://neurolearnym.vercel.app",
]
```

## Pasos para desplegar

1. Confirmar el cambio en `backend/app/core/config.py`.
2. Commit + push a la rama que depliegue a producción.
3. En Vercel: redeployar el deployment de producción (o el push lo hace solo).
4. Verificar con:

```bash
curl -X POST https://neurolearnym.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://neurolearnym.vercel.app" \
  -d '{"username":"demo","password":"..."}'
```

Debe devolver `200` (o `401` si las credenciales son incorrectas), nunca `403`.

## Notas

- Si más adelante se añade un dominio personalizado (ej. `https://neurolearn.app`),
  agregarlo aquí también.
- `ALLOWED_ORIGINS` es una lista hardcodeada en `config.py`, no viene de una
  variable de entorno; cualquier cambio requiere redeploy.