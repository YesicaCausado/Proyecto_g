# 👨‍🏫 Crear Usuarios Profesor - NeuroLearn AI

## ✅ Usuario Profesor Creado

Se ha creado exitosamente el primer usuario profesor:

```
🔑 Usuario:        profesor
📧 Email:          profesor@gmail.com
👤 Nombre:         profesor
👨‍🏫 Rol:            PROFESOR
✓ Activo:          True
🧠 Acceso Experto:  True
📝 ID:             10
```

**Credenciales:**
- Usuario: `profesor`
- Contraseña: `profesor1234`

---

## 🛠️ Crear Más Profesores

### Opción 1: Modo Interactivo
```bash
cd backend
python scripts/create_teacher.py
```

Esto abrirá un menú interactivo donde ingresarás:
- Usuario (username)
- Email
- Nombre completo
- Contraseña

### Opción 2: Modo Rápido (No-interactivo)
```bash
cd backend
python scripts/create_teacher_quick.py "juan" "juan@gmail.com" "Juan Pérez" "securepass123"
```

---

## 📋 Información Importante

### Roles de Usuario Disponibles
- **`estudiante`** - Estudiante regular (sin acceso experto)
- **`profesor`** - Profesor (con acceso experto)
- **`super_profesor`** - Profesor superior
- **`admin`** - Administrador del sistema

### Características del Rol Profesor
✅ Acceso a todas las funciones  
✅ Puede crear y entrenar bots expertos  
✅ Acceso a análisis detallados de estudiantes  
✅ Puede crear cuestionarios y desafíos  
✅ Acceso a panel de control  

### Requisitos de Contraseña
- Mínimo 6 caracteres
- Puede contener mayúsculas, minúsculas, números y símbolos

---

## 🔍 Verificar Profesores Creados

En Supabase SQL Editor:
```sql
SELECT id, username, email, full_name, role, is_active, is_expert, created_at
FROM users
WHERE role = 'profesor'
ORDER BY created_at DESC;
```

---

## 📝 Scripts Disponibles

| Script | Ubicación | Tipo | Descripción |
|--------|-----------|------|-------------|
| `create_teacher.py` | `/backend/scripts/` | Interactivo | Crear profesor con prompts |
| `create_teacher_quick.py` | `/backend/scripts/` | CLI | Crear profesor con argumentos |

---

## 🚀 Próximas Acciones

1. **Iniciar Sesión**: Usa las credenciales del profesor en el frontend
2. **Crear Bots Expertos**: Los profesores pueden entrenar bots especializados
3. **Crear Desafíos**: Pueden crear quizzes y desafíos para estudiantes
4. **Analizar Datos**: Acceso a métricas y análisis de desempeño estudiantil

---

## ⚠️ Notas Importantes

- Las contraseñas se hashean con bcrypt (seguras)
- Los profesores tienen `is_expert=True` por defecto
- El perfil cognitivo se inicializa automáticamente
- No hay límite de profesores que puedes crear

---

## 🆘 Solución de Problemas

### Error: "El usuario ya existe"
Significa que ese username o email ya está registrado en la base de datos.
Intenta con un username diferente.

### Error: "Contraseña muy corta"
La contraseña debe tener mínimo 6 caracteres.

### Error de conexión a BD
Verifica que el archivo `.env` tenga las credenciales correctas de Supabase.
