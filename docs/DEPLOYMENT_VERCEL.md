# 🚀 Guía Completa: Desplegar NeuroLearn en Vercel con IA

## **1. Preparativos Previos**

### 1.1 Crear Cuenta en Vercel
- Ve a [vercel.com](https://vercel.com)
- Conecta tu GitHub (donde está el repo)
- Autoriza a Vercel acceder a tus repositorios

### 1.2 Obtener API Keys Gratis

**Groq API (Recomendado - IA Principal)**
1. Ve a [console.groq.com](https://console.groq.com/keys)
2. Crea una cuenta con tu email
3. Genera una API Key
4. Copia: `gsk_...`
5. **Límite gratis**: 14,400 requests/día (suficiente para pruebas)

**Google Gemini (Fallback)**
1. Ve a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Haz clic en "Get API Key" → "Create API key in new project"
3. Copia la key
4. **Límite gratis**: 1,500 requests/día

### 1.3 Base de Datos PostgreSQL (Gratis en Neon)
1. Ve a [neon.tech](https://neon.tech)
2. Registrate con GitHub
3. Crea un "New Project"
4. Nombre: `neurolearn-prod`
5. Copia el **Connection String**: `postgresql://user:password@host/dbname?sslmode=require`

---

## **2. Deploy en Vercel**

### 2.1 Crear Nuevo Proyecto en Vercel
1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Haz clic en "+ Add New" → "Project"
3. Busca tu repositorio: `Proyecto_g`
4. Haz clic en "Import"

### 2.2 Configurar Variables de Entorno
En la página de "Environment Variables", agrega:

```
DATABASE_URL = postgresql://user:password@host/dbname?sslmode=require
SECRET_KEY = <genera-aqui-una-clave-aleatoria-larga>
GROQ_API_KEY = gsk_...
GROQ_MODEL = qwen/qwen3-32b
GEMINI_API_KEY = <tu-key>
DEBUG = false
```

**Para generar SECRET_KEY seguro:**
```bash
# En tu terminal local
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Luego copia el resultado a `SECRET_KEY`

### 2.3 Configurar Build Settings
- **Root Directory**: `.` (raíz del proyecto)
- **Build Command**: `npm run build` (Vercel lo ejecutará automáticamente)
- **Output Directory**: `frontend/dist`
- **Node.js version**: `18.x` (o más reciente)

### 2.4 Hacer Deploy
1. Haz clic en "Deploy"
2. Vercel inicia el build (espera 5-10 minutos)
3. Una vez completado, obtendrás tu URL: `https://proyecto-g-xyz.vercel.app`

---

## **3. Verificar que Funciona**

### 3.1 Probar Frontend
- Accede a `https://tu-proyecto.vercel.app`
- Verifica que se cargue la interfaz
- Prueba navegación básica

### 3.2 Probar Backend (API)
```bash
# En tu terminal, reemplaza tu-proyecto
curl https://tu-proyecto.vercel.app/api/v1/health
# Debe responder con estado 200
```

### 3.3 Probar Chat con IA
1. Ve a la app
2. Selecciona una skill (ej: "Inglés Básico")
3. Escribe un mensaje
4. La IA debe responder (usa Groq)

---

## **4. Troubleshooting Común**

### ❌ Error: "Cannot find module 'app'"
**Solución**: Verifica que `api/index.py` exista y esté correctamente configurado:
```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app.main import app
```

### ❌ Error: "Connection refused" en la IA
**Solución**: 
1. Verifica que `GROQ_API_KEY` esté en Environment Variables de Vercel
2. Espera 30 segundos después de agregar la variable
3. Redeploy: va a "Deployments" → últimas deployment → "Redeploy"

### ❌ Error: "Database connection failed"
**Solución**:
1. Verifica que `DATABASE_URL` es válida en Neon
2. Incluye `?sslmode=require` en la connection string
3. Prueba la conexión en Neon: "Connection Details" → test

### ❌ CORS errors en la consola
**Solución**: Las rutas de Vercel ya incluyen CORS configurado, pero si persiste:
1. Ve a `backend/app/main.py`
2. Agrega tu dominio de Vercel a `ALLOWED_ORIGINS`
3. Redeploy

---

## **5. Monitoreo y Logs**

### Ver logs en tiempo real
1. Ve a vercel.com → tu proyecto
2. Haz clic en "Deployments" (última)
3. Busca sección "Logs"
4. Puedes ver errores del backend aquí

### Revisar Build Errors
- Si el build falla, verá rojo
- Haz clic en "Build Logs"
- Busca líneas con "ERROR" o "FAILED"

---

## **6. Actualizar Backend en Vercel**

Después de cambios locales:

```bash
# En tu terminal local
git add .
git commit -m "Cambios en IA/backend"
git push origin main
```

Vercel **automáticamente**:
1. Detecta el push
2. Inicia nuevo build
3. Despliega cambios (2-5 minutos)

---

## **7. Escalar Límites de API**

Si necesitas más de 14,400 req/día:

### Opción A: Usar API de Pago
- OpenAI: $0.002 por 1K tokens (entrada), $0.015 por 1K (salida)
- Groq: $0.05 por 1M tokens (muy barato, también pagado)
- Gemini: $0.0001 por 1K tokens

### Opción B: Self-Hosted
- Despliega Llama local en Hugging Face Spaces (gratis)
- Modifica `GROQ_API_KEY` a URL local

---

## **8. Estructura Vercel Final**

```
proyectog/
├── api/
│   └── index.py              ← Punto entrada backend
├── backend/
│   ├── app/
│   │   ├── main.py           ← FastAPI
│   │   ├── core/
│   │   ├── api/
│   │   ├── models/
│   │   └── ...
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts        ← Axios con /api/v1
│   │   └── ...
│   ├── package.json
│   ├── vite.config.ts
│   └── ...
├── requirements.txt          ← Para Vercel Python
├── vercel.json              ← Config de rutas
└── .env.production          ← Vars de entorno
```

---

## **9. Checklist Antes de Producción**

- ✅ Groq API Key funciona
- ✅ Database PostgreSQL conecta
- ✅ Frontend builds correctamente (`npm run build`)
- ✅ Rutas `/api` redirigen a backend
- ✅ Chat responde con IA
- ✅ Quizzes funcionan
- ✅ Avatar y modo Live activos
- ✅ Logs limpios sin errores

---

## **10. Comandos Útiles**

```bash
# Test local antes de enviar a Vercel
cd frontend && npm run build
# Verifica que no hay errores TypeScript

# Ver qué se desplegará
git status

# Force push (solo si necesitas)
git push origin main --force
```

---

¡Listo! 🎉 Tu IA está en Vercel y accesible globalmente.
