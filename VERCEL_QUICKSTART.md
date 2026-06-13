# 🚀 GUÍA RÁPIDA: Vercel + Supabase para NeuroLearn AI

## 1. Variables de Entorno Críticas

**Estas 4 son las MÍNIMAS para que funcione:**

```env
DATABASE_URL=postgresql://postgres.sapozcwaspvibklyfldr:UntoD%40wn2712@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
SECRET_KEY=sb_secret_baKWiCpN8miI3ruhEzQ85g_-m2w13nd
GROQ_API_KEY=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
GROQ_MODEL=qwen/qwen3-32b
```

---

## 2. Configurar en Vercel Dashboard

### Via UI (Interface Gráfica)

1. **Ir a tu proyecto en Vercel**
   - https://vercel.com/dashboard

2. **Click en "Settings"**

3. **Buscar "Environment Variables"** (izquierda)

4. **Agregar cada variable:**
   - Nombre: `DATABASE_URL`
   - Valor: `postgresql://...`
   - Seleccionar: ✓ Production  ✓ Preview  ✓ Development
   - Click "Save"

5. **Repetir para:**
   - `SECRET_KEY`
   - `GROQ_API_KEY`
   - `GROQ_MODEL`

6. **Redeploy**
   - Click en "Deployments"
   - Seleccionar última versión
   - Click "Redeploy"

---

## 3. Verificar Conexión

### Test 1: Ver logs
```bash
vercel logs --follow
# Buscar "DATABASE_URL" para confirmar que se cargó
```

### Test 2: Endpoint de salud
```bash
curl https://tu-proyecto.vercel.app/api/v1/health
# Debe devolver 200 OK
```

### Test 3: Conectar a DB
```bash
curl -X POST https://tu-proyecto.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "password": "Test123!",
    "full_name": "Test User"
  }'
# Debe devolver un token JWT
```

---

## 4. Errors Comunes

### ❌ "Connection refused" / "Database unreachable"
**Causa:** DATABASE_URL no está configurada o es inválida

**Solución:**
- Verifica que está en Vercel Settings → Environment Variables
- Usa URL del **pooler**, no la directa
- Redeploy después de cambiar

### ❌ "SECRET_KEY not found"
**Causa:** SECRET_KEY vacía o no configurada

**Solución:**
- Configura SECRET_KEY en Vercel
- No debe estar vacía
- Redeploy

### ❌ "GROQ_API_KEY invalid"
**Causa:** Clave expirada o incorrecta

**Solución:**
- Obtén nueva clave en https://console.groq.com
- Actualiza en Vercel
- Redeploy

### ❌ "503 Service Unavailable"
**Causa:** Función serverless tardando mucho (cold start)

**Solución:**
- Normal en primer request
- Suele tomar 2-3 segundos
- Si es recurrente, optimizar en backend

---

## 5. Monitoreo

### Ver logs en tiempo real
```bash
vercel logs --follow
```

### Ver métricas
```bash
vercel analytics
```

### Ver todas las funciones
```bash
vercel functions list
```

---

## 6. Redeploy Rápido

### Opción A: Push a GitHub
```bash
git push origin feat-neuroconductual-patterns
# Vercel se redeploya automáticamente
```

### Opción B: Desde CLI
```bash
vercel --prod
```

### Opción C: Desde Dashboard
- Settings → Git → Desactivar Auto-Deploy
- Luego usar "Redeploy" botón

---

## 7. Checklist Pre-Deploy

- [ ] DATABASE_URL configurada en Vercel
- [ ] SECRET_KEY configurada en Vercel
- [ ] GROQ_API_KEY configurada en Vercel
- [ ] GROQ_MODEL = qwen/qwen3-32b
- [ ] Backend compila sin errores: `cd backend && python -m pytest`
- [ ] Frontend compila: `cd frontend && npm run build`
- [ ] Rama subida a GitHub: `git push origin feat-neuroconductual-patterns`
- [ ] Vercel tiene permisos de repositorio

---

## 8. URLs Importantes

| Servicio | URL |
|----------|-----|
| Vercel Dashboard | https://vercel.com/dashboard |
| Tu Proyecto Vercel | https://tu-proyecto.vercel.app |
| Supabase Dashboard | https://app.supabase.com |
| Groq Console | https://console.groq.com |
| Gemini API | https://makersuite.google.com/app/apikey |

---

## 9. Support

Si algo no funciona:

1. **Ver logs:** `vercel logs --follow`
2. **Verificar variables:** Dashboard → Settings → Environment Variables
3. **Redeploy:** `vercel --prod`
4. **Limpiar cache:** `vercel env list` y revisar

---

## ✅ Estado Actual

- ✓ Rama `feat-neuroconductual-patterns` creada y subida
- ✓ Backend con NeuroconductualEngine integrado
- ✓ Supabase configurado localmente
- ⏳ Pendiente: Configurar Vercel Environment Variables
- ⏳ Pendiente: Redeploy en Vercel

**Próximo paso:** Ejecutar `scripts/setup_vercel.py` o configurar manualmente en Vercel Dashboard.
