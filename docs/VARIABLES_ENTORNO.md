# 📋 Variables de Entorno del Proyecto

## 🔍 Resumen Completo de Variables

Tu proyecto tiene **12 variables de entorno principales** distribuidas en el backend. Aquí están todas:

---

## **1. VARIABLES DE CONFIGURACIÓN GENERAL**

### `DEBUG` 
- **Tipo**: Boolean
- **Valor local**: `True`
- **Valor Vercel**: `false`
- **Propósito**: Habilitar modo debug (logs verbosos)
- **Ubicación**: `backend/app/core/config.py`

### `APP_NAME`
- **Tipo**: String
- **Valor**: `"NeuroLearn Bot Service"`
- **Propósito**: Nombre de la aplicación
- **Ubicación**: `backend/app/core/config.py`

### `APP_VERSION`
- **Tipo**: String
- **Valor**: `"1.0.0"`
- **Propósito**: Versión de la app
- **Ubicación**: `backend/app/core/config.py`

### `ENVIRONMENT`
- **Tipo**: String
- **Valores posibles**: `"development"`, `"preview"`, `"production"`
- **Propósito**: Detectar automáticamente en qué entorno corre (Vercel)
- **Ubicación**: `backend/app/core/config.py`

---

## **2. VARIABLES DE BASE DE DATOS**

### `DATABASE_URL` ⭐ **CRÍTICA**
- **Tipo**: String
- **Valor local**: `sqlite:///./neurolearn.db`
- **Valor Vercel**: `postgresql://user:password@host/dbname?sslmode=require`
- **Propósito**: Conexión a la base de datos
- **Ubicación**: `backend/app/core/config.py` + `backend/.env`
- **En Vercel**: Debe apuntar a **Neon.tech** (PostgreSQL)

---

## **3. VARIABLES DE SEGURIDAD**

### `SECRET_KEY` ⭐ **CRÍTICA**
- **Tipo**: String
- **Valor local**: `"neurolearn-secret-key-cambiar-en-produccion-2026"`
- **Valor Vercel**: Debe ser ALEATORIO y LARGO (mín. 32 caracteres)
- **Propósito**: Clave secreta para JWT (autenticación)
- **Ubicación**: `backend/app/core/config.py` + `backend/.env`
- **Uso**: Encriptar y desencriptar tokens JWT

### `ALGORITHM`
- **Tipo**: String
- **Valor**: `"HS256"`
- **Propósito**: Algoritmo de encriptación para JWT
- **Ubicación**: `backend/app/core/config.py` (hardcoded)

### `ACCESS_TOKEN_EXPIRE_MINUTES`
- **Tipo**: Integer
- **Valor**: `1440` (24 horas)
- **Propósito**: Tiempo de expiración del token JWT
- **Ubicación**: `backend/app/core/config.py` (hardcoded)

---

## **4. VARIABLES DE LLM / IA** 

### `GROQ_API_KEY` ⭐ **IMPORTANTE**
- **Tipo**: String
- **Valor local**: `gsk_... (tu_clave_local)`
- **Valor Vercel**: Debe ser reemplazado por tu propia API Key
- **Propósito**: API Key para Groq AI (proveedor principal)
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`
- **Proveedor**: https://console.groq.com/keys
- **Límite gratis**: 14,400 requests/día
- **Modelos disponibles**:
  - `qwen/qwen3-32b` (recomendado)
  - `llama-3.1-8b-instant`
  - `mixtral-8x7b-32768`

### `GROQ_MODEL`
- **Tipo**: String
- **Valor**: `"qwen/qwen3-32b"`
- **Propósito**: Modelo LLM a usar en Groq
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`
- **Alternativas**: `llama-3.1-8b-instant`, `mixtral-8x7b-32768`

### `GEMINI_API_KEY`
- **Tipo**: String (opcional)
- **Valor local**: Vacío
- **Valor Vercel**: Tu API Key de Google Gemini
- **Propósito**: API Key para Google Gemini (fallback secundario)
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`
- **Proveedor**: https://aistudio.google.com/app/apikey
- **Límite gratis**: 1,500 requests/día
- **Modelo**: `"gemini-2.0-flash"`

### `OPENAI_API_KEY`
- **Tipo**: String (opcional)
- **Valor local**: Vacío
- **Valor Vercel**: Tu API Key de OpenAI
- **Propósito**: API Key para OpenAI (alternativa premium)
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`
- **Proveedor**: https://platform.openai.com/api-keys
- **Modelo**: `"gpt-3.5-turbo"`
- **Nota**: Es de pago (~$0.002 por 1K tokens entrada)

---

## **5. VARIABLES DE UMBRALES COGNITIVOS**

### `FATIGUE_THRESHOLD`
- **Tipo**: Float
- **Valor**: `0.7` (70%)
- **Propósito**: Umbral para detectar fatiga del estudiante
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`

### `OVERLOAD_THRESHOLD`
- **Tipo**: Float
- **Valor**: `0.8` (80%)
- **Propósito**: Umbral para detectar sobrecarga cognitiva
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`

### `DOUBT_THRESHOLD`
- **Tipo**: Float
- **Valor**: `0.6` (60%)
- **Propósito**: Umbral para detectar dudas/confusión
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`

### `MASTERY_THRESHOLD`
- **Tipo**: Float
- **Valor**: `0.85` (85%)
- **Propósito**: Umbral para detectar dominio del tema
- **Ubicación**: `backend/.env` + `backend/app/core/config.py`

---

## **6. VARIABLES DE ENTORNO VERCEL (AUTOMÁTICAS)**

Vercel proporciona estas automáticamente (no necesitas configurarlas):

### `VERCEL_ENV`
- **Valores**: `"production"`, `"preview"`, `"development"`
- **Propósito**: Indicar el entorno de Vercel
- **Tu código usa**: Detecta si `VERCEL_ENV == "production"`

### `VERCEL_URL`
- **Valor**: Tu dominio de Vercel (ej: `proyecto-g-xyz.vercel.app`)
- **Propósito**: URL de tu deployment

---

## **7. VARIABLES OPCIONALES**

### `COGNITIVE_ANALYSIS_WINDOW`
- **Tipo**: Integer
- **Valor**: `30` (segundos)
- **Propósito**: Ventana de tiempo para análisis neuroconductual
- **Ubicación**: `backend/app/core/config.py` (hardcoded)

### `AUTH_SERVICE_URL`
- **Tipo**: String
- **Valor local**: `"http://localhost:8002"`
- **Valor Vercel**: URL del servicio de autenticación
- **Propósito**: Validar tokens JWT con otro servicio
- **Ubicación**: `backend/app/core/config.py`

---

## 📊 **Tabla Resumen**

| Variable | Tipo | Local | Vercel | Obligatoria | Proveedor |
|----------|------|-------|--------|-------------|-----------|
| `DEBUG` | bool | true | false | ✓ | - |
| `DATABASE_URL` | str | sqlite | postgresql | ✓ | Neon.tech |
| `SECRET_KEY` | str | default | ALEATORIO | ✓ | - |
| `GROQ_API_KEY` | str | válida | **CAMBIAR** | ✓ | Groq Console |
| `GROQ_MODEL` | str | qwen3-32b | qwen3-32b | ✓ | - |
| `GEMINI_API_KEY` | str | vacío | opcional | ✗ | Google AI |
| `OPENAI_API_KEY` | str | vacío | opcional | ✗ | OpenAI |
| `ENVIRONMENT` | str | development | production | - | Vercel (auto) |
| `FATIGUE_THRESHOLD` | float | 0.7 | 0.7 | - | - |
| `OVERLOAD_THRESHOLD` | float | 0.8 | 0.8 | - | - |
| `DOUBT_THRESHOLD` | float | 0.6 | 0.6 | - | - |
| `MASTERY_THRESHOLD` | float | 0.85 | 0.85 | - | - |

---

## 🚨 **CRÍTICO PARA VERCEL**

### Variables que DEBES cambiar:

1. **`DATABASE_URL`**
   ```
   ❌ LOCAL:  sqlite:///./neurolearn.db
   ✅ VERCEL: postgresql://user:password@host/dbname?sslmode=require
   ```
   - Obtén en: https://neon.tech

2. **`SECRET_KEY`**
   ```
   ❌ LOCAL:  neurolearn-secret-key-cambiar-en-produccion-2026
   ✅ VERCEL: <genera-uno-aleatorio-largo>
   ```
   - Genera con: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

3. **`GROQ_API_KEY`**
   ```
   ❌ LOCAL:  gsk_... (tu_clave_local)
   ✅ VERCEL: <tu-propia-api-key>
   ```
   - ⚠️ No uses la key local en producción, genera la tuya en: https://console.groq.com/keys

---

## 📁 **Dónde Están Definidas**

```
backend/
├── .env                    ← AQUÍ se cargan las variables (local)
└── app/
    └── core/
        └── config.py       ← AQUÍ se leen con os.getenv()

.env.example               ← Plantilla
.env.production            ← Para Vercel
```

---

## 🔄 **Cómo se Cargan**

1. **Localmente**: Pydantic lee `backend/.env` automáticamente
   ```python
   # backend/app/core/config.py
   class Config:
       env_file = ".env"
   ```

2. **En Vercel**: Las variables se configuran en:
   - `vercel.com` → tu proyecto → Settings → Environment Variables

3. **Orden de precedencia**:
   - 1️⃣ Environment Variables de Vercel
   - 2️⃣ Variables de sistema
   - 3️⃣ Valores por defecto en `config.py`

---

## ✅ **Checklist para Vercel**

- [ ] Crear cuenta en Groq.com y obtener API Key
- [ ] Crear proyecto en Neon.tech y obtener DATABASE_URL
- [ ] Generar SECRET_KEY aleatorio (mín. 32 caracteres)
- [ ] Configurar variables en Vercel dashboard
- [ ] Hacer deploy
- [ ] Testear API con: `curl https://tu-app.vercel.app/api/v1/health`

---

## 🔗 **Enlaces Útiles**

- **Groq**: https://console.groq.com/keys
- **Gemini**: https://aistudio.google.com/app/apikey
- **OpenAI**: https://platform.openai.com/api-keys
- **Neon PostgreSQL**: https://neon.tech
- **Vercel Docs**: https://vercel.com/docs/projects/environment-variables

