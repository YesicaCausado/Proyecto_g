# 🚀 Guía Rápida - Ejecutar NeuroLearn AI

## Arquitectura Separada

El proyecto ahora está dividido en **3 servicios independientes**:

| Servicio | Puerto | BD | Stack |
|----------|--------|-----|-------|
| 🔐 Auth Service | 8002 | Neon PostgreSQL | Python/FastAPI |
| 🤖 Bot Service | 8001 | SQLite | Python/FastAPI |
| ⚛️ Frontend | 5173 | - | React/TypeScript/Vite |

---

## Ejecución Rápida

### Opción 1️⃣: Script Automático (Recomendado)

```bash
bash run_services.sh
```

Esto instala dependencias e inicia todos los servicios automáticamente.

---

### Opción 2️⃣: Ejecución Manual en Terminales Separadas

#### Terminal 1 - Auth Service
```bash
cd auth-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

#### Terminal 2 - Bot Service
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

#### Terminal 3 - Frontend
```bash
cd frontend
npm install
npm run dev
```

---

### Opción 3️⃣: Docker Compose

```bash
docker-compose up
```

---

## 📡 URLs de Acceso

- **Frontend**: http://localhost:5173
- **Auth Service Docs**: http://localhost:8002/docs
- **Bot Service Docs**: http://localhost:8001/docs

---

## 🧪 Prueba Rápida

### 1️⃣ Registrar Usuario (Auth Service)

```bash
curl -X POST http://localhost:8002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "full_name": "Test User",
    "role": "estudiante"
  }'
```

### 2️⃣ Login (Get Token)

```bash
curl -X POST http://localhost:8002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

Copiar el `access_token` del resultado.

### 3️⃣ Usar Token en Bot Service

```bash
curl http://localhost:8001/api/v1/chat/ \
  -H "Authorization: Bearer {access_token}"
```

---

## 📊 Flujo de Datos

```
Frontend (5173)
    ↓
    ├→ Auth Service (8002) [Autenticación]
    │   └→ Neon PostgreSQL
    │
    └→ Bot Service (8001) [Bots & Chat]
        └→ SQLite Local
        └→ (Valida token con Auth Service)
```

---

## 🔒 Seguridad

- ✅ JWT con acceso + refresh tokens
- ✅ Hashing BCrypt de contraseñas
- ✅ CORS configurado
- ✅ Roles y permisos (RBAC)
- ✅ SSL/TLS en Neon PostgreSQL

---

## 🐛 Troubleshooting

### Puerto ya está en uso
```bash
# Buscar proceso en puerto 8001
lsof -i :8001

# Matar proceso
kill -9 <PID>
```

### Errores de Base de Datos
- **Auth Service**: Revisar conexión Neon en `.env`
- **Bot Service**: Eliminar `backend/bots.db` para reset

### CORS Error
Asegúrate que `http://localhost:5173` está en `ALLOWED_ORIGINS`

---

## 📚 Documentación Completa

Ver [ARQUITECTURA_MICROSERVICIOS.md](ARQUITECTURA_MICROSERVICIOS.md)

---

## 🎯 Próximos Pasos

1. ✅ Servicios ejecutándose
2. 📝 Crear usuario en Auth Service
3. 🤖 Crear bot en Bot Service
4. 💬 Chat con bots adaptativos
5. 🎓 Gestionar clases y estudiantes

¡Happy Coding! 🚀
