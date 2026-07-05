# 🚨 Troubleshooting: Error 401/500 en Vercel

## Síntomas
```
Failed to load resource: the server responded with a status of 401 ()
Failed to load resource: the server responded with a status of 500 ()
```

Al intentar registrarse o iniciar sesión en Vercel, recibir errores HTTP 401 o 500.

---

## Causas Posibles

### 1. ❌ Variables de Entorno No Configuradas (MÁS COMÚN)
**Verificar:**
```bash
vercel env list
```

**Debe mostrar:**
- ✅ DATABASE_URL
- ✅ SECRET_KEY
- ✅ GROQ_API_KEY
- ✅ GROQ_MODEL

**Si faltan:**
```bash
# Opción A: Dashboard UI
# https://vercel.com/dashboard → Settings → Environment Variables → Add

# Opción B: CLI
vercel env add DATABASE_URL
# Pega: postgresql://postgres.XXXX:XXXX@aws-1-sa-east-1.pooler.supabase.com:5432/postgres

vercel env add SECRET_KEY
# Pega: tu_clave_secreta

vercel env add GROQ_API_KEY  
# Pega: gsk_XXXXXX

vercel env add GROQ_MODEL
# Pega: qwen/qwen3-32b
```

**Luego redeploy:**
```bash
vercel --prod
```

---

### 2. ❌ DATABASE_URL Incorrecta
**Error típico:** `Could not connect to database`

**Verificar:**
- ✅ Usa URL del **pooler** (no la directa)
  ```
  ✅ aws-1-sa-east-1.pooler.supabase.com
  ❌ db.sapozcwaspvibklyfldr.supabase.co
  ```

- ✅ La contraseña tiene caracteres especiales (@, %, etc.) → Deben estar escapados
  ```
  ✅ UntoD%40wn2712  (@ es %40)
  ❌ UntoD@wn2712
  ```

- ✅ La BD está activa en Supabase
  - Ve a: https://app.supabase.com
  - Verifica que tu proyecto esté "Active"

**Solución:**
```bash
# Copiar URL exacta del pooler desde Supabase
# Settings → Database → Connection string → Connection pooler

vercel env add DATABASE_URL
# Pega la URL completa
vercel --prod
```

---

### 3. ❌ SECRET_KEY Vacía o Faltante
**Error típico:** `"secret_key" not configured`

**Verificar:**
```bash
vercel env list
```

**Si está vacía o falta:**
```bash
vercel env add SECRET_KEY
# Pega cualquier string fuerte: sb_secret_XXXXXXXXX
vercel --prod
```

---

### 4. ❌ GROQ_API_KEY Expirada o Inválida
**Error típico:** `Invalid API key` (en logs)

**Verificar:**
- ✅ Obtén nueva clave en: https://console.groq.com
- ✅ La clave empieza con `gsk_`
- ✅ No tiene espacios en blanco

**Solución:**
```bash
vercel env add GROQ_API_KEY
# Pega tu nueva clave
vercel --prod
```

---

### 5. ❌ BASE de Datos Sin Tablas
**Error típico:** `relation "users" does not exist`

**Verificar:**
```bash
# Conectarse a Supabase desde terminal
psql postgresql://postgres.sapozcwaspvibklyfldr:UntoD%40wn2712@aws-1-sa-east-1.pooler.supabase.com:5432/postgres

# Ver tablas
\dt

# Si están vacías, crear schema
python backend/app/db/database.py  # Si existe script de init
```

---

## 🔍 Diagnóstico Rápido

### Opción 1: Script Automático
```bash
python scripts/diagnose_vercel.py
```

### Opción 2: Ver Logs Reales
```bash
vercel logs --follow
# Busca líneas con ERROR o EXCEPTION
# Muestra qué variable de entorno falta
```

### Opción 3: Probar Endpoint Manualmente
```bash
# Test 1: Health check
curl https://proyecto-g-xxxxx.vercel.app/api/v1/health
# Debe retornar 200 OK

# Test 2: Ver error específico
curl -X POST https://proyecto-g-xxxxx.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!","full_name":"Test"}'
# Muestra el error exacto en JSON
```

---

## ✅ Checklist Pre-Validación

Antes de probar en Vercel, verifica en tu máquina local:

```bash
# 1. Backend levanta sin errores
cd backend
python -m uvicorn app.main:app --reload --port 8000
# Debe mostrar: "Application startup complete"

# 2. Puedes conectar a DB local
python -c "from app.db.database import engine; print(engine)"
# Debe mostrar la conexión

# 3. Auth endpoint funciona localmente
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!","full_name":"Test"}'
# Debe retornar 201 Created

# 4. Redeploy en Vercel
git push origin feat-neuroconductual-patterns
# Vercel se redeploya automáticamente
```

---

## 🚀 Pasos Finales

1. **Verificar vars:** `vercel env list`
2. **Redeploy:** `vercel --prod`
3. **Ver logs:** `vercel logs --follow`
4. **Probar:** Registrarse en UI
5. **Si sigue fallando:** Copiar error exacto de logs

---

## Links de Referencia

| Problema | Link |
|----------|------|
| Supabase Pooler | https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler |
| Vercel Env Vars | https://vercel.com/docs/projects/environment-variables |
| Vercel Logs | https://vercel.com/docs/observability/edge-middleware-logs |
| Groq API | https://console.groq.com |

---

## 💡 Resumen Rápido

**Error 401/500 = Variables no configuradas en Vercel**

**Solución en 3 pasos:**
```bash
# 1. Revisar qué falta
vercel env list

# 2. Agregar variables faltantes
vercel env add DATABASE_URL        # Pega URL
vercel env add SECRET_KEY          # Pega clave
vercel env add GROQ_API_KEY        # Pega clave  
vercel env add GROQ_MODEL          # Pega: qwen/qwen3-32b

# 3. Redeploy
vercel --prod
```

**Eso es todo.** 🚀
