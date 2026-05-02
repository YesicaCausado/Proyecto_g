# 🔐 Auth Service - NeuroLearn AI

Servicio independiente de autenticación y gestión de usuarios con **Neon PostgreSQL**.

## Características

✅ Autenticación JWT (acceso + refresco)  
✅ Gestión de usuarios y perfiles  
✅ Control de acceso basado en roles (RBAC)  
✅ Tokens revocables  
✅ Integración con Neon PostgreSQL  
✅ Password hashing con BCrypt  

---

## Instalación

```bash
cd auth-service

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno (ya preconfigurado en .env)
cat .env
```

---

## Ejecutar

```bash
# Desarrollo
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

# Producción
uvicorn app.main:app --host 0.0.0.0 --port 8002 --workers 4
```

Luego accede a: `http://localhost:8002/docs`

---

## 📁 Estructura

```
auth-service/
├── app/
│   ├── api/
│   │   └── auth.py           # Endpoints REST
│   ├── core/
│   │   └── config.py         # Configuración
│   ├── db/
│   │   └── database.py       # Conexión PostgreSQL
│   ├── models/
│   │   └── user.py           # Modelos SQLAlchemy
│   ├── schemas/
│   │   └── schemas.py        # Schemas Pydantic
│   ├── services/
│   │   └── auth_service.py   # Lógica de autenticación
│   └── main.py               # FastAPI app
├── requirements.txt
├── .env
└── Dockerfile
```

---

## 🔑 Endpoints

### Autenticación

**POST** `/api/v1/auth/register`
```json
{
  "username": "usuario",
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Mi Nombre",
  "role": "estudiante"
}
```

**POST** `/api/v1/auth/login`
```json
{
  "username": "usuario",
  "password": "password123"
}
```
Response: `{access_token, refresh_token, expires_in}`

**POST** `/api/v1/auth/refresh`
```json
{
  "refresh_token": "eyJ..."
}
```

**GET** `/api/v1/auth/me` (Con Bearer Token)

**PUT** `/api/v1/auth/me` (Actualizar perfil)

**POST** `/api/v1/auth/logout`

---

### Admin Only

**GET** `/api/v1/auth/users` - Listar usuarios

**PUT** `/api/v1/auth/users/{user_id}/permissions` - Actualizar permisos

**DELETE** `/api/v1/auth/users/{user_id}` - Eliminar usuario

---

## 👥 Roles

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **estudiante** | Usuario regular | Acceso a chatbots |
| **profesor** | Puede crear bots | Crear, entrenar, compartir bots |
| **admin** | Control total | Gestionar usuarios y permisos |

---

## 🔒 Permisos

```python
{
  "can_create_bots": bool,
  "can_train_bots": bool,
  "can_share_bots": bool,
  "can_manage_classroom": bool
}
```

---

## 🗄️ Base de Datos

**Neon PostgreSQL**
- Host: `ep-restless-river-am0m57yj-pooler.c-5.us-east-1.aws.neon.tech`
- Database: `neondb`

**Tablas**:
- `users` - Usuarios con perfil cognitivo
- `permissions` - Permisos del sistema
- `refresh_tokens` - Tokens revocables

---

## 📝 Variables de Entorno (`.env`)

```env
DATABASE_URL=postgresql://...
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
```

---

## 🧪 Prueba Rápida

```bash
# Registrar
curl -X POST http://localhost:8002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test",
    "email": "test@test.com",
    "password": "test123",
    "role": "estudiante"
  }'

# Login
curl -X POST http://localhost:8002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Ver perfil (reemplazar TOKEN)
curl http://localhost:8002/api/v1/auth/me \
  -H "Authorization: Bearer TOKEN"
```

---

## 🔗 Integración

El **Bot Service** valida tokens usando los mismos **SECRET_KEY** y **ALGORITHM**.

```python
# Bot Service usa tokens del Auth Service
Authorization: Bearer {access_token}
```

---

## 📊 Diagrama

```
Frontend
   ↓
Auth Service
   ↓
[Neon PostgreSQL]
   ↓
JWT Token
   ↓
Bot Service (Valida token)
```

---

## 🚀 Deployment

### Docker

```bash
docker build -t neurolearn-auth .
docker run -p 8002:8000 neurolearn-auth
```

---

## 📚 Más Información

- [API Docs](http://localhost:8002/docs) - Swagger UI
- [Arquitectura Completa](../ARQUITECTURA_MICROSERVICIOS.md)
- [Inicio Rápido](../INICIO_RAPIDO.md)
