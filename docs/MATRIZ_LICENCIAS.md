# 🧾 Matriz de Licencias y Permisos — NeuroLearn AI

> **Fuente de verdad de código:** `backend/app/services/license_service.py` (`FEATURE_MATRIX`,
> `has_feature()`, `require_feature()`). Frontend consume la misma lógica vía
> `LicenseContext.hasFeature()`.

## 1. Modelo de acceso

```
ACCESO = (ROL tiene permiso a la feature)  AND  (LICENCIA de la institución la incluye)
```

- La **licencia pertenece a la institución**; todos los usuarios de esa institución
  heredan las funcionalidades habilitadas por su plan.
- **ADMIN** es un rol administrativo independiente de la licencia (acceso global,
  gestionado aparte de la matriz).
- Los planes son **acumulativos**: `PREMIUM = BASIC + extras`, `PRO = PREMIUM + extras`.
  Un usuario PRO nunca pierde una función de Premium o Basic.

## 2. Roles

| Rol | Clave backend | Descripción |
|-----|---------------|-------------|
| Súper Profesor | `super_profesor` | Rectoría / gestión institucional |
| Profesor | `profesor` | Docencia, aulas, bots, seguimiento |
| Estudiante | `estudiante` | Aprendizaje adaptativo |
| Admin | `admin` | Administración global (independiente de licencia) |

## 3. Funcionalidades transversales (los 3 planes, los 3 roles)

`perfil`, `configuracion`, `mensajes`, `calendario`, `dashboard`, `basic_analytics`.

Autenticación y cierre de sesión son globales (fuera de la matriz).

## 4. Matriz por rol

### Súper Profesor

| Feature | BASIC | PREMIUM | PRO |
|---|---|---|---|
| dashboard institucional | ✅ | ✅ | ✅ |
| gestion_profesores / gestion_estudiantes / gestion_grupos | ✅ | ✅ | ✅ |
| licencia | ✅ | ✅ | ✅ |
| basic_analytics (estadísticas básicas) | ✅ | ✅ | ✅ |
| reportes (básicos) | ✅ | ✅ | ✅ |
| neurobots (básicos) | ✅ | ✅ | ✅ |
| advanced_analytics (analítica institucional) | ❌ | ✅ | ✅ |
| neurobots_advanced | ❌ | ✅ | ✅ |
| neuroalertas | ❌ | ✅ | ✅ |
| risk_indicators | ❌ | ✅ | ✅ |
| reportes_avanzados | ❌ | ✅ | ✅ |
| integrations (avanzadas) | ❌ | ✅ | ✅ |
| predictive_analytics | ❌ | ❌ | ✅ |
| automation | ❌ | ❌ | ✅ |
| groups_compare | ❌ | ❌ | ✅ |

### Profesor

| Feature | BASIC | PREMIUM | PRO |
|---|---|---|---|
| dashboard | ✅ | ✅ | ✅ |
| gestion_grupos (mis aulas) | ✅ | ✅ | ✅ |
| anuncios (tablero) | ✅ | ✅ | ✅ |
| evaluaciones / tareas / recursos | ✅ | ✅ | ✅ |
| basic_analytics (seguimiento básico) | ✅ | ✅ | ✅ |
| reportes (básicos) | ✅ | ✅ | ✅ |
| neurobots (básicos) | ✅ | ✅ | ✅ |
| teacher_ai (IA adaptativa / generativa) | ❌ | ✅ | ✅ |
| neurobots_advanced | ❌ | ✅ | ✅ |
| neuroalertas | ❌ | ✅ | ✅ |
| neurodigital | ❌ | ✅ | ✅ |
| risk_indicators | ❌ | ✅ | ✅ |
| advanced_analytics | ❌ | ✅ | ✅ |
| reportes_avanzados | ❌ | ✅ | ✅ |
| integrations (Google Drive/Calendar) | ❌ | ✅ | ✅ |
| automation | ❌ | ❌ | ✅ |
| predictive_analytics | ❌ | ❌ | ✅ |
| groups_compare | ❌ | ❌ | ✅ |

### Estudiante

| Feature | BASIC | PREMIUM | PRO |
|---|---|---|---|
| dashboard / competencias | ✅ | ✅ | ✅ |
| tutor_ia (chat de aprendizaje básico) | ✅ | ✅ | ✅ |
| tareas / evaluaciones / recursos | ✅ | ✅ | ✅ |
| basic_analytics (seguimiento básico) | ✅ | ✅ | ✅ |
| tutor_ia_adaptive (chat IA adaptativa) | ❌ | ✅ | ✅ |
| chat_history | ❌ | ✅ | ✅ |
| recommendations | ❌ | ✅ | ✅ |
| adaptive_feedback | ❌ | ✅ | ✅ |
| difficulty_detection | ❌ | ✅ | ✅ |
| skill_tracking | ❌ | ✅ | ✅ |
| neurodigital | ❌ | ✅ | ✅ |
| learning_analytics (análisis avanzado del aprendizaje) | ❌ | ✅ | ✅ |
| tutor_ia_advanced (IA avanzada) | ❌ | ❌ | ✅ |
| personalized_plans | ❌ | ❌ | ✅ |
| personal_analytics (analítica personal avanzada) | ❌ | ❌ | ✅ |
| personal_reports | ❌ | ❌ | ✅ |

## 5. Nombres de feature canónicos

`dashboard`, `basic_analytics`, `advanced_analytics`, `predictive_analytics`,
`groups_compare`, `neurobots`, `neurobots_advanced`, `neuroalertas`,
`neurodigital`, `risk_indicators`, `reportes`, `reportes_avanzados`,
`tutor_ia`, `tutor_ia_adaptive`, `tutor_ia_advanced`, `chat_history`,
`recommendations`, `adaptive_feedback`, `difficulty_detection`,
`skill_tracking`, `personal_reports`, `teacher_ai`, `automation`,
`integrations`, `personalized_plans`, `learning_analytics`, `personal_analytics`,
`perfil`, `configuracion`, `mensajes`,
`calendario`, `recursos`, `evaluaciones`, `tareas`, `anuncios`, `licencia`,
`gestion_profesores`, `gestion_estudiantes`, `gestion_grupos`.

## 6. Cómo se aplica

- **Backend:** `require_feature("neuroalertas")` (FastAPI dependency) protege los
  endpoints Premium/Pro; `has_feature(role, plan, feature)` para lógica interna.
- **Frontend:** `useLicense().hasFeature("neuroalertas")` (un solo helper
  centralizado) y `<ProtectedFeature feature="..." />` para envolver bloques UI.
- **Respuesta de `/api/v1/license/my-license`:** incluye `role`, `features` y
  `super_modules`, de modo que frontend y backend usan exactamente la misma lista.