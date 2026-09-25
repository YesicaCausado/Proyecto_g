# 🗺️ PLAN.md — Roadmap de Trabajo NeuroLearn AI

> **Proyecto de Grado 2026** | PWA (Progressive Web App) | Colombia — Saber 11 ICFES  
> **Última actualización:** Auditoría técnica integral #4 — 22 Sep 2026  
> **Estado general del proyecto:** ~80% funcionalidad MVP construida; ~70% avance global ponderado (faltan RAG, pruebas E2E, despliegue y docs de entrega)  
> **Fuente:** Diccionario EDT + Requisitos Funcionales y No Funcionales v3  
> **⚠️ AVISO DE AUDITORÍA:** Este PLAN refleja el estado REAL verificado directamente sobre el código (backend, frontend, migraciones, config, DBs). El backend está muy completo; gran parte del frontend ya está conectado al backend real. **Los bloqueantes de integración (endpoints de bots, admin, reportes, licencia, PWA, fallback local) ya están RESUELTOS en código.** El único bloqueante funcional real que queda es la **capa RAG** (carga de documentos + embeddings). Lee la **"SECCIÓN 7 — AUDITORÍA TÉCNICA Y BACKLOG PRIORIZADO"** para el detalle de lo pendiente.

---

## 📍 Estado actual (reconciliación PLAN ↔ EDT)

> Resumen ejecutivo del punto en que va el proyecto, obtenido cruzando los 97 paquetes de la EDT (`docs/diccionario_edt_neurolearn.md`) con el estado verificado en código de este PLAN.

### ¿En qué punto vamos?

- **Núcleo del producto (backend + IA + auth + licencias):** ✅ **construido y robusto**. FastAPI, motor neuroconductual (fusión bayesiana multimodal), cadena IA Groq→Gemini→fallback local, JWT, roles y licencias centralizadas en `license_service.py`.
- **Frontend:** ✅ **muy conectado** al backend real (paneles de los 4 roles, chat con 5 patrones, dashboards). Quedan varios endpoints desalineados que impiden ver 100% la funcionalidad ya existente.
- **PWA:** ✅ **resuelta** (service worker propio, offline, instalable) — antes era el hueco crítico.
- **Lo que falta está concentrado en:** 🔴 integración pendiente (bots/RAG/reportes), 🟠 RAG de documentos, 🟡 pruebas funcionales/rendimiento/compatibilidad, 🟢 despliegue en producción y documentación de entrega.

### Avance por fase (ponderado para MVP)

| Fase EDT | Estado | Observación principal |
|---|---|---|
| 1. Gestión del proyecto | ✅ ~90% | Falta mantenimiento post-lanzamiento y validación formal de alcance |
| 2. Diseño / arquitectura | ✅ ~95% | Pendiente RBAC fino e índices de BD |
| 3. Implementación (plataforma) | ✅ ~90% | Quedan roles dinámicos, moderación de contenido, contenido específico por habilidad |
| 4. IA y personalización | 🟠 ~60% | **RAG + carga de documentos NO implementado**; streaming; privacidad formal |
| 5. Multiplataforma (PWA/híbrida) | 🟡 ~50% | PWA ✅; app híbrida (Capacitor) y optimización de rendimiento pendientes |
| 6. Calidad (pruebas/despliegue/entrega) | 🔴 ~15% | Pruebas funcionales/no-funcionales, despliegue Vercel y entrega formal pendientes |

### 🔴 Lo que realmente bloquea hoy (Prioridad 1)

> ✅ **RESUELTO EN CÓDIGO**: los bloqueantes históricos P1 (router de bots, endpoints admin, `teacher_reports.py`, `quiz_title`, `ProtectedFeature`, `/license/my-license`) **ya están corregidos** y verificados. ✔ Lo único pendiente es la **verificación E2E** de esos flujos desde la UI contra el backend desplegado.

1. ~~Router de bots desalineado~~ — ✅ alineado (`/api/v1/bots` único).
2. ~~Endpoints `/admin/bots`~~ — ✅ existen en `admin_bots.py`.
3. ~~`teacher_reports.py`~~ — ✅ usa campos reales de `QuizHistory`.
4. ~~Bug `quiz_title` duplicado~~ — ✅ una sola declaración en `learning.py:150`.
5. **RAG** (carga de documentos + embeddings + vector store) — 🔴 **único bloqueante funcional real que queda** → es la siguiente prioridad (P2).

> 👉 Ver detalle completo en **SECCIÓN 7 — AUDITORÍA TÉCNICA Y BACKLOG PRIORIZADO**.

---

## 1. Gestión y requisitos

### 1.1 Gestión del proyecto

#### 1.1.1 Planificación del alcance
- [x] 1.1.1.1 Definición del alcance MVP (autenticación, chat IA, bots, clases)
- [x] 1.1.1.2 Identificación de funcionalidades B2B2C (licencias institucionales)
- [x] 1.1.1.3 Definición de alcance PWA híbrido completo
- [x] 1.1.1.4 Priorización de requisitos según ICFES Saber 11

#### 1.1.2 Planificación del cronograma
- [x] 1.1.2.1 Cronograma de desarrollo inicial (README.md)
- [x] 1.1.2.2 Cronograma de pruebas y despliegue
- [ ] 1.1.2.3 Cronograma de mantenimiento post-lanzamiento

#### 1.1.3 Planificación de recursos
- [x] 1.1.3.1 Infraestructura backend (FastAPI, SQLite/PostgreSQL)
- [x] 1.1.3.2 Infraestructura frontend (React + TypeScript)
- [x] 1.1.3.3 Infraestructura de IA (Groq/Gemini providers) — *implementada: `ai/providers/groq_provider.py`, `gemini_provider.py`, `ai_manager.py`*
- [x] 1.1.3.4 Recursos para análisis facial/voz — *implementado con MediaStream API + Web Audio en `useFacialDetection.ts` y `useVoiceProsody.ts` (heurístico, sin WASM/ML externo)*

#### 1.1.4 Seguimiento y control
- [ ] 1.1.4.1 Métricas de progreso del proyecto
- [ ] 1.1.4.2 Revisiones de código y quality assurance
- [x] 1.1.4.3 Documentación de cambios (CAMBIOS_REALIZADOS.md)

---

### 

#### 1.2.1 Requisitos funcionales

##### 📋 Actor: Súper Profesor
- [x] 1.2.1.1 Inicio y cierre de sesión con credenciales institucionales
- [x] 1.2.1.2 Gestión de docentes (CRUD)
- [x] 1.2.1.3 Gestión de cupos de estudiantes
- [x] 1.2.1.4 Carga masiva de usuarios (CSV) — *`POST /super/teachers|students/bulk` + `/preview` (valida antes de crear, flujo «revisar→confirmar» en `UsersTabs.tsx`)*
- [x] 1.2.1.5 Dashboard institucional con métricas académicas y administrativas
- [x] 1.2.1.6 Mostrar módulos habilitados según licencia institucional — *`SuperDashboard` bloquea/oculta pestañas según `license.super_modules` y `LicenciaTab` muestra módulos del plan*
- [x] 1.2.1.7 Mostrar tipo de licencia activa y estado
- [x] 1.2.1.8 Mostrar límites de licencia (cupos docentes y estudiantes)
- [x] 1.2.1.9 Mostrar consumo actual de cupos disponibles
- [x] 1.2.1.10 Indicar funcionalidades no disponibles por licencia — *`SuperDashboard`: módulos bloqueados con candado + `aria-disabled` sin `disabled` nativo para que el clic muestre el aviso «Módulo no disponible en tu licencia»*
- [x] 1.2.1.11 Restringir acceso a módulos no correspondientes a licencia

##### 👨‍🏫 Actor: Profesor
- [x] 1.2.1.12 Inicio de sesión seguro
- [x] 1.2.1.13 Cambio de contraseña temporal en primer acceso
- [x] 1.2.1.14 Crear y gestionar aulas o grupos
- [x] 1.2.1.15 Generar códigos de invitación para clases
- [x] 1.2.1.16 Crear bots expertos de tutoría
- [ ] 1.2.1.17 Cargar documentos de conocimiento para bots
- [x] 1.2.1.18 Configurar bots públicos o privados
- [x] 1.2.1.19 Asignar bots a clases específicas
- [x] 1.2.1.20 Visualizar estudiantes inscritos
- [x] 1.2.1.21 Generar neuro-alertas sobre fatiga, frustración o riesgo académico
- [x] 1.2.1.22 Visualizar estadísticas y reportes académicos
- [x] 1.2.1.23 Exportar reportes en formatos PDF o CSV — *backend `GET /teacher/reports/export` (corregido, usa campos reales de `QuizHistory`; CSV siempre, PDF requiere `reportlab`) + exportación PDF/CSV en el panel del Súper (`ReportesTab`)*
- [x] 1.2.1.24 Compartir bots educativos
- [ ] 1.2.1.25 Mostrar módulos habilitados según licencia institucional
- [x] 1.2.1.26 Restringir acceso a funcionalidades de planes superiores

##### 🎓 Actor: Estudiante
- [x] 1.2.1.27 Registro e inicio de sesión
- [x] 1.2.1.28 Cambio de contraseña temporal en primer acceso
- [x] 1.2.1.29 Recuperación de contraseña por correo electrónico — *`/auth/forgot-password`, `/auth/reset-password/validate`, `/auth/reset-password` + `ForgotPasswordPage`/`ResetPasswordPage`*
- [x] 1.2.1.30 Editar información básica del perfil
- [x] 1.2.1.31 Unirse a clases mediante códigos de invitación
- [x] 1.2.1.32 Mostrar habilidades transversales disponibles
- [x] 1.2.1.33 Seleccionar habilidades para iniciar aprendizaje
- [x1.2 Requisitos] 1.2.1.34 Mostrar bots de tutoría disponibles
- [x] 1.2.1.35 Iniciar sesiones de aprendizaje con tutor IA
- [x] 1.2.1.36 Realizar diagnósticos iniciales de nivel académico
- [x] 1.2.1.37 Interacción con tutor IA mediante chat
- [x] 1.2.1.38 Generar explicaciones adaptadas al nivel del estudiante
- [x] 1.2.1.39 Realizar evaluaciones automáticas — *`/chat/generate-quiz` + `QuizPanel`/`QuizzesPage`, sugerencia de quiz adaptativa*
- [x] 1.2.1.40 Proporcionar retroalimentación inmediata — *`QuizzesPage`/`QuizPanel` marcan correcta/incorrecta y muestran explicación*
- [x] 1.2.1.41 Reforzar temas donde existan debilidades — *`/chat/generate-quiz` refuerza `weak_concepts` y `chat.py` adapta el prompt sobre conceptos débiles*
- [x] 1.2.1.42 Solicitar ejemplos, evaluaciones y resúmenes
- [x] 1.2.1.43 Mostrar estado cognitivo del estudiante en tiempo real
- [x] 1.2.1.44 Mostrar dashboards de progreso académico
- [x] 1.2.1.45 Almacenar historial de sesiones y conversaciones
- [x] 1.2.1.46 Mostrar fortalezas y debilidades del estudiante
- [x] 1.2.1.47 Registrar y mostrar rachas de aprendizaje — *se calculan en `/stats/performance` (`streak_days` + logros) y en notificaciones; ⚠️ el componente `ProgressRacha.tsx` llama a `/student/racha/{id}` que **no existe** (endpoint muerto)*
- [ ] 1.2.1.48 Mostrar funcionalidades habilitadas por licencia
- [ ] 1.2.1.49 Restringir acceso a funcionalidades no incluidas en licencia
- [ ] 1.2.1.50 Adaptar opciones del dashboard según nivel de licencia

##### 🤖 Actor: Sistema IA
- [x] 1.2.1.51 Capturar métricas de dinámica de teclado
- [x] 1.2.1.52 Analizar señales visuales y sonoras (con autorización) — *`useFacialDetection.ts` + `useVoiceProsody.ts` (procesamiento local, solo metadatos al backend)*
- [x] 1.2.1.53 Realizar fusión multimodal de datos conductuales
- [x] 1.2.1.54 Inferir estados cognitivos del estudiante
- [x] 1.2.1.55 Ajustar automáticamente la dificultad pedagógica
- [x] 1.2.1.56 Predecir posibles errores del estudiante — *Patrón 5 en `chat.py`: inyecta `quiz_error_rate` y `error_risk` al prompt*
- [x] 1.2.1.57 Tomar decisiones pedagógicas automáticas
- [x] 1.2.1.58 Realizar enseñanza secuencial adaptativa
- [x] 1.2.1.59 Generar evaluaciones automáticas posteriores a enseñanza — *quizzes adaptativos posteriores a la enseñanza (`/chat/generate-quiz`, `QUIZ_SUGERIDO`)*
- [x] 1.2.1.60 Reforzar automáticamente conceptos no comprendidos
- [x] 1.2.1.61 Detectar estados de fatiga o frustración
- [x] 1.2.1.62 Adaptar respuestas según nivel del estudiante
- [x] 1.2.1.63 Utilizar APIs externas de IA con mecanismos de fallback — *cadena Groq→Gemini funcional en `ai_manager.py`*
- [x] 1.2.1.64 Registrar eventos cognitivos e interacciones
- [x] 1.2.1.65 Actualizar perfil cognitivo del estudiante
- [x] 1.2.1.66 Generar recomendaciones pedagógicas para profesores
- [x] 1.2.1.67 Permitir cambios en perfil y configuración — *`PATCH /auth/me` (nombre/email/foto) + `PATCH /auth/change-password` + `PATCH /admin/config` (sistema)*

##### 👤 Actor: Administrador
- [x] 1.2.1.68 Gestión de usuarios registrados — *`/admin/users` CRUD + `UserManagement.tsx`*
- [x] 1.2.1.69 Activar o desactivar cuentas — *`PATCH /admin/users/{id}` (is_active) + validación en `get_current_user`*
- [x] 1.2.1.70 Asignar roles de usuario — *`PATCH /admin/users/{id}` (role)*
- [x] 1.2.1.71 Moderar bots públicos — *`GET/PATCH /admin/bots` + `BotManagement.tsx`*
- [x] 1.2.1.72 Administrar bots pre-entrenados — *`GET /admin/bots/pretrained` (data/trained_bots)*
- [x] 1.2.1.73 Mostrar estadísticas globales de la plataforma — *`GET /admin/stats`*
- [x] 1.2.1.74 Monitorear estado general del sistema — *`GET /admin/config` + `/health`*
- [x] 1.2.1.75 Mostrar auditoría general — *`GET /admin/audit-logs` + `AuditLogs.tsx` (modelo `AuditLog`)*
- [x] 1.2.1.76 Consultar configuración de planes (Basic, Premium, Pro) — *`GET /admin/config` expone `license_limits`*
- [x] 1.2.1.77 Aplicar configuraciones de licencias automáticamente — *`PATCH /admin/institutions/{id}/license` + `PATCH /admin/config`*

#### 1.2.2 Requisitos no funcionales

- [x] 1.2.2.1 Privacidad y protección de datos personales según Ley Habeas Data
- [x] 1.2.2.2 NO almacenar videos, audios o imágenes en bruto de menores de edad
- [x] 1.2.2.3 Procesar datos biométricos localmente en el dispositivo
- [x] 1.2.2.4 Funcionar como Progressive Web App (PWA)
- [x] 1.2.2.5 Ser responsive y compatible con móviles, tablets y computadores
- [ ] 1.2.2.6 Responder en menos de 2.5 segundos en condiciones normales
- [x] 1.2.2.7 Implementar arquitectura multi-tenant para separar instituciones
- [ ] 1.2.2.8 Garantizar alta disponibilidad y tolerancia a fallos
- [x] 1.2.2.9 Almacenar contraseñas con cifrado hash seguro
- [x] 1.2.2.10 Backend desarrollado en FastAPI y Python
- [x] 1.2.2.11 Frontend desarrollado en React, TypeScript y Vite
- [x] 1.2.2.12 Garantizar seguridad e integridad de la información
- [x] 1.2.2.13 Mantener trazabilidad y persistencia de datos académicos
- [x] 1.2.2.14 Integrarse con servicios externos de inteligencia artificial

#### 1.2.3 Requisitos por usuario
- [x] 1.2.3.1 Estudiante: autenticación, chat, progreso básico
- [x] 1.2.3.2 Profesor: gestión de clases, creación de bots
- [x] 1.2.3.3 Súper Profesor: gestión institucional
- [x] 1.2.3.4 Admin: gestión completa de usuarios

#### 1.2.4 Requisitos por licencia
- [x] 1.2.4.1 Licencia Básica (implementada: institution.license_type)
- [x] 1.2.4.2 Licencia Premium (control de funcionalidades) — *módulos/cupos en `license_service.py`*
- [x] 1.2.4.3 Licencia Pro (funcionalidades avanzadas) — *módulos Pro e integraciones/automatizaciones*
- [x] 1.2.4.4 Restricciones por licencia (endpoint de license.py) — *`/license/my-license`, `/info`, `/check-feature` + deps `require_teacher_module`/`require_student_module`/`require_chat_access`*

---

### 1.3 Validación

#### 1.3.1 Validación del alcance
- [ ] 1.3.1.1 Alineación con EDT original
- [ ] 1.3.1.2 Compatibilidad con REQUISITOS_FUNCIONALES.md
- [ ] 1.3.1.3 Validación de casos de uso críticos

#### 1.3.2 Validación de requisitos
- [x] 1.3.2.1 RF-ES-001, RF-ES-002: Autenticación ✅
- [x] 1.3.2.2 RF-IA-001 a RF-IA-007: Motor neuroconductual ✅
- [x] 1.3.2.3 RF-PR-020 a RF-PR-029: Creación de bots ✅
- [x] 1.3.2.4 RF-PR-010 a RF-PR-015: Gestión de clases ✅
- [x] 1.3.2.5 RF-ES-040 a RF-ES-044: Dashboards ✅

#### 1.3.3 Criterios de aceptación
- [x] 1.3.3.1 Pruebas de login/registro exitosas — *`tests/test_security.py` + `test_e2e_sprint3.py`*
- [x] 1.3.3.2 Chat funcional con 5 habilidades — *5 patrones + dictamen Saber 11*
- [x] 1.3.3.3 Bots entrenables y asignables — *`expert_bot.py` + `trainer.py` + asignación a clases*
- [x] 1.3.3.4 Dashboard visible y útil
- [x] 1.3.3.5 PWA instalable y responsive — *responsive ✅ + service worker/offline/instalación ✅ (riesgo 10 resuelto)*

---

## 2. Diseño y arquitectura

### 2.1 Análisis del sistema

#### 2.1.1 Identificación de actores
- [x] 2.1.1.1 Estudiante (modelo User, role=ESTUDIANTE)
- [x] 2.1.1.2 Profesor (modelo User, role=PROFESOR)
- [x] 2.1.1.3 Súper Profesor (modelo User, role=SUPER_PROFESOR)
- [x] 2.1.1.4 Admin (modelo User, role=ADMIN)

#### 2.1.2 Casos de uso
- [x] 2.1.2.1 Registro e inicio de sesión
- [x] 2.1.2.2 Creación de bot experto
- [x] 2.1.2.3 Chat con tutor IA
- [x] 2.1.2.4 Gestión de clases — *crear/inscribir/asignar bots/estadísticas (parcial: pendiente asignar bots desde UI docente)*
- [x] 2.1.2.5 Dashboard de progreso

#### 2.1.3 Reglas de negocio
- [x] 2.1.3.1 Fusión bayesiana multimodal (ai/cognitive/)
- [x] 2.1.3.2 Adaptación de dificultad automática
- [x] 2.1.3.3 Restricciones por licencia — *enforced en backend vía deps de `license_service.py`*
- [x] 2.1.3.4 Control de cupos institucionales — *grupos/neurobots/estudiantes/config en `license_service.py` + cupos de clase*

#### 2.1.4 Roles y permisos
- [x] 2.1.4.1 Permisos por rol (UserRole enum)
- [x] 2.1.4.2 Protección de endpoints (middleware básico)
- [ ] 2.1.4.3 RBAC completo por institución
- [ ] 2.1.4.4 Jerarquía de permisos

---

### 2.2 Diseño UX/UI

#### 2.2.1 Panel Súper Profesor
- [x] 2.2.1.1 Dashboard institucional — *UI conectada: `pages/super/SuperDashboard.tsx` + componentes, consumen `super_stats.py`* 
- [x] 2.2.1.2 Gestión de usuarios — *UI en `super/components/UsersTabs.tsx`, conectada a `credentials.py` y `admin_users.py`*
- [x] 2.2.1.3 Métricas globales — *`super_stats.py` calcula métricas reales desde DB; UI en `DashboardGeneral.tsx`*
- [x] 2.2.1.4 Control de licencias — *UI en `super/components/LicenciaTab.tsx`*

#### 2.2.2 Panel Profesor
- [x] 2.2.2.1 Dashboard de clase — *`teacher/components/DashboardTab.tsx` conectado a `teacher_stats.py`*
- [x] 2.2.2.2 Alertas de estudiantes en riesgo — *`teacher/components/NeuroAlertasTab.tsx`*
- [x] 2.2.2.3 Reportes por habilidad — *«✅» `teacher_reports.py` corregido (usa campos reales de `QuizHistory`); export CSV/PDF (PDF requiere `reportlab`, ausente del `requirements.txt` de despliegue)*
- [x] 2.2.2.4 Creación de bots — *`teacher/components/NeuroBotsTab.tsx` (⚠️ endpooints de bots desalineados — ver P1-2)*
- [x] 2.2.2.5 Asignación de bots a clases — *integrado en `classroom.py` + UI*

#### 2.2.3 Panel Estudiante
- [x] 2.2.3.1 Chat con tutor (ChatPage.tsx) — *conectado a `/chat/message` real + 5 patrones*
- [x] 2.2.3.2 Dashboard de progreso (DesempenoPage.tsx) — *conectado a `stats.py`*
- [x] 2.2.3.3 Visualización de estados cognitivos — *`CognitiveDashboard.tsx`*
- [x] 2.2.3.4 Historial de sesiones — *accesible vía API*
- [x] 2.2.3.5 Fortalezas y debilidades — *en DesempenoPage y stats*

#### 2.2.4 Panel Admin
- [x] 2.2.4.1 Gestión de usuarios — *`admin/UserManagement.tsx` conectado a `admin_users.py`*
- [x] 2.2.4.2 Moderación de bots públicos — *endpoints `/admin/bots` `+` `/pretrained` + `BotManagement.tsx` (ver P1-3 ✅)*
- [x] 2.2.4.3 Configuración de plataforma — *`admin/SystemConfig.tsx` + `admin_users.py` /config*

#### 2.2.5 Diseño responsive
- [x] 2.2.5.1 Layout responsive (Tailwind CSS)
- [x] 2.2.5.2 Adaptación móvil completa — *headers móviles + sidebars overlay + bottom nav en `Layout.tsx`, `TeacherPanel.tsx`, `AdminDashboard.tsx`, `SuperDashboard.tsx`; breakpoints `sm/md/lg/xl` en todas las grillas y tablas (`overflow-x-auto`)*
- [x] 2.2.5.3 Optimización para tablets — *breakpoints `md/lg` adaptan grillas KPI y layout de 2-3 columnas en paneles*

---

### 2.3 Arquitectura tecnológica

#### 2.3.1 Frontend
- [x] 2.3.1.1 React 18 + TypeScript
- [x] 2.3.1.2 Vite + Tailwind CSS
- [x] 2.3.1.3 Service Workers (PWA) — *`public/sw.js` (network-first para navegación, cache-first para assets versionados, offline page) + registro en `main.tsx`*
- [x] 2.3.1.4 Optimización de bundles — *`manualChunks` en `vite.config.ts` + lazy loading por ruta en `App.tsx`*

#### 2.3.2 Backend
- [x] 2.3.2.1 FastAPI + Uvicorn
- [x] 2.3.2.2 SQLAlchemy ORM
- [x] 2.3.2.3 JWT autenticación (python-jose)
- [x] 2.3.2.4 Optimización de endpoints — *counts agrupados en `/classrooms/my-classes`, consultas batch anti-N+1 en `messages.py`*

#### 2.3.3 Arquitectura de IA
- [x] 2.3.3.1 Motor neuroconductual (ai/cognitive/neuroconductual_engine.py) — *fusión bayesiana multimodal real con 5 analizadores y baselines científicos*
- [x] 2.3.3.2 Integración Groq/Llama — *`groq_provider.py` realiza llamadas HTTP reales*
- [x] 2.3.3.3 Fallback a Gemini — *`ai_manager.py` implementa cadena Groq→Gemini funcional*
- [x] 2.3.3.4 Fallback local (templates) — *`ai_manager.generate()` devuelve template local (nunca `None`) cuando Groq/Gemini fallan; `chat.py` ya no devuelve 503 sino que degrada a respuesta local*

#### 2.3.4 Arquitectura PWA/híbrida
- [x] 2.3.4.1 Manifest.json — *`public/manifest.json` + `index.html` lo referencia*
- [x] 2.3.4.2 Service Worker — *`public/sw.js` (caché por versiones, precache del shell, limpieza en `activate`)*
- [x] 2.3.4.3 Instalación PWA — *`beforeinstallprompt` capturado en `main.tsx` + `window.__pwaInstallPrompt` + iconos PNG (192/512) existentes*
- [x] 2.3.4.4 Offline support — *fallback a página offline cuando no hay red y el shell no está cacheado*

---

### 2.4 Base de datos

#### 2.4.1 Modelo de datos
- [x] 2.4.1.1 Tablas principales (users, learning_sessions, expert_bots, classrooms)
- [ ] 2.4.1.2 Índices optimizados
- [x] 2.4.1.3 Migraciones automáticas — *`app/db/migrate.py` + `base.create_all` ejecutados en `main.py` ; `migrations/applied/*.sql`*

#### 2.4.2 Modelo de usuarios e instituciones
- [x] 2.4.2.1 Tabla institutions (Institution model)
- [x] 2.4.2.2 Relación User ↔ Institution
- [x] 2.4.2.3 Roles y perfiles cognitivos
- [x] 2.4.2.4 Historial de cambios (audit_log) — *modelo `AuditLog` + `GET /admin/audit-logs` + `GET /super/audit`*

#### 2.4.3 Licencias y permisos
- [x] 2.4.3.1 Campo license_type en Institution
- [x] 2.4.3.2 Control de funcionalidades por licencia — *módulos por plan/rol en `license_service.py`*
- [x] 2.4.3.3 Validación de cupos — *límites de grupos/neurobots/estudiantes + `max_students` de clase*

#### 2.4.4 Datos académicos y sesiones
- [x] 2.4.4.1 Tabla learning_sessions
- [x] 2.4.4.2 Tabla cognitive_events
- [x] 2.4.4.3 Historial de chat — *cada mensaje se persiste en `chat_messages` (`ChatMessage`)*
- [x] 2.4.4.4 Quiz history — *tabla `quiz_history` + relación + gestión de quizzes*

---

## 3. Plataforma de gestión académica

### 3.1 Autenticación y usuarios

#### 3.1.1 Registro e inicio de sesión
- [x] 3.1.1.1 Registro de usuarios (auth.py - register endpoint)
- [x] 3.1.1.2 Inicio de sesión (auth.py - login endpoint)
- [x] 3.1.1.3 Demo users automáticos (_ensure_demo_user)
- [x] 3.1.1.4 Validación de credenciales institucionales — *login real bcrypt contra Supabase/Postgres + registro restringido a admin/super_profesor (sin registro público)*

#### 3.1.2 Gestión de perfiles
- [x] 3.1.2.1 Perfiles en User model (cognitive_profile JSON)
- [x] 3.1.2.2 Editar perfil — *`PATCH /auth/me` (nombre/email/foto válida)*
- [x] 3.1.2.3 Actualización de perfil cognitivo — *`cognitive_profile` se actualiza con el desempeño/estado*

#### 3.1.3 Roles y permisos
- [x] 3.1.3.1 UserRole enum (ESTUDIANTE, PROFESOR, SUPER_PROFESOR, ADMIN)
- [x] 3.1.3.2 Middleware/controles de permisos completo — *deps por rol (`require_teacher`/`_require_admin`/licencia) + endpoints protegidos*
- [ ] 3.1.3.3 Roles dinámicos

#### 3.1.4 Recuperación de contraseña
- [x] 3.1.4.1 Endpoint de recuperación (RF-ES-005) — *`POST /auth/forgot-password` + `POST /auth/reset-password` + `GET /auth/reset-password/validate`*
- [x] 3.1.4.2 PasswordResetToken model existente — *`app/models/password_reset.py`*
- [x] 3.1.4.3 Flujo de reset completo — *`ForgotPasswordPage`/`ResetPasswordPage` + tokens con expiración*

---

### 3.2 Gestión institucional

#### 3.2.1 Gestión de profesores
- [x] 3.2.1.1 Creación de profesores (demo)
- [x] 3.2.1.2 Asignación a institución (_ensure_demo_institution)
- [x] 3.2.1.3 CRUD completo de profesores — *`/super/teachers` CRUD + bulk/preview* 
- [x] 3.2.1.4 Cambio de rol de estudiante a profesor — *`PATCH /admin/users/{id}` (role)*

#### 3.2.2 Gestión de estudiantes
- [x] 3.2.2.1 Registro de estudiantes (demo)
- [x] 3.2.2.2 Carga masiva (CSV) — *`/super/*/preview` → `/bulk` + envío de credenciales por email*
- [x] 3.2.2.3 Validación de cupos

#### 3.2.3 Gestión de grupos
- [x] 3.2.3.1 Creación de clases — *`api/classroom.py` + `CreateClassroomPage.tsx`*
- [x] 3.2.3.2 Generación de códigos de invitación — *`Classroom.generate_invite_code()` + `/classrooms/join`*
- [x] 3.2.3.3 Listado de estudiantes por clase — *`GET /classrooms/{id}/students`*

#### 3.2.4 Gestión de clases
- [x] 3.2.4.1 Modelo Classroom existe
- [x] 3.2.4.2 API endpoints completos — *CRUD de clases, inscripción, asignación de bots, stats y alertas*
- [x] 3.2.4.3 Vinculación estudiantes ↔ clases — *`Enrollment` + join/remove*

---

### 3.3 Paneles

#### 3.3.1 Panel Súper Profesor
- [x] 3.3.1.1 Dashboard — *`super_stats.py` + `DashboardGeneral.tsx`*
- [x] 3.3.1.2 Métricas institucionales — *KPIs reales, ranking, riesgo, áreas*
- [x] 3.3.1.3 Control de licencias — *`LicenciaTab.tsx` + `/super/license-usage`*

#### 3.3.2 Panel Profesor
- [x] 3.3.2.1 Dashboard — *`teacher_stats.py` + `DashboardTab.tsx`*
- [x] 3.3.2.2 Alertas de estudiantes en riesgo — *`NeuroAlertasTab.tsx` + `GET /classrooms/{id}/alerts`*
- [x] 3.3.2.3 Reportes por habilidad — *API corregida + export PDF/CSV en Súper*

#### 3.3.3 Panel Estudiante
- [x] 3.3.3.1 ChatPage (ChatPage.tsx)
- [x] 3.3.3.2 DesempenoPage — *conectado a `/stats/performance`*
- [x] 3.3.3.3 StudentDashboard completo — *bots, clases, `/stats/dashboard`, `/stats/performance`*
- [x] 3.3.3.4 Historial de sesiones — *`/chat/stats`, `cognitive_session_state`, patrón history*

#### 3.3.4 Panel Admin
- [x] 3.3.4.1 Gestión de usuarios — *`admin_users.py` + `UserManagement.tsx`*
- [ ] 3.3.4.2 Moderación de contenido

#### 3.3.5 Dashboards
- [x] 3.3.5.1 Visualización de estados cognitivos — *`CognitiveDashboard.tsx`*
- [x] 3.3.5.2 Gauges y métricas visuales — *dashboards con KPIs/gráficos*
- [ ] 3.3.5.3 Mapas de calor

---

### 3.4 Licenciamiento

#### 3.4.1 Licencia Basic
- [x] 3.4.1.1 Implementación básica (institution.license_type)
- [x] 3.4.1.2 Validación en endpoints — *deps `require_*_module`/`require_active_license`/`require_chat_access`*

#### 3.4.2 Licencia Premium
- [x] 3.4.2.1 Control de funcionalidades Premium — *módulos/IA/export/neurobots en `license_service.py`*
- [x] 3.4.2.2 Restricciones de uso

#### 3.4.3 Licencia Pro
- [x] 3.4.3.1 Funcionalidades avanzadas Pro — *integraciones y automatizaciones (Google, webhooks)*
- [ ] 3.4.3.2 Soporte prioritario

#### 3.4.4 Control de funcionalidades según licencia
- [x] 3.4.4.1 Validación de licencia en endpoints — *`app/services/license_service.py`*
- [x] 3.4.4.2 Endpoint de licencias — *`api/license.py`: `/my-license`, `/info`, `/check-feature`*
- [x] 3.4.4.3 Actualización de licencias — *`PATCH /admin/institutions/{id}/license`*

---

### 3.5 Habilidades académicas

#### 3.5.1 Pensamiento lógico-matemático
- [x] 3.5.1.1 Bot pre-entrenado (data/trained_bots/)
- [ ] 3.5.1.2 Contenido específico

#### 3.5.2 Lectura crítica
- [x] 3.5.2.1 Bot pre-entrenado
- [ ] 3.5.2.2 Contenido específico

#### 3.5.3 Inglés comunicativo
- [x] 3.5.3.1 Bot pre-entrenado
- [ ] 3.5.3.2 Contenido específico

#### 3.5.4 Competencias ciudadanas
- [x] 3.5.4.1 Bot pre-entrenado
- [ ] 3.5.4.2 Contenido específico

#### 3.5.5 Pensamiento científico
- [x] 3.5.5.1 Bot pre-entrenado
- [ ] 3.5.5.2 Contenido específico

---

## 4. Inteligencia Artificial y personalización

### 4.1 NeuroChat Tutor

#### 4.1.1 Interfaz conversacional
- [x] 4.1.1.1 ChatPage.tsx
- [ ] 4.1.1.2 Streaming de respuestas
- [ ] 4.1.1.3 Historial de chat

#### 4.1.2 Procesamiento de consultas
- [x] 4.1.2.1 API chat endpoint (api/chat.py)
- [x] 4.1.2.2 Selección de bot
- [ ] 4.1.2.3 Filtro por contexto

#### 4.1.3 Generación de respuestas
- [x] 4.1.3.1 Integración Groq — *`api/chat.py` usa `AIManager` con Groq real*
- [x] 4.1.3.2 Fallback Gemini — *funcional en `ai_manager.py`*
- [x] 4.1.3.3 Templates locales — *`ai_manager._generate_local_response()` (tutor + quiz JSON de diagnóstico); usados como último eslabón de la cadena Groq→Gemini→Local*

#### 4.1.4 Tutoría personalizada
- [x] 4.1.4.1 Decisión pedagógica (ai/chatbot/adaptive_chatbot.py)
- [ ] 4.1.4.2 Adaptación automática de dificultad
- [ ] 4.1.4.3 Refuerzo de debilidades

---

### 4.2 NeuroBots

#### 4.2.1 Creación de NeuroBots
- [x] 4.2.1.1 API expert_bot.py (CRUD)
- [x] 4.2.1.2 Trainer (ai/expert_bot/trainer.py)
- [ ] 4.2.1.3 UI de creación (pendiente)

#### 4.2.2 Carga de documentos
- [ ] 4.2.2.1 Upload de PDF/TXT — *⏳ `teacher_materials.py` solo guarda **metadata** (nombre/tipo/tamaño); no sube binario ni procesa*
- [ ] 4.2.2.2 Preprocesamiento — *no implementado*
- [ ] 4.2.2.3 Almacenamiento — *parcial (solo metadata)*

#### 4.2.3 Base de conocimiento
- [ ] 4.2.3.1 FAQs y contenido curado
- [ ] 4.2.3.2 Escenarios prácticos
- [ ] 4.2.3.3 Tips y recomendaciones

#### 4.2.4 Sistema RAG
- [ ] 4.2.4.1 Vector search (pendiente)
- [ ] 4.2.4.2 Retrieval de contexto
- [ ] 4.2.4.3 Generación con RAG

---

### 4.3 Análisis neuroconductual

#### 4.3.1 Facial (microexpresiones)
- [x] 4.3.1.1 Acceso a cámara — *`useFacialDetection.ts`: MediaStream API*
- [x] 4.3.1.2 Procesamiento local — *canvas + análisis de luminancia/movimiento en el dispositivo* (sustituido por MediaPipe Face Landmarker)
- [x] 4.3.1.3 Detección de emociones — *ML real: MediaPipe Face Landmarker (478 landmarks + blendshapes ARKit) → gaze, valence/arousal, ceño, parpadeo, atención*
- [x] 4.3.1.4 Metadatos (atención_score, etc.) — *enviados al backend en `chat/message`*

#### 4.3.2 Voz (prosodia, ritmo, pausas)
- [x] 4.3.2.1 Acceso a micrófono — *`useVoiceProsody.ts`: Web Audio API*
- [x] 4.3.2.2 Análisis prosódico — *F0, volumen, tasa de habla, tremor (heurístico)*
- [x] 4.3.2.3 Extracción de métricas — *enviadas al backend*

#### 4.3.3 Teclado (velocidad, pausas, errores)
- [x] 4.3.3.1 Captura de dinámica (RF-SY01) — *`useBehavioralMetrics.ts`*
- [x] 4.3.3.2 Cálculo de CPM — *real*
- [x] 4.3.3.3 Detección de backspaces — *real (corrections), + bursts y pausas*

#### 4.3.4 Interacción (clics, navegación)
- [x] 4.3.4.1 Eventos de clic — *parcial*
- [ ] 4.3.4.2 Patrones de navegación — *parcial*
- [ ] 4.3.4.3 Tiempo de inactividad — *parcial*

#### 4.3.5 Rendimiento (respuestas, tiempo, progreso)
- [x] 4.3.5.1 Métricas de sesión (learning_sessions)
- [x] 4.3.5.2 Cálculo de estado cognitivo — *motor bayesiano en `neuroconductual_engine.py`*
- [x] 4.3.5.3 Reportes acumulativos — *estado persistido en `cognitive_session_state`*

---

### 4.4 Privacidad y procesamiento

#### 4.4.1 Procesamiento local
- [ ] 4.4.1.1 WebAssembly para visión
- [ ] 4.4.1.2 Procesamiento de audio local
- [ ] 4.4.1.3 Envío solo metadatos

#### 4.4.2 Protección de información
- [ ] 4.4.2.1 Encriptación de datos sensibles
- [ ] 4.4.2.2 Anonimización
- [ ] 4.4.2.3 Cumplimiento Ley Habeas Data

#### 4.4.3 No almacenamiento de audio/video
- [x] 4.4.3.1 Política de no almacenamiento (RNF-01)
- [ ] 4.4.3.2 Implementación técnica
- [ ] 4.4.3.3 Validación de cumplimiento

#### 4.4.4 Almacenamiento de metadatos
- [x] 4.4.4.1 Tabla cognitive_events
- [ ] 4.4.4.2 Indexación eficiente
- [ ] 4.4.4.3 Consulta rápida

---

## 5. PWA y aplicación híbrida

### 5.1 Desarrollo PWA

#### 5.1.1 Manifest
- [x] 5.1.1.1 manifest.json — *existe en `public/manifest.json` y se referencia en `index.html`*
- [x] 5.1.1.2 Iconos — *`icon-192.png`/`icon-512.png` existentes y referenciados (riesgo 10 resuelto)*
- [x] 5.1.1.3 Nombre y descripción — *definidos en manifest.json*

#### 5.1.2 Service Worker
- [x] 5.1.2.1 sw.js — *`public/sw.js` propio (network-first navegación, cache-first assets, precache del shell)*
- [x] 5.1.2.2 Caché de recursos — *cache-first para assets versionados + limpieza en `activate`*
- [x] 5.1.2.3 Offline support — *fallback a página offline cuando no hay red y el shell no está cacheado*

#### 5.1.3 Instalación PWA
- [x] 5.1.3.1 Prompt de instalación — *`beforeinstallprompt` capturado en `main.tsx` + `window.__pwaInstallPrompt` (instalable)*
- [x] 5.1.3.2 Icono de instalación — *iconos PNG 192/512 válidos y referenciados*
- [x] 5.1.3.3 Home screen — *instalación PWA operativa en navegadores compatibles*

#### 5.1.4 Diseño responsive
- [x] 5.1.4.1 Tailwind breakpoints
- [ ] 5.1.4.2 Mobile-first approach
- [ ] 5.1.4.3 Adaptación completa

---

### 5.2 Aplicación híbrida

#### 5.2.1 Contenedor móvil
- [ ] 5.2.1.1 WebView wrapper
- [ ] 5.2.1.2 Capacitor/Cordova
- [ ] 5.2.1.3 Build para Android/iOS

#### 5.2.2 Integración con dispositivos
- [ ] 5.2.2.1 Permisos de cámara
- [ ] 5.2.2.2 Permisos de micrófono
- [ ] 5.2.2.3 Notificaciones push

#### 5.2.3 Cámara y micrófono
- [ ] 5.2.3.1 RequestPermission API
- [ ] 5.2.3.2 Stream de video
- [ ] 5.2.3.3 Stream de audio

#### 5.2.4 Permisos del dispositivo
- [ ] 5.2.4.1 RequestStorage
- [ ] 5.2.4.2 RequestLocation
- [ ] 5.2.4.3 RequestContacts

---

### 5.3 Backend y servicios

#### 5.3.1 API
- [x] 5.3.1.1 Endpoints REST (api/)
- [ ] 5.3.1.2 Optimización GraphQL
- [x] 5.3.1.3 Rate limiting — *`app/core/security.py`: rate limiter + account lockout en auth*

#### 5.3.2 Servicios de autenticación
- [x] 5.3.2.1 JWT tokens
- [ ] 5.3.2.2 Refresh tokens
- [ ] 5.3.2.3 OAuth (opcional)

#### 5.3.3 Servicios académicos
- [ ] 5.3.3.1 Servicio de clases
- [ ] 5.3.3.2 Servicio de bots
- [ ] 5.3.3.3 Servicio de sesiones

#### 5.3.4 Servicios de IA
- [x] 5.3.4.1 API Manager (ai/providers/) — *`ai_manager.py` orquesta Groq→Gemini→Local*
- [x] 5.3.4.2 Groq client — *`groq_provider.py` con llamadas HTTP reales*
- [x] 5.3.4.3 Gemini client — *`gemini_provider.py` integrado como fallback*
- [x] 5.3.4.4 Fallback local — *`_generate_local_response()` (tutor + quiz); `generate()` nunca retorna `None`*

---

### 5.4 Rendimiento

#### 5.4.1 Optimización frontend
- [x] 5.4.1.1 Code splitting — *`manualChunks` en `vite.config.ts`*
- [x] 5.4.1.2 Lazy loading — *lazy loading por ruta en `App.tsx`*
- [ ] 5.4.1.3 Memoización

#### 5.4.2 Optimización backend
- [ ] 5.4.2.1 Caching de respuestas
- [ ] 5.4.2.2 Background workers
- [ ] 5.4.2.3 Streaming responses

#### 5.4.3 Optimización de base de datos
- [ ] 5.4.3.1 Índices estratégicos
- [ ] 5.4.3.2 Query optimization
- [ ] 5.4.3.3 Paginación eficiente

#### 5.4.4 Optimización de respuesta de IA
- [ ] 5.4.4.1 Temperature ajustable
- [ ] 5.4.4.2 Max tokens limitados
- [ ] 5.4.4.3 Streaming enabled

---

## 6. Pruebas, despliegue y entrega

### 6.1 Pruebas

#### 6.1.1 Funcionales
- [ ] 6.1.1.1 Login/Registro
- [ ] 6.1.1.2 Chat IA
- [ ] 6.1.1.3 Creación de bots
- [ ] 6.1.1.4 Gestión de clases

#### 6.1.2 Integración
- [ ] 6.1.2.1 Backend ↔ Frontend
- [ ] 6.1.2.2 API ↔ Base de datos
- [ ] 6.1.2.3 IA ↔ API

#### 6.1.3 De IA
- [ ] 6.1.3.1 Respuestas relevantes
- [ ] 6.1.3.2 Fallback correcto
- [ ] 6.1.3.3 Personalización efectiva

#### 6.1.4 Usabilidad
- [ ] 6.1.4.1 Flujo usuario
- [ ] 6.1.4.2 Navegación intuitiva
- [ ] 6.1.4.3 Accesibilidad

---

### 6.2 Seguridad y rendimiento

#### 6.2.1 Pruebas de seguridad
- [x] 6.2.1.1 Penetration testing — *parcial: pruebas automatizadas de rate-limit/CSRF/XSS/SQLi en `tests/test_security.py`*
- [x] 6.2.1.2 XSS protection — *CSP + validación de payloads en tests*
- [x] 6.2.1.3 SQL injection prevention — *SQLAlchemy parametrizado + tests de payloads SQLi*
- [x] 6.2.1.4 CSRF protection — *validación Origin/Referer en endpoints de auth*

#### 6.2.2 Pruebas de rendimiento
- [ ] 6.2.2.1 Load testing
- [ ] 6.2.2.2 Stress testing
- [ ] 6.2.2.3 Memory profiling

#### 6.2.3 Pruebas de compatibilidad
- [ ] 6.2.3.1 Browsers (Chrome, Firefox, Safari, Edge)
- [ ] 6.2.3.2 Mobile OS (iOS, Android)
- [ ] 6.2.3.3 Devices (tablet, laptop, desktop)

#### 6.2.4 Corrección de errores
- [ ] 6.2.4.1 Bug tracking
- [ ] 6.2.4.2 Hotfixes
- [ ] 6.2.4.3 Rollback plan

---

### 6.3 Despliegue

#### 6.3.1 Configuración de infraestructura
- [x] 6.3.1.1 Docker (Dockerfile, docker-compose.yml)
- [ ] 6.3.1.2 Variables de entorno
- [ ] 6.3.1.3 CI/CD pipeline

#### 6.3.2 Despliegue frontend
- [ ] 6.3.2.1 Build production
- [ ] 6.3.2.2 Hosting (Vercel/netlify)
- [ ] 6.3.2.3 HTTPS

#### 6.3.3 Despliegue backend
- [x] 6.3.3.1 Build (requirements.txt)
- [ ] 6.3.3.2 Vercel deployment (vercel.json existe)
- [ ] 6.3.3.3 PostgreSQL en producción

#### 6.3.4 Configuración en Vercel
- [ ] 6.3.4.1 Environment variables
- [ ] 6.3.4.2 Build settings
- [ ] 6.3.4.3 Domain configuration

---

### 6.4 Documentación y entrega

#### 6.4.1 Documentación técnica y manuales
- [x] 6.4.1.1 README.md
- [ ] 6.4.1.2 API documentation (OpenAPI/Swagger)
- [ ] 6.4.1.3 Manual de usuario
- [ ] 6.4.1.4 Documentación de instalación

#### 6.4.2 Entrega de la versión final
- [ ] 6.4.2.1 Package completo
- [ ] 6.4.2.2 Licencia de uso
- [ ] 6.4.2.3 Soporte post-entrega

---

## Dudas y riesgos (REVISADO — auditoría técnica)

> **Nota sustituida de la versión anterior:** Las 8 "inconsistencias" que figuraban aquí estaban **desactualizadas** (afirmaban que IA, paneles, licencias y PWA no existían, cuando en realidad sí están implementados). Esta sección refleja ahora los **riesgos reales verificados** en la auditoría.

### 🔴 Críticos (bloquean funcionalidad ya existente) — ✅ TODOS RESUELTOS

1. ~~**`GET /license/my-license` no existe**~~ — ✅ **RESUELTO**: existe (`backend/app/api/license.py:66`). Verificado que un usuario con institución Premium/Pro ve sus módulos desde la UI.

2. ~~**Router de bots desalineado**~~ — ✅ **RESUELTO**: `expert_bot.py` ya no usa doble prefijo; se monta solo en `main.py` con `prefix="/api/v1/bots"`. El frontend (`/bots/`, `/bots/my-bots`, `/bots/create`, `/bots/{id}`) coincide con el backend real.

3. ~~**Endpoints admin de bots inexistentes**~~ — ✅ **RESUELTO**: `backend/app/api/admin_bots.py` expone `/api/v1/admin/bots`, `/admin/bots/pretrained` y `PATCH /admin/bots/{id}`; `BotManagement.tsx` ya los consume.

4. ~~**`teacher_reports.py` defectuoso**~~ — ✅ **RESUELTO**: usa campos reales de `QuizHistory` (`performance_score`, `time_spent_seconds`, `topic`, `quiz_title`, `classroom_id`) y `reportlab==4.1.0` **sí está** en `requirements.txt:23`.

5. ~~**Bug `quiz_title` duplicado**~~ — ✅ **RESUELTO**: `app/models/learning.py` declara `quiz_title` una sola vez (línea 150).

6. ~~**`ProtectedFeature.tsx` roto**~~ — ✅ **RESUELTO**: usa `useLicense().hasFeature(feature)` (expuesto por `LicenseContext.tsx`), sin `hasAccess` ni Promise-como-booleano.

> 📌 La **Prioridad 1 ya está cerrada en código**. El único pendiente real es la verificación E2E de flujo (crear bot desde el panel del profesor, moderar desde admin, exportar reporte) contra el backend desplegado.

### 🟠 Riesgos altos

7. **Credenciales reales de producción en `frontend/.env`** (Supabase, Groq, Gemini, NVIDIA). Aunque `.gitignore` las excluye del repo versionado, están en disco… ⚠️ **ACCIÓN AÚN PENDIENTE: rotar las claves** (especialmente `SECRET_KEY` y las API keys). El `SECRET_KEY` y `DATABASE_URL` sí quedaron además en el nuevo `backend/.env` (sin el cual se desconecta la DB).
8. **Límites de licencia incoherentes** — ✅ **RESUELTO**: se unificó en `license_service.py` (única fuente de verdad para módulos por rol/plan, KPIs, cupos docentes/estudiantes, límite de neurobots y formatos de exportación). `license.py` y `expert_bot.py` ahora importan de ahí; `SUPER_MODULES` vive en `license_service.py` y `credentials.py` lo importa. Los planes son **acumulativos** (Premium = Básica + extras, Pro = Premium + extras) y el módulo **`perfil` está siempre habilitado** en todos los roles y planes.
9. **DB SQLite locales casi vacías** (`backend/neurolearn.db`, `neurolearn.db`): solo usuarios demo; las tablas B2B nuevas (`institutions`, `quiz_history`, `cognitive_session_state`, etc.) **no existen** en estas DB locales. Solo la DB real (Supabase PostgreSQL vía `.env`) las tiene.

### 🟡 Riesgos medios

10. **PWA incompleta** — ✅ **RESUELTO**: service worker propio (`public/sw.js`) sin dependencia de `vite-plugin-pwa`, con registro en `main.tsx`, captura de `beforeinstallprompt` (instalable) y fallback offline. Iconos `icon-192.png`/`icon-512.png` existentes y referenciados.
11. **Fallback local de IA roto** — ✅ **RESUELTO**: `ai_manager.generate()` ahora genera un template local de respaldo (nunca `None`) cuando Groq/Gemini fallan; añadido `_generate_local_response()` (tutor + quiz JSON) y `chat.py` degrada a respuesta local en lugar de lanzar 503.
12. **`DEMO_MODE` contradictorio** — ✅ **RESUELTO**: `AuthContext.tsx` lo definía `false` y `demoChat.ts` `true`; se eliminó por completo el modo demo del frontend (credenciales demo, botones demo y cuentas demo del panel admin). El login usa siempre el backend real.
13. **Documentación desactualizada** (`CAMBIOS_REALIZADOS.md`, README): describen arquitectura de microservicios con `auth-service` que ya fue deprecada y unificada en el backend.
14. **Código duplicado/legacy**: `src/auth-service/` es una copia muerta; `auth-service/` está deprecada; hay dos `neurolearn.db` duplicadas.

### 🟢 Riesgos bajos

15. Login 3D (Three.js/VRM) pesado sin code-splitting visible.
16. `BotsPage.tsx` del estudiante usa **grid estática hardcodeada** de las 5 habilidades (no consume backend).

---

## Sección 7 — AUDITORÍA TÉCNICA Y BACKLOG PRIORIZADO (RESULTADO DEL ANÁLISIS)

> Esta sección resume la verificación integral del repositorio y define **qué hacer, en qué orden** para cerrar la brecha entre lo ya construido y lo que se ve 100% funcional desde la UI.

### 7.1 Resumen del dictamen

| Área | Estado | Avance |
|---|---|---|
| Backend FastAPI | ✅ Muy completo y robusto | ~95% |
| Base de datos / modelos | ✅ Sólido (sin RLS; bug `quiz_title`) | ~80% |
| IA (Groq/Gemini + motor neuroconductual) | ✅ Real (sin RAG ni fallback local) | ~75% |
| Autenticación / roles | ✅ Sólido | ~90% |
| Licencias | ⚠️ Implementado pero no opera desde UI | ~70% |
| Frontend | ⚠️ Muy conectado, con bugs de endpoints | ~80% |
| Despliegue / pruebas | 🔴 Pendiente | ~15% |
| PWA | ✅ Resuelta (SW propio + offline + instalable) | ~85% |
| **AVANCE GLOBAL ESTIMADO** | | **≈ 70%** |

### 7.2 Backlog priorizado

#### 🔴 Prioridad 1 — Bloqueantes (✅ YA RESUELTOS EN CÓDIGO)
1. ~~**Crear `/license/my-license`**~~ — ✅ existe (`license.py:66`).
2. ~~**Alinear router de bots**~~ — ✅ `expert_bot.py` con un solo prefijo `/api/v1/bots`.
3. ~~**Crear `/admin/bots` y `/admin/bots/pretrained`**~~ — ✅ `admin_bots.py` + `BotManagement.tsx`.
4. ~~**Corregir `teacher_reports.py`**, `quiz_title` duplicado y `ProtectedFeature.tsx`~~ — ✅ resueltos; `reportlab` en requirements.
   - ⏳ **Único pendiente P1**: verificación E2E real (crear bot/moderar/exportar desde la UI contra backend desplegado).

#### 🟠 Prioridad 2 — Funcionalidades principales (MVP)
5. ~~**Completar PWA**: añadir `vite-plugin-pwa`, registrar service worker, corregir iconos PNG/SVG.~~ — ✅ **RESUELTO**: service worker propio (`public/sw.js`), registro en `main.tsx`, prompt de instalación y offline support (sin necesidad de `vite-plugin-pwa`).
6. **Unificar límites de licencia** en una única fuente central (`license_service.py`) y eliminar los `LICENSE_LIMITS` dispersos.
7. ~~**Restaurar el fallback local** en `ai_manager.generate()` para que ante fallo total de Groq/Gemini responda con templates.~~ — ✅ **RESUELTO**: `_generate_local_response()` añadido y `generate()` nunca retorna `None`; `chat.py` degrada a respuesta local (quita los 503 de `start_session`/`send_message`).
8. **Implementar RAG real** (embeddings + vector store) para la carga de documentos de los NeuroBots.

#### 🟡 Prioridad 3 — Mejoras
9. **Robustecer análisis facial/voz** con ML real (face-api/mediapipe) en lugar del heurístico actual.
10. **Sembrar datos demo** en una DB de pruebas y limpiar las dos `neurolearn.db` duplicadas.
11. **Eliminar `src/auth-service`** y consolidar la documentación desactualizada (README, CAMBIOS_REALIZADOS).

#### 🟢 Prioridad 4 — Optimización
12. **Rotar las credenciales** del `.env` del frontend.
13. **Code-splitting / lazy-loading** del login 3D.
14. **Añadir rate-limiting** y robustecer seguridad de endpoints.
15. **Actualizar el mapa de avance y estados** de este documento conforme se cierren las tareas anteriores.

### 7.3 Cómo se calculó el avance

Porcentaje ponderado por criticidad para el MVP (backend/IA pesan más porque son el núcleo; PWA/despliegue pesan menos): F1 Gestión 5%, F2 Arquitectura 10%, F3 Plataforma académica 30%, F4 IA/neuro 25%, F5 PWA 15%, F6 Despliegue 15%. Aplicando el avance real de cada fase se obtiene **≈ 70%**.

### 7.4 Recomendación inmediata (¿qué hacer HOY?)

1. Corregir los **P1-1 a P1-4** (1 día). Con esto, funcionalidades ya existentes en backend (licencias, bots, admin, reportes) empiezan a verse correctamente en la UI.
2. Después cerrar la **PWA** (vite-plugin-pwa + service worker) para cumplir el requisito clave del proyecto.
3. Después el **RAG** y el **fallback local** para completar la capa de IA.
4. Mantener el estándar de seguridad: **rotar claves** y **no commitear `.env`**.

---

## Bitácora

| Fecha | Tarea | Responsable | Estado |
|-------|-------|-------------|--------|
| Auditoría técnica | Revisión integral del repo + actualización de estados y backlog | Equipo | ✅ Completada |
| Sesión actual | Fortalecer complexidad de contraseña en `/auth/change-password` y reset (mayús/minús/dígito/especial) | Dev | ✅ Completa |
| Sesión actual | Eliminar ~~rutas duplicadas~~ (`/auth/change-password`, `GET /admin/institutions`) que se sombreaban entre sí | Dev | ✅ Completa |
| Sesión actual | Eliminar `backend/app/api/upload_users.py` (endpoint sin autenticación) | Dev | ✅ Completa |
| Sesión actual | Cerrar salto del cambio de contraseña forzado navegando por URL (ProtectedRoute) | Dev | ✅ Completa |
| Sesión actual | Redirigir al **login** tras el cambio de contraseña (cierra sesión de la clave temporal) | Dev | ✅ Completa |
| Sesión actual | Carga masiva en dos pasos: `POST /super/*/preview` (validar) → `/bulk` (confirmar) en `UsersTabs.tsx` | Dev | ✅ Completa |
| Sesión actual | Eliminar **sistema demo del frontend** (credenciales, botones y cuentas demo del admin). Riesgo 12 resuelto | Dev | ✅ Completa |
| Sesión actual | Alinear `GET /admin/institutions` + `InstitutionList.tsx`/`LicenseManagement.tsx` | Dev | ✅ Completa |
| Sesión actual | Arreglar build frontend (tsconfig `ignoreDeprecations` + import `ProgressRacha`) | Dev | ✅ Completa |
| Sesión actual | Crear `backend/.env` (faltaba → backend arrancaba sin DB y daba 503 en `/auth/login`) | Dev | ✅ Completa |
| Sesión actual | Pendiente: **rotar credenciales** (SECRET_KEY + API keys) — riesgo 7 | Dev | 🔴 PENDIENTE |
| Sesión actual | 1.2.1.10: indicar funcionalidades no disponibles por licencia — quitar `disabled` nativo de los botones bloqueados del Súper (impedía el clic) y usar `aria-disabled` para que el aviso de módulo no disponible sí se muestre | Dev | ✅ Completa |
| Sesión actual | Rate-limiting/anti fuerza bruta en `/auth/login` y endpoints de auth — items 6.2.1 y P4-14 (in-memory sliding window + account lockout en `app/core/security.py`, integrado en `auth.py`) | Dev | ✅ Completa |
| Sesión actual | Protección CSRF/origen + security headers (CSP, X-Frame-Options, etc.) en endpoints de auth | Dev | ✅ Completa |
| Sesión actual | Pruebas automatizadas de seguridad (rate-limit, CSRF/origen, XSS, SQLi, cabeceras) en `backend/tests/test_security.py` — PASS 7/7 | Dev | ✅ Completa |
| Sesión actual | RLS multi-tenant para Supabase — políticas de fila en `backend/migrations/applied/005_rls_multitenant.sql` + README | Dev | ✅ Completa (aplica en Supabase SQL Editor) |
| Sesión actual | Unificar licencias: `license_service.py` como única fuente (módulos por rol/plan acumulativos, cupos, neurobots, export). `license.py`/`expert_bot.py`/`credentials.py` importan de ahí. `SUPER_MODULES` incluye `perfil`; el módulo `perfil` queda SIEMPRE habilitado en todos los roles y planes (backend + frontend `SuperDashboard`, `TeacherPanel`, `Layout`, `LicenseContext`) | Dev | ✅ Completa |
| Sesión actual | Matriz declarativa de funcionalidades: `FEATURE_MATRIX` (feature → plan → roles), `has_feature()`/`features_for_user()` y dependency `require_feature()` en `license_service.py`; `LicenseInfo` expone `role`/`features`/`super_modules`; `teacher_ai.py` usa `require_feature("teacher_ai")`; frontend `LicenseContext.hasFeature()` + `ProtectedFeature` con feature names; `TeacherPanel`/`LicenciaTab` alineados a la matriz; doc `docs/MATRIZ_LICENCIAS.md` | Dev | ✅ Completa |
| Sesión actual | Auditoría de seguridad licencias (backend): protegidas con `require_feature` las funciones Premium/Pro — `integrations.py` (integrations/automation; antes `require_teacher_module` excluía al Súper Profesor), `teacher_reports.py` (PDF=reportes_avanzados, CSV=reportes), `super_stats.py` (alerts=neuroalertas, dashboard=active_license), `teacher_stats.py` (active_license), `teacher_ai.py` (teacher_ai). Corrección matriz: `integrations` Premium incluye Súper Profesor; añadidas `learning_analytics`(premium)/`personal_analytics`(pro) estudiante | Dev | ✅ Completa |
| Sesión actual | Completar PWA: service worker propio `frontend/public/sw.js` (network-first navegación, cache-first assets versionados, fallback offline), registro en `frontend/src/main.tsx` (solo PROD) + captura `beforeinstallprompt` con helper `window.__pwaInstallPrompt`. Cierra items 2.3.1.3, 2.3.4.2/3/4 y riesgo 10 / P2-5 | Dev | ✅ Completa |
| Sesión actual | Responsive: añadir fallback móvil (`grid-cols-1 sm:grid-cols-N`) a grillas KPI/métricas que solo tenían `grid-cols-N` fijo (`GruposTab`, `NeuroAlertasTab` super y teacher, `LicenciaTab`, `CognitiveDashboard`). Cierra 2.2.5.2 y 2.2.5.3 | Dev | ✅ Completa |
| Sesión actual | Restaurar fallback local de IA: `ai_manager._generate_local_response()` (tutor en español + quiz JSON de diagnóstico) y `generate()` ya **nunca** retorna `None`; `chat.py` quita los 503 de `start_session`/`send_message` y degrada a respuesta local; docstring corregido. Cierra 2.3.3.4, 4.1.3.3, riesgo 11 y P2-7 | Dev | ✅ Completa |
| Sesión actual | Reconciliación PLAN ↔ EDT: marcar como ✅ las tareas ya resueltas que seguían como pendientes (PWA completa 5.1.1.2/5.1.2.x/5.1.3.x, servicios IA 5.3.4.x, code-splitting/lazy-loading 5.4.1.1-2, 1.3.3.5); añadir sección «Estado actual» con avance por fase y backlog priorizado | Dev | ✅ Completa |
| Sesión actual | **Prioridad 1 — verificación sobre código real**: confirmado que los bloqueantes P1 ya estaban resueltos (router bots `/api/v1/bots` único, `/admin/bots`+`/admin/bots/pretrained` en `admin_bots.py`, `teacher_reports.py` con campos reales de `QuizHistory`, `quiz_title` único en `learning.py:150`, `ProtectedFeature.tsx` usa `hasFeature`, `/license/my-license` existe, `reportlab` en `requirements.txt`). Actualizado el PLAN para marcarlos cerrados; único pendiente P1 = verificación E2E en UI | Dev | ✅ Completa |
| 2026-09-22 | **Auditoría #4 — lectura directa de código completo**: se identificaron nuevos hallazgos: bug `ProgressRacha.tsx` (endpoint muerto `/student/racha/{id}`), numeración duplicada en migraciones (dos 003/004/005), discrepancia de modelos en `ai_manager.py` vs `.env.example`, `UsersTabs.tsx` con 77KB (candidato a refactor), RLS de Supabase no aplica al backend (`BYPASSRLS`). RAG sigue en 0%. Estado global ajustado a ≈72%. | Dev | ✅ Completa |

---

## Sección 8 — AUDITORÍA TÉCNICA #4 (22 Sep 2026) — HALLAZGOS NUEVOS

> Resultado de lectura directa de código: backend, frontend, migraciones, IA providers y configs.

### 8.1 Bugs Activos Identificados

| ID | Severidad | Archivo | Descripción | Acción |
|----|-----------|---------|-------------|--------|
| 🔴 B-01 | CRÍTICO | `frontend/src/components/ProgressRacha.tsx:23` | Llama a `/student/racha/{userId}` que **no existe** en ningún router backend. El dato correcto es `overview.streak_days` de `/stats/performance`. | Corregir a `GET /stats/performance` y leer `data.overview.streak_days` |
| 🟠 B-02 | MEDIO | `backend/migrations/applied/` | **Numeración duplicada**: existen dos `003_*.sql`, dos `004_*.sql` y dos `005_*.sql`. El sistema de migraciones puede aplicarlas o ignorarlas de forma incorrecta. | Renombrar para garantizar unicidad: `003a`, `003b`, etc. o usar timestamps |
| 🟠 B-03 | MEDIO | `backend/app/ai/providers/ai_manager.py:31-33` | Hardcodea modelos `openai/gpt-oss-120b` y `gemini-3.6-flash` en comentarios/docstrings, mientras `.env.example` indica `qwen/qwen3-32b` y `gemini-2.0-flash`. Los modelos reales se cargan de env vars, pero el código comentado crea confusión. | Actualizar docstring para reflejar los modelos reales del .env |
| 🟡 B-04 | BAJO | `frontend/src/pages/super/components/UsersTabs.tsx` | 77,774 bytes — el componente más grande del proyecto. Alto acoplamiento, difícil de mantener y testear. | Dividir en sub-componentes (TeachersList, StudentsList, BulkUpload) |
| 🟡 B-05 | BAJO | `backend/app/api/auth.py → root()` | El endpoint `GET /` retorna `"info": "Para autenticación, usa http://localhost:8002"`, referencia al auth-service deprecado. | Eliminar esa línea del root response |
| 🟡 B-06 | BAJO | `005_rls_multitenant.sql:11-14` | Las políticas RLS de Supabase **no protegen las consultas del backend** porque usa `service_role` con `BYPASSRLS`. Solo protegen acceso vía PostgREST. Está documentado en la migración, pero el PLAN original lo marcó como ✅ sin esta aclaración. | Documentar limitación claramente; considerar `set_config('request.jwt.claims', ...)` si se quiere RLS real |

### 8.2 Estado Real del Sistema de Migraciones

```
migrations/applied/
├── 001_b2b_schema.sql          ✅ Fundacional (institutions, users B2B, audit_logs)
├── 002_add_adaptive_quiz_columns.sql  ✅ (mistakes, weak_concepts, performance_score en quiz_history)
├── 003_add_chat_patterns_tables.sql   ✅ (cognitive_session_state, learning_sessions, chat_messages)
├── 003_last_login.sql          ⚠️ NUMERACIÓN DUPLICADA — añade last_login a users
├── 004_add_chat_answers.sql    ✅ (chat_answers JSONB en cognitive_session_state)
├── 004_password_reset_tokens.sql ⚠️ NUMERACIÓN DUPLICADA — tabla password_reset_tokens
├── 005_adaptive_student_model.sql ✅ (student_mastery, conversations, conversation_messages)
└── 005_rls_multitenant.sql    ⚠️ NUMERACIÓN DUPLICADA — RLS Supabase (solo PostgREST, no backend)
```

> ⚠️ **Impacto:** El script `migrate.py` ordena alfabéticamente; actualmente las `003_last_login` y `004_password_reset_tokens` se procesan correctamente porque el orden alfabético las ubica después del otro `003`/`004`. Verificar que `migrate.py` usa un mecanismo de deduplicación (hash/nombre) y no solo el número.

### 8.3 Análisis del Motor de IA

| Componente | Estado | Observación |
|-----------|--------|-------------|
| Groq (`qwen/qwen3-32b`) | ✅ Funcional | Provider real via HTTP. Timeout configurable (`AI_HTTP_TIMEOUT=15s`). |
| Gemini (`gemini-2.0-flash`) | ✅ Funcional | Fallback secundario en `gemini_provider.py`. |
| Fallback local | ✅ Funcional | `_generate_local_response()` en `ai_manager.py:111-161`. Retorna template pedagógico o quiz JSON. |
| System prompt neuroconductual | ✅ Completo | `build_tutor_system_prompt()` inyecta estado cognitivo y 8 estados emocionales diferenciados. |
| RAG sobre documentos | ❌ No existe | Cero dependencias de embeddings/vectores en `requirements.txt`. |

### 8.4 Estado del Frontend — Páginas Stub o Incompletas

| Página/Componente | Tamaño | Estado | Acción |
|--|--|--|--|
| `ProgressRacha.tsx` | 4 KB | 🔴 Bug: endpoint muerto | Corregir endpoint (ver B-01) |
| `MessagesPage.tsx` | 512 B | ✅ OK — Wrappea `<Messaging>` | Funcional |
| `SettingsPage.tsx` | 488 B | ⚠️ Stub vacío | Añadir contenido real (perfil o redirect a /dashboard) |
| `ConfiguracionTab.tsx` (Teacher) | 273 B | ✅ OK — Wrappea `<ProfileSettings>` | Funcional |
| `MensajesTab.tsx` (Teacher) | 263 B | ⚠️ Stub vacío | Añadir `<Messaging>` component |
| `BotsPage.tsx` | 3 KB | ✅ Funcional (usa COMPETENCIES) | Ok para MVP — no consume backend dinámico |

### 8.5 Discrepancias PLAN vs Código Real (actualizadas)

| Item PLAN | Estado anterior | Estado real | Corrección |
|-----------|----------------|-------------|------------|
| `streak_days` en `ProgressRacha` | ✅ "calculado en /stats/performance" | 🔴 `ProgressRacha.tsx` llama a `/student/racha/{id}` inexistente | El streak sí está en `/stats/performance` → `overview.streak_days`; el componente es el que está roto |
| RLS multi-tenant | ✅ "aplicado en Supabase" | ⚠️ Solo aplica a PostgREST; el backend usa `service_role` con BYPASSRLS | Documentar limitación |
| Fallback local IA | ✅ "resuelto" | ✅ Confirmado funcionando en `ai_manager.py:111-161` | Sin cambios |
| Numeración migraciones | No documentado | ⚠️ Duplicada (dos 003, dos 004, dos 005) | Verificar `migrate.py` y renombrar si es necesario |

### 8.6 Avance Global Recalibrado (Auditoría #4)

| Área | Peso MVP | Avance | Ponderado |
|------|---------|--------|-----------|
| Backend FastAPI (endpoints, auth, licencias, IA) | 30% | 95% | 28.5% |
| Frontend (paneles, conexión, UX) | 25% | 80% | 20.0% |
| IA Neuroconductual (motor, providers, fallback) | 15% | 85% | 12.8% |
| RAG / Carga de documentos | 10% | 0% | 0.0% |
| PWA (SW, offline, instalable) | 5% | 90% | 4.5% |
| Pruebas (funcionales + seguridad + E2E) | 8% | 18% | 1.4% |
| Despliegue (Vercel, vars entorno, dominio) | 7% | 40% | 2.8% |
| **TOTAL** | **100%** | | **≈ 70%** |

---

## Sección 9 — TAREAS A COMPLETAR (Orden Crítico por Paquetes de Trabajo)

> Fecha: 22 Sep 2026 | Auditoría #4 | Las tareas están ordenadas de mayor a menor impacto en la defensa del proyecto.

---

### 🔴 PAQUETE 0 — Bugs Críticos del Frontend (1–2 horas)

**Impacto:** Sin estos fixes, funcionalidades ya existentes en backend NO son visibles/funcionales en la UI.

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 0.1 | **Corregir `ProgressRacha.tsx`**: cambiar `GET /student/racha/{userId}` → `GET /stats/performance` y leer `data.overview.streak_days`, `data.overview.total_quizzes`, `data.overview.consistency_pct` | `frontend/src/components/ProgressRacha.tsx` | 30 min |
| 0.2 | **Completar `MensajesTab.tsx`** del panel Profesor: añadir `<Messaging>` igual que `MessagesPage.tsx` | `frontend/src/pages/teacher/components/MensajesTab.tsx` | 15 min |
| 0.3 | **Completar `SettingsPage.tsx`**: añadir configuración de perfil del estudiante usando `<ProfileSettings role="estudiante">` | `frontend/src/pages/student/SettingsPage.tsx` | 15 min |
| 0.4 | **Limpiar root response**: eliminar referencia a `http://localhost:8002` del endpoint `GET /` en `main.py` | `backend/app/main.py:174` | 5 min |
| 0.5 | **Corregir discrepancia de modelos**: actualizar docstring de `ai_manager.py` para reflejar `qwen/qwen3-32b` y `gemini-2.0-flash` | `backend/app/ai/providers/ai_manager.py:30-35` | 10 min |

---

### 🔴 PAQUETE 1 — RAG / Carga Real de Documentos (2–4 días)

**Impacto:** RF 1.2.1.17 (cargar documentos para bots) está pendiente al 0%. Es el único bloqueante funcional de fondo.

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| 1.1 | Añadir dependencias RAG a `requirements.txt`: `sentence-transformers`, `chromadb` o `pgvector` | `backend/requirements.txt` | 30 min |
| 1.2 | Crear pipeline de procesamiento de documentos: leer PDF/TXT del `content` (LargeBinary ya existe en `TeacherMaterial`), dividir en chunks, generar embeddings | `backend/app/ai/rag/` (nuevo módulo) | 1 día |
| 1.3 | Configurar vector store: ChromaDB local (desarrollo) o `pgvector` extension en Supabase (producción) | Config + nueva tabla/colección | 1 día |
| 1.4 | Integrar RAG en `chat.py`: al construir el prompt del bot, recuperar chunks relevantes del vector store del bot | `backend/app/api/chat.py` | 4 horas |
| 1.5 | Actualizar `teacher_materials.py`: procesar el binario subido y lanzar pipeline de embeddings en background task | `backend/app/api/teacher_materials.py` | 3 horas |
| 1.6 | Actualizar `NeuroBotsTab.tsx` para mostrar estado de procesamiento del documento (pendiente/procesado/error) | `frontend/src/pages/teacher/components/NeuroBotsTab.tsx` | 2 horas |

---

### 🟠 PAQUETE 2 — Verificación E2E de Flujos Completos (1 día)

**Impacto:** Confirma que el backend y frontend ya construidos funcionan juntos de extremo a extremo.

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|----------|
| 2.1 | **E2E: Flujo Estudiante** | Login → Chat con bot → Quiz → Ver progreso (`/stats/performance`) → Ver racha | 2 horas |
| 2.2 | **E2E: Flujo Profesor** | Login → Crear clase → Generar código → Crear bot → Asignar bot a clase → Ver reportes → Exportar CSV | 2 horas |
| 2.3 | **E2E: Flujo Súper Profesor** | Login → Ver dashboard institucional → Crear docente → Crear estudiante → Ver métricas de licencia | 1 hora |
| 2.4 | **E2E: Flujo Admin** | Login → Moderar bots → Ver audit logs → Cambiar licencia de institución | 1 hora |
| 2.5 | **E2E: Flujo RAG** (solo si P1 completado) | Subir PDF → Ver estado procesado → Chatear con bot y verificar que responde con contexto del documento | 1 hora |

---

### 🟠 PAQUETE 3 — Despliegue en Producción Vercel (1 día)

**Impacto:** El proyecto de grado necesita URL pública para la defensa.

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|----------|
| 3.1 | **Configurar variables de entorno en Vercel Dashboard** | `DATABASE_URL`, `SECRET_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, etc. | 30 min |
| 3.2 | **Deploy frontend** | `npm run build` → Vercel auto-deploy desde `frontend/dist` | 30 min |
| 3.3 | **Deploy backend serverless** | Verificar `api/index.py` apunta a `app.main:app`; probar `GET /health` en URL de producción | 30 min |
| 3.4 | **Verificar rewrites de Vercel** | `vercel.json` rewrites correctos; probar `/api/v1/auth/login` desde la URL pública | 1 hora |
| 3.5 | **Configurar dominio personalizado** (opcional) | Añadir dominio o usar `.vercel.app` | 15 min |
| 3.6 | **Rotar credenciales** | Generar nuevo `SECRET_KEY` (mínimo 64 chars), rotar API keys Groq/Gemini, actualizar `.env` y Vercel Dashboard | 30 min |

---

### 🟠 PAQUETE 4 — Licencias en UI (3–5 horas)

**Impacto:** RF 1.2.1.48-50 (estudiante ve funciones según licencia) y RF 1.2.1.25 (profesor) pendientes.

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 4.1 | Adaptar `StudentDashboard.tsx`: mostrar/ocultar secciones según `license.features` retornadas por `LicenseContext` | `frontend/src/pages/student/StudentDashboard.tsx` | 1 hora |
| 4.2 | Panel Profesor → mostrar módulos habilitados: aplicar `ProtectedFeature` o `hasFeature()` en pestañas Pro (Automatizaciones, Integraciones, IA Generativa) | `frontend/src/pages/teacher/TeacherPanel.tsx` | 1 hora |
| 4.3 | Verificar que `BotsPage.tsx` muestra bots dinámicos del backend (actualmente usa COMPETENCIES estático) — evaluar si es suficiente para MVP | `frontend/src/pages/student/BotsPage.tsx` | 30 min |

---

### 🟡 PAQUETE 5 — Pruebas y Calidad (2–3 días)

**Impacto:** Calidad de entrega y defensa del proyecto.

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|----------|
| 5.1 | **Pruebas de seguridad completas**: ejecutar `pytest backend/tests/test_security.py` y confirmar 7/7 PASS en el entorno de producción | `backend/tests/test_security.py` | 30 min |
| 5.2 | **Pruebas de integración backend**: ejecutar `test_full_flow.py`, `test_adaptive_system.py`, `test_patterns.py` | `backend/tests/` | 1 hora |
| 5.3 | **Pruebas de carga**: simular 10–20 usuarios concurrentes con `locust` o `k6` sobre `/chat/message` y `/stats/performance` | Nuevo script | 1 día |
| 5.4 | **Compatibilidad cross-browser**: verificar en Chrome, Firefox, Edge, Safari (PWA install) | Manual | 2 horas |
| 5.5 | **Pruebas de rendimiento PWA**: Lighthouse score ≥ 80 en Performance, Accessibility y PWA | `frontend/dist` | 1 hora |
| 5.6 | **Prueba de offline**: desconectar red, navegar por rutas cacheadas, verificar fallback del Service Worker | Manual | 30 min |

---

### 🟡 PAQUETE 6 — Migraciones y DB (2–3 horas)

**Impacto:** Robustez del sistema en nuevo entorno de producción.

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|----------|
| 6.1 | **Renombrar migraciones duplicadas**: `003_last_login.sql` → `003b_last_login.sql`, `004_password_reset_tokens.sql` → `004b_password_reset_tokens.sql`, `005_rls_multitenant.sql` → `005b_rls_multitenant.sql` | `backend/migrations/applied/` | 30 min |
| 6.2 | **Verificar `migrate.py`**: confirmar que el script usa nombre de archivo (no número) como clave de deduplicación y que aplica migraciones en orden correcto | `backend/migrations/migrate.py` | 30 min |
| 6.3 | **Aplicar migraciones en Supabase producción**: ejecutar todos los `.sql` de `migrations/applied/` en el SQL Editor de Supabase si no están aplicados | Supabase Dashboard | 1 hora |
| 6.4 | **Índices de BD**: añadir índices a `cognitive_events.user_id`, `chat_messages.session_id`, `quiz_history.user_id` si no existen | Nueva migración `006_indexes.sql` | 1 hora |

---

### 🟢 PAQUETE 7 — Documentación y Entrega (1–2 días)

**Impacto:** Entrega formal del proyecto de grado.

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|----------|
| 7.1 | **Manual de usuario**: guía de uso por rol (Estudiante, Profesor, Súper Profesor, Admin) con capturas de pantalla | `docs/MANUAL_USUARIO.md` | 4 horas |
| 7.2 | **API Documentation**: exportar OpenAPI spec desde `GET /api/docs` → guardar como `docs/api_spec.json` | `docs/` | 30 min |
| 7.3 | **Actualizar README.md**: instrucciones de despliegue con Vercel actualizadas, remover referencias a auth-service deprecado | `README.md` | 1 hora |
| 7.4 | **Actualizar `ARQUITECTURA_MICROSERVICIOS.md`**: reemplazar con arquitectura real actual (monolito FastAPI + React + Supabase + Vercel) | `docs/ARQUITECTURA_MICROSERVICIOS.md` | 1 hora |
| 7.5 | **Cronograma de mantenimiento post-lanzamiento** (ítem 1.1.2.3 pendiente) | `docs/MANTENIMIENTO.md` | 30 min |
| 7.6 | **Preparar presentación de defensa**: video demo de los 4 flujos de usuario (E2E verificados en P2) | Externo | 1 día |

---

### 🟢 PAQUETE 8 — Optimizaciones Opcionales (si hay tiempo)

| # | Tarea | Impacto | Esfuerzo |
|---|-------|---------|----------|
| 8.1 | Refactorizar `UsersTabs.tsx` (77KB) en sub-componentes | Mantenibilidad | 4 horas |
| 8.2 | JWT Refresh Tokens (ítem 5.3.2.2 pendiente) | Seguridad UX | 3 horas |
| 8.3 | Streaming de respuestas del chat (ítem 4.1.1.2) | UX | 4 horas |
| 8.4 | Índices estratégicos en BD (ítem 2.4.1.2) | Rendimiento | 2 horas |
| 8.5 | Mapas de calor (ítem 3.3.5.3) | Analytics | 6 horas |
| 8.6 | Capacitor/app híbrida Android (ítem 5.2.1.2) | Alcance | 2 días |

---

### 📊 Resumen de Esfuerzo Total Estimado

| Paquete | Criticidad | Esfuerzo Est. | Entregable |
|---------|-----------|--------------|-----------|
| P0 — Bugs Frontend | 🔴 Urgente | 1.5 horas | Racha funcional, tabs sin stubs |
| P1 — RAG | 🔴 Alta | 2–4 días | Bots con conocimiento de documentos |
| P2 — Verificación E2E | 🟠 Alta | 1 día | Flujos completos verificados |
| P3 — Despliegue Vercel | 🟠 Alta | 1 día | URL pública para defensa |
| P4 — Licencias UI | 🟠 Media | 3–5 horas | Restricciones visibles en frontend |
| P5 — Pruebas | 🟡 Media | 2–3 días | Suite de pruebas + Lighthouse |
| P6 — Migraciones | 🟡 Media | 2–3 horas | DB limpia y robusta en producción |
| P7 — Documentación | 🟢 Baja | 1–2 días | Manual + API docs + README |
| P8 — Opcionales | 🟢 Baja | Variable | Nice-to-have |

> **Ruta crítica para la defensa:** P0 → P3 → P2 → P1 → P5 → P7

---

**Firma del responsable:** _______________________

**Fecha de revisión:** 2026-09-22