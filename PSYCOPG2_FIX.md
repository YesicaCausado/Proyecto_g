# 🚀 SOLUCIÓN: Error psycopg2 en Vercel

## Problema
```
ModuleNotFoundError: No module named 'psycopg2'
```

Esto ocurre cuando Vercel no instala las dependencias de Python del backend.

---

## Causa
El archivo `requirements.txt` estaba en `backend/requirements.txt`, pero Vercel no sabía dónde buscarlo.

---

## Solución ✅

Se actualizó `vercel.json` para:

1. **Instalar dependencias en buildCommand:**
   ```json
   "buildCommand": "pip install -r backend/requirements.txt && cd frontend && npm install && npm run build"
   ```

2. **Configurar runtime correcto para funciones:**
   ```json
   "functions": {
     "api/index.py": {
       "runtime": "python3.11",
       "memory": 3008,
       "maxDuration": 60,
       "includeFiles": ["backend/**"]
     }
   }
   ```

---

## Verificación

Después de hacer push, Vercel debería:

1. ✅ Instalar psycopg2 desde requirements.txt
2. ✅ Importar `api/index.py` correctamente  
3. ✅ Levantar la app FastAPI sin errores
4. ✅ Responder a `/api/v1/auth/login` con 200

---

## Próximos Pasos

1. **Permitir el secret en GitHub** (click en el link de GH)
2. **Git push nuevamente**
   ```bash
   git push origin feat-neuroconductual-patterns
   ```
3. **Vercel se redeploya automáticamente**
4. **Probar en Vercel:**
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"test","email":"test@test.com","password":"Test123!","full_name":"Test"}'
   ```

---

## Si Sigue Fallando

1. Ver logs:
   ```bash
   vercel logs --follow
   ```

2. Verificar que psycopg2 está en requirements.txt:
   ```bash
   grep psycopg2 backend/requirements.txt
   # Debe mostrar: psycopg2-binary==2.9.9
   ```

3. Redeploy forzado:
   ```bash
   vercel --prod --confirm
   ```

---

✅ **Con estos cambios en vercel.json, el error de psycopg2 debe estar resuelto.**
