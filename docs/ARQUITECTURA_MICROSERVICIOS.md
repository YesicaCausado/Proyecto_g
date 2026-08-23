# 🏗️ Arquitectura de Microservicios - NeuroLearn AI

## Descripción

El proyecto NeuroLearn AI ha sido separado en dos microservicios independientes:

### 1. **Auth Service** (Puerto 8002)
- **Base de Datos**: Neon PostgreSQL
- **Responsabilidades**:
  - Autenticación de usuarios (Register, Login, JWT)
  - Gestión de usuarios y permisos
  - Control de acceso basado en roles (RBAC)
  - Tokens de refresco y sesiones prolongadas
- **URL**: `http://localhost:8002`
- **Docs**: `http://localhost:8002/docs`

### 2. **Bot Service** (Puerto 8001)
- **Base de Datos**: SQLite local (caché de bots)
- **Responsabilidades**:
  - Gestión de bots inteligentes
  - Chat adaptativo con IA
  - Bots expertos entrenables
  - Análisis neuroconductual
  - Gestión de clases (profesores)
- **URL**: `http://localhost:8001`
- **Docs**: `http://localhost:8001/docs`

### 3. **Frontend** (Puerto 5173)
- **Framework**: React + TypeScript + Vite
- **URL**: `http://localhost:5173`

---

## 🗄️ Bases de Datos

### Auth Service - Neon PostgreSQL
```
Conexión: postgresql://neondb_owner:npg_MAed8LuD7yOz@ep-restless-river-am0m57yj-pooler.c-5.us-east-1.aws.neon.tech/neondb
```

**Tablas**:
- `users` - Usuarios con roles y permisos
- `permissions` - Permisos del sistema
- `refresh_tokens` - Tokens de refresco revocables

### Bot Service - SQLite
```
Archivo: backend/bots.db
```

**Tablas**:
- `learning_sessions` - Sesiones de aprendizaje
- `expert_bots` - Bots entrenables
- `classrooms` - Aulas virtuales

---

## 📡 Integración entre Servicios

### Auth Service → Bot Service

1. **Validación de Tokens**:
   ```
   Cliente → Bot Service
   Cliente agrega: Authorization: Bearer {token}
   Bot Service valida con Auth Service
   ```

2. **Obtener Datos de Usuario**:
   ```
   Bot Service → Auth Service (/api/v1/auth/me)
   Inyecta el token para obtener info del usuario
   ```

### Frontend → Servicios

```
Frontend (5173)
    ↓
Auth Service (8002) → Login/Register
    ↓
Bot Service (8001) → Chat, Bots, Clases
```

---

## 🚀 Ejecución de los Servicios

### Opción 1: Ejecución Manual

```bash
# Terminal 1 - Auth Service
cd auth-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

# Terminal 2 - Bot Service
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Terminal 3 - Frontend
cd frontend
npm install
npm run dev
```

### Opción 2: Docker Compose (Recomendado)

```bash
docker-compose up
```

---

## 🔐 Flujo de Autenticación

### 1. Registro
```
POST /api/v1/auth/register
{
  "username": "usuario",
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Usuario",
  "role": "estudiante"  // "estudiante" | "profesor" | "admin"
}
```

### 2. Login
```
POST /api/v1/auth/login
{
  "username": "usuario",
  "password": "password123"
}

Response:
{
  "access_token": "eyJ0...",
  "refresh_token": "eyJ0...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 3. Usar Token en Bot Service
```
GET /api/v1/chat/start
Headers: Authorization: Bearer {access_token}
```

### 4. Refrescar Token
```
POST /api/v1/auth/refresh
{
  "refresh_token": "eyJ0..."
}
```

---

## 👥 Roles y Permisos

### Estudiante
- `can_create_bots`: false
- `can_train_bots`: false
- `can_share_bots`: false
- `can_manage_classroom`: false

### Profesor
- `can_create_bots`: true
- `can_train_bots`: true
- `can_share_bots`: true
- `can_manage_classroom`: true

### Admin
- Acceso completo a todas las funciones

---

## 🔍 Endpoints Principales

### Auth Service

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Registrar usuario |
| POST | `/api/v1/auth/login` | Iniciar sesión |
| POST | `/api/v1/auth/refresh` | Refrescar token |
| POST | `/api/v1/auth/logout` | Cerrar sesión |
| GET | `/api/v1/auth/me` | Obtener perfil actual |
| PUT | `/api/v1/auth/me` | Actualizar perfil |
| GET | `/api/v1/auth/users` | Listar usuarios (admin) |
| PUT | `/api/v1/auth/users/{id}/permissions` | Actualizar permisos (admin) |
| DELETE | `/api/v1/auth/users/{id}` | Eliminar usuario (admin) |

### Bot Service

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/chat/` | Listar chats |
| POST | `/api/v1/chat/` | Crear nuevo chat |
| POST | `/api/v1/chat/{chat_id}/message` | Enviar mensaje |
| GET | `/api/v1/bots/` | Listar bots |
| POST | `/api/v1/bots/` | Crear bot |
| POST | `/api/v1/bots/{bot_id}/train` | Entrenar bot |
| GET | `/api/v1/classrooms/` | Listar aulas |
| POST | `/api/v1/classrooms/` | Crear aula |

---

## 🛠️ Variables de Entorno

### Auth Service (.env)
```
DATABASE_URL=postgresql://...
SECRET_KEY=your-secret-key
AUTH_SERVICE_URL=http://localhost:8002
```

### Bot Service (.env)
```
DATABASE_URL=sqlite:///./bots.db
SECRET_KEY=your-secret-key
AUTH_SERVICE_URL=http://localhost:8002
```

---

## 📊 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                 Frontend (React)                     │
│              http://localhost:5173                   │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
   ┌─────────────┐          ┌─────────────┐
   │ Auth        │          │ Bot         │
   │ Service     │          │ Service     │
   │ :8002       │          │ :8001       │
   └────┬────────┘          └──▲──────────┘
        │                      │
   [Neon PostgreSQL]      [SQLite Local]
   - users                - sessions
   - permissions          - bots
   - refresh_tokens       - classrooms
```

---

## 🔒 Seguridad

1. **JWT Tokens**: Acceso y refresco separados
2. **Password Hashing**: BCrypt con salt
3. **CORS**: Configurado por servicio
4. **SSL/TLS**: Requerido en Neon PostgreSQL
5. **RBAC**: Roles y permisos granulares

---

## 📝 Notas

- Los tokens de acceso expiran en 1 hora
- Los tokens de refresco expiran en 7 días
- Los permisos se asignan por rol en el registro
- Los admins pueden cambiar permisos de los usuarios
- Ambos servicios comparten la misma SECRET_KEY para JWT

---

## 🚀 Siguientes Pasos

1. Configurar variables de entorno en producción
2. Implementar rate limiting
3. Agregar logging centralizado
4. Configurar CI/CD
5. Documentar más endpoints
