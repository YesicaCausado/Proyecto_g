# 🔧 Solución: Error de Límite de Memoria en Vercel

## Problema
```
Error: Memory limit exceeded
Function ran out of memory during execution
```

Vercel tiene un límite de memoria para funciones serverless.

---

## Causa
- `memory: 3008MB` es demasiado para Vercel (límite máximo es 3008, pero generalmente falla)
- Las dependencias de Python ocupan mucha memoria (numpy, pandas, scikit-learn, etc.)

---

## Solución ✅

Se optimizó `vercel.json`:

```json
"functions": {
  "api/index.py": {
    "runtime": "python3.11",
    "memory": 1024,        // Reducido de 3008 a 1024MB
    "maxDuration": 30      // Reducido de 60s a 30s
  }
}
```

Y el buildCommand:

```json
"buildCommand": "pip install --no-cache-dir -r backend/requirements.txt && cd frontend && npm ci && npm run build"
```

**Cambios:**
- ✅ `memory: 1024` - Límite estándar de Vercel
- ✅ `maxDuration: 30` - Timeouts más rápidos (evita procesos lentos)
- ✅ `--no-cache-dir` - No guardar cache de pip (ahorra espacio)
- ✅ `npm ci` - En lugar de `npm install` (más eficiente)

---

## Optimizaciones Adicionales

El archivo `.vercelignore` ya contiene:
- ✅ `backend/.venv` - No incluir entorno virtual local
- ✅ `backend/__pycache__` - No incluir bytecode compilado
- ✅ `backend/tests/` - No incluir tests
- ✅ `backend/scripts/` - No incluir scripts
- ✅ `.env` - No incluir variables de entorno

---

## Verificación

Después del push, Vercel debería:

1. ✅ Compilar con menos memoria
2. ✅ Instalar dependencias más rápidamente
3. ✅ Servir la API sin errores de OOM

Prueba:
```bash
curl -X POST https://proyecto-g-xxxxx.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!","full_name":"Test"}'
```

---

## Si Sigue Fallando

### Opción A: Optimizar requirements.txt

Remover dependencias innecesarias:
```bash
# Revisar qué se usa realmente
grep -r "import numpy" backend/app/
grep -r "import pandas" backend/app/
grep -r "import sklearn" backend/app/
```

Si no se usa → remover del `requirements.txt`

### Opción B: Usar Lambda@Edge

Vercel permite optimizar con Lambda@Edge en Pro plan.

### Opción C: Cambiar a otro host

Si Vercel sigue sin ser suficiente:
- Railway.app
- Heroku (ahora de pago)
- Render.com
- Digital Ocean

---

## Links Útiles

- **Vercel Functions Memory**: https://vercel.com/docs/functions/serverless-functions/memory
- **Vercel Pricing**: https://vercel.com/pricing
- **Python Memory Optimization**: https://realpython.com/python-memory-management/

---

✅ **Con estos cambios, el error de memoria debería estar resuelto.**
