# 🚀 Configuración de Vercel para NeuroLearn AI

## Variables de Entorno Requeridas en Vercel

Para que Vercel pueda conectarse a Supabase y ejecutar correctamente el backend, necesitas configurar las siguientes variables de entorno en el dashboard de Vercel.

### 1. **Base de Datos (Supabase)**
```
DATABASE_URL=postgresql://postgres.sapozcwaspvibklyfldr:UntoD%40wn2712@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```
**Nota:** Usa la URL del **connection pooler** (no la URL estándar) para mejor rendimiento en serverless.

### 2. **Autenticación JWT**
```
SECRET_KEY=sb_secret_baKWiCpN8miI3ruhEzQ85g_-m2w13nd
ALGORITHM=HS256
```

### 3. **LLM (Groq - Principal)**
```
GROQ_API_KEY=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
GROQ_MODEL=qwen/qwen3-32b
```

### 4. **LLM (Gemini - Fallback)**
```
GEMINI_API_KEY=<tu_clave_gemini_aqui>
GEMINI_MODEL=gemini-2.0-flash
```

### 5. **Azure Cognitive Services (TTS - Frontend)**
```
VITE_AZURE_SPEECH_KEY=<tu_clave_azure_aqui>
VITE_AZURE_SPEECH_REGION=eastus
```

### 6. **Configuración General**
```
APP_NAME=NeuroLearn AI
APP_VERSION=1.0.0
DEBUG=false
VERCEL_ENV=production

FATIGUE_THRESHOLD=0.7
OVERLOAD_THRESHOLD=0.8
DOUBT_THRESHOLD=0.6
MASTERY_THRESHOLD=0.85
```

---

## 📋 Pasos para Configurar en Vercel

### Opción A: Via Dashboard (UI)
1. Ir a **Vercel Dashboard** → Tu proyecto → **Settings** → **Environment Variables**
2. Hacer clic en **Add New**
3. Copiar cada variable de la lista anterior
4. Seleccionar los ambientes: `Production`, `Preview`, `Development`
5. Hacer clic en **Save**
6. Redeploy el proyecto

### Opción B: Via CLI (Vercel CLI)
```bash
# Instalar Vercel CLI si no la tienes
npm i -g vercel

# Ir al directorio del proyecto
cd c:\Users\Yesica\proyectog

# Autenticar
vercel login

# Configurar variables
vercel env add DATABASE_URL
vercel env add SECRET_KEY
vercel env add GROQ_API_KEY
vercel env add GROQ_MODEL
vercel env add GEMINI_API_KEY
vercel env add GEMINI_MODEL
vercel env add VITE_AZURE_SPEECH_KEY
vercel env add VITE_AZURE_SPEECH_REGION
vercel env add FATIGUE_THRESHOLD
vercel env add OVERLOAD_THRESHOLD
vercel env add DOUBT_THRESHOLD
vercel env add MASTERY_THRESHOLD

# Redeploy
vercel --prod
```

---

## 🔗 Conexión a Supabase en Vercel

### Pooler vs Direct Connection
- **Connection Pooler** (recomendado para Vercel): `aws-1-sa-east-1.pooler.supabase.com:5432`
  - Usa PgBouncer para reutilizar conexiones
  - Mejor rendimiento en serverless
  - Máximo 100 conexiones simultáneas
  
- **Direct Connection** (no recomendado): `db.sapozcwaspvibklyfldr.supabase.co:5432`
  - Una conexión por proceso
  - Agota rápidamente en serverless

### Verificar Conexión en Vercel Logs
```bash
# Ver logs en vivo
vercel logs --follow

# Buscar "DATABASE_URL" en los logs para confirmar que se carga
```

---

## ✅ Verificación

Después de configurar, comprueba que todo funciona:

1. **Desplegar a Vercel**
   ```bash
   git push origin feat-neuroconductual-patterns
   # Vercel se desplegará automáticamente
   ```

2. **Verificar endpoint de salud**
   ```bash
   curl https://tu-proyecto.vercel.app/api/v1/health
   ```

3. **Probar login**
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"yes","password":"123456"}'
   ```

4. **Probar chat**
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/v1/chat/start \
     -H "Authorization: Bearer <tu_token_aqui>" \
     -H "Content-Type: application/json"
   ```

---

## 🚨 Troubleshooting

### Error: "Could not connect to database"
- ✅ Verifica que DATABASE_URL está configurada en Vercel
- ✅ Usa la URL del **pooler**, no la directa
- ✅ Asegúrate que Supabase está en línea
- ✅ Revisa los logs: `vercel logs --follow`

### Error: "GROQ_API_KEY not found"
- ✅ Confirma que GROQ_API_KEY está en Environment Variables
- ✅ Redeploy después de agregar: `vercel --prod`

### Error: "Secret key not found"
- ✅ Verifica SECRET_KEY en Vercel
- ✅ No debe estar vacía

### Slow Performance
- ✅ Verifica que DATABASE_URL usa el pooler
- ✅ Revisa Cold Starts en Vercel Analytics
- ✅ Optimiza funciones serverless si es necesario

---

## 📚 Links Útiles

- **Supabase Connection Pooling**: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- **Vercel Environment Variables**: https://vercel.com/docs/projects/environment-variables
- **Vercel Deployment Guide**: https://vercel.com/docs/getting-started-with-vercel
- **Vercel CLI Docs**: https://vercel.com/cli

---

## 🎯 Resumen Rápido

**Lo mínimo para que funcione:**
```env
DATABASE_URL=postgresql://...
SECRET_KEY=sb_secret_...
GROQ_API_KEY=gsk_...
GROQ_MODEL=qwen/qwen3-32b
```

Después de configurar → Redeploy → ¡Listo! 🚀
