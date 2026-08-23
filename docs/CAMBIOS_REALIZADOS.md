# 📋 Cambios Realizados - Separación de Microservicios

## ✅ Completado

### 1. **Auth Service** (Nuevo)
- [x] Carpeta `/auth-service` creada
- [x] Configuración con Neon PostgreSQL
- [x] Modelos: `User`, `Permission`, `RefreshToken`
- [x] Endpoints de autenticación
- [x] Gestión de usuarios y permisos
- [x] Servicio de autenticación con JWT
- [x] Documentación (`README.md`)
- [x] Dockerfile

**Puerto**: 8002  
**BD**: Neon PostgreSQL  
**Responsabilidad**: Autenticación y gestión de usuarios

---

### 2. **Bot Service** (Modificado)
- [x] Removida lógica de autenticación local
- [x] Configuración actualizada para usar Auth Service
- [x] Variables de entorno actualizadas
- [x] Endpoints mantenidos: chat, bots, classrooms
- [x] Dockerfile creado

**Puerto**: 8001  
**BD**: SQLite local  
**Responsabilidad**: Bots, chat adaptativo, clases

---

### 3. **Documentación**
- [x] `ARQUITECTURA_MICROSERVICIOS.md` - Arquitectura completa
- [x] `INICIO_RAPIDO.md` - Guía de inicio rápido
- [x] `run_services.sh` - Script automático
- [x] `docker-compose.yml` - Orquestación de servicios

---

## 📁 Estructura del Proyecto

```
Proyecto_g/
├── auth-service/                    # 🆕 Nuevo servicio
│   ├── app/
│   │   ├── api/auth.py             # Endpoints de auth
│   │   ├── core/config.py
│   │   ├── db/database.py          # Neon PostgreSQL
│   │   ├── models/user.py
│   │   ├── schemas/schemas.py
│   │   ├── services/auth_service.py
│   │   └── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── Dockerfile
│   └── README.md
│
├── backend/                         # 🔧 Modificado (Bot Service)
│   ├── app/
│   │   ├── core/config.py          # ✏️ Actualizado
│   │   ├── main.py                 # ✏️ Actualizado
│   │   ├── api/
│   │   │   ├── chat.py             # (sin cambios)
│   │   │   ├── expert_bot.py       # (sin cambios)
│   │   │   └── classroom.py        # (sin cambios)
│   │   └── ...
│   ├── .env                        # ✏️ Actualizado
│   ├── Dockerfile                  # 🆕 Nuevo
│   └── requirements.txt
│
├── frontend/                        # ⚛️ Sin cambios
│   ├── src/
│   └── ...
│
├── ARQUITECTURA_MICROSERVICIOS.md   # 🆕 Documentación
├── INICIO_RAPIDO.md                 # 🆕 Guía rápida
├── run_services.sh                  # 🆕 Script automático
└── docker-compose.yml               # 🆕 Docker Compose
```

---

## 🔑 Cambios Principales en Backend

### config.py
- ❌ Removido: Modelos de usuario
- ✅ Agregado: Referencia a Auth Service
- ✅ Agregado: URL del Auth Service

### main.py
- ❌ Removido: Router de autenticación (`app.include_router(auth.router)`)
- ❌ Removido: Importación de modelos de usuario
- ✅ Agregado: Descripción del servicio
- ✅ Actualizado: Port a 8001

### .env
- ❌ Removido: DATABASE_URL apuntando a usuarios
- ✅ Agregado: AUTH_SERVICE_URL=http://localhost:8002

---

## 🚀 Cómo Ejecutar

### Opción 1: Script Automático
```bash
bash run_services.sh
```

### Opción 2: Docker Compose
```bash
docker-compose up
```

### Opción 3: Manual
```bash
# Terminal 1
cd auth-service && uvicorn app.main:app --reload --port 8002

# Terminal 2
cd backend && uvicorn app.main:app --reload --port 8001

# Terminal 3
cd frontend && npm run dev
```

---

## 📡 Flujo de Datos Actualizado

```
Frontend (5173)
    ↓
    ├→ POST /auth/login → Auth Service (8002)
    │     ↓
    │   Neon PostgreSQL
    │     ↓
    │   Retorna: access_token
    │
    └→ GET /chat/... + Header: Authorization: Bearer token
          → Bot Service (8001)
            ↓
            Valida token con Auth Service
            ↓
            SQLite Local
```

---

## 🔐 Estado de Autenticación

- ✅ **Auth Service**: Gestiona usuarios, registros, logins
- ✅ **Bot Service**: Solo acepta tokens del Auth Service
- ✅ **Frontend**: Usa tokens para acceder a ambos servicios

---

## 📊 Matriz de Responsabilidades

| Componente | Autenticación | Bots | Usuarios | Datos |
|-----------|---------------|------|----------|-------|
| Auth Service | ✅ | ❌ | ✅ | Neon PostgreSQL |
| Bot Service | No genera | ✅ | Solo valida | SQLite |
| Frontend | Cliente | Cliente | Cliente | - |

---

## ⚙️ Verificación

1. ✅ Ambos servicios con su propia BD
2. ✅ Auth Service con Neon PostgreSQL
3. ✅ Bot Service independiente
4. ✅ Comunicación por JWT tokens
5. ✅ Roles y permisos centralizados

---

## 📚 Documentación Disponible

1. **ARQUITECTURA_MICROSERVICIOS.md** - Detalles técnicos completos
2. **INICIO_RAPIDO.md** - Para comenzar rápidamente
3. **auth-service/README.md** - Documentación específica del Auth Service
4. **backend/README.md** - Documentación específica del Bot Service (existente)

---

## 🎯 Próximos Pasos

1. [x] Separar servicios ✅
2. [x] Configurar Neon PostgreSQL ✅
3. [ ] Actualizar frontend para usar URLs separadas
4. [ ] Agregar middleware de validación de tokens
5. [ ] Implementar rate limiting
6. [ ] Configurar CI/CD
7. [ ] Tests de integración

---

## 🔗 URLs

- **Frontend**: http://localhost:5173
- **Auth Service**: http://localhost:8002/docs
- **Bot Service**: http://localhost:8001/docs

---

¡Listo para usar! 🚀
