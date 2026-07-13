# 🔐 Credenciales de Demostración

Las siguientes credenciales están disponibles para pruebas en el sistema NeuroLearn:

## Accesos por Rol

| Rol | Usuario | Contraseña | Panel |
|-----|---------|-----------|-------|
| **Estudiante** | `demo` | `demo` | Panel Estudiante |
| **Profesor** | `profesor` | `profesor` | Panel Profesor |
| **Admin** | `admin` | `admin1234` | Panel Administrador |
| **Super Profesor (Rector)** | `superprofesor` | `superprofesor` | Panel de Rectoría |

## Actualizado

- ✅ **Última actualización:** 13 de Julio de 2026
- ✅ **Estado:** Todas las contraseñas verificadas y funcionando
- ✅ **Backend:** Supabase PostgreSQL
- ✅ **Autenticación:** JWT Token

## Notas Importantes

1. Estas credenciales son solo para demostración y pruebas
2. Todas las contraseñas están hasheadas con bcrypt en la base de datos
3. La autenticación usa JWT tokens de corta duración
4. Los usuarios demo no tienen datos reales sino datos de prueba
5. Para producción, crear usuarios con contraseñas seguras

## Cómo usar

### Frontend
1. Accede a la aplicación en `http://localhost:5173`
2. Ingresa el usuario y contraseña del rol deseado
3. Se generará automáticamente un JWT token

### Backend (Testing)
```bash
# Prueba de login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo"
  }'
```

## Endpoints de Autenticación

- `POST /api/v1/auth/login` - Autenticarse
- `GET /api/v1/auth/me` - Obtener perfil actual
- `POST /api/v1/auth/logout` - Cerrar sesión
- `POST /api/v1/auth/refresh` - Renovar token

---
**NeuroLearn** - Sistema de Aprendizaje Adaptativo Neuroconductual
