# PLAN.md — Plan de trabajo de NeuroLearn IA

> Proyecto de grado 2026 · Aplicación web instalable (PWA) para preparar el Saber 11 (ICFES) · Colombia
> Última actualización: 9 de octubre de 2026 (después del parche 13)
> Fuentes: EDT del proyecto, documento de requisitos v3 y revisión directa del código.

Este documento resume en qué estado está el proyecto, qué se hizo en cada
parche y qué falta para la entrega. Reemplaza la versión anterior (22 de
septiembre), que todavía hablaba de licencias (Lo cual se dio de baja), de datos de demostración y de
funciones que ya cambiaron.

---

## 1. Estado general

La fase de programación está prácticamente cerrada. Las funciones principales
están hechas y conectadas a la base de datos real (Supabase), y el backend
tiene 151 pruebas automáticas que se ejecutan en cada cambio (GitHub Actions).

| Área | Estado |
|---|---|
| Inicio de sesión, roles y recuperación de contraseña | Terminado |
| Gestión de instituciones, profesores, estudiantes y grupos | Terminado |
| Tutor con IA (chat) y análisis del comportamiento del estudiante | Terminado |
| NeuroBots: creación, documentos, asignación, progreso y resultados | Terminado |
| Evaluaciones del profesor al estudiante | Terminado |
| Notificaciones | Terminado |
| Reportes del profesor (PDF y CSV) | Terminado |
| Integraciones (Google Drive y Calendar) y automatizaciones | Terminado, con pendientes menores |
| Pruebas automáticas y revisión de dependencias | Terminado |
| Despliegue en Vercel | Funcionando |
| Revisión final de seguridad (parche 14) | Pendiente |
| Pruebas manuales en el navegador y documentos de entrega | Pendiente |

Ya no existen licencias ni planes (Básica, Premium, Pro). Lo que cada usuario
puede hacer depende solo de su rol: Administrador, Súper Profesor, Profesor o
Estudiante. El detalle está en `docs/MATRIZ_PERMISOS.md`.

---

## 2. Qué se hizo en cada parche

| Parche | Qué cambió |
|---|---|
| 1 | Se eliminó por completo el modelo de licencias. El acceso depende solo del rol. |
| 2 | Los profesores pueden subir documentos (PDF, Word, texto) a sus NeuroBots y el bot los usa para responder. |
| 3 | Generación de preguntas de evaluación con IA real y guardado validado. |
| 4 | Evaluaciones completas: el profesor crea, publica, revisa y califica; el estudiante responde con tiempo e intentos. |
| 5 | El estudiante da su consentimiento antes de usar la cámara o el micrófono. |
| 6 | Exportación real de reportes del profesor en PDF y CSV. |
| 7 | Se muestra el nombre real de la institución y se retiró una página de registro que no se usaba. |
| 8 | Pruebas automáticas de inicio de sesión, roles, permisos y separación entre instituciones. |
| 9 | Revisión automática en GitHub (pruebas del backend y compilación del frontend) en cada cambio. |
| 10 y 10B | Se actualizaron las librerías con fallas de seguridad conocidas (frontend y backend). |
| 11 | Limpieza del repositorio y retiro de contraseñas que estaban guardadas en el código. |
| 11B | NeuroBots asignados a grupos o estudiantes con meta, progreso y resultados para el profesor; notificaciones guardadas en la base de datos con su campana en todos los paneles. |
| 11C | Se corrigió el error de tamaño en Vercel: el frontend ya no se copia dentro del backend. |
| 13A | El enlace del correo de recuperación de contraseña abre la página para crear la nueva contraseña (antes abría la página de inicio). |
| 13B | Profesor: se quitó Webhooks; Analítica, IA Generativa, Integraciones y Automatizaciones funcionan con datos reales. |
| 13 | Actualización de este plan. |

El parche 12 (revisión general de todos los paneles) se preparó pero no se
aplicó por decisión del equipo; sus arreglos más urgentes del profesor se
hicieron en el parche 13B.

Base de datos: las migraciones 001 a 011 están aplicadas en Supabase (carpeta
`backend/migrations/applied/`).

---

## 3. Funciones por rol

### Administrador
- Crea instituciones y la cuenta del Súper Profesor de cada una.
- Activa o desactiva instituciones y cuentas de usuario.
- Restablece contraseñas, revisa la auditoría y modera los NeuroBots.
- Consulta estadísticas generales y el estado del sistema.

### Súper Profesor
- Crea profesores y estudiantes, uno por uno o con archivo CSV.
- Ve el tablero de su institución, los grupos, las NeuroAlertas y los reportes.
- Envía comunicados a toda la institución.
- Supervisa los NeuroBots de su institución: activar, desactivar, eliminar y ver progreso.
- Recibe notificaciones de grupos y NeuroBots nuevos y de estudiantes en riesgo.

### Profesor
- Crea grupos con código de invitación y ve a sus estudiantes.
- Crea NeuroBots, les sube documentos y los asigna a grupos o estudiantes con una meta.
- Crea y califica evaluaciones; publica en el tablero; sube materiales.
- Ve analítica, NeuroAlertas y reportes de sus grupos.
- Usa IA Generativa (planes de clase, preguntas, guías y rúbricas).
- Conecta Google Drive y Calendar y crea automatizaciones.

### Estudiante
- Se une a grupos con el código de invitación.
- Conversa con el tutor de IA en 5 competencias del Saber 11 y con sus NeuroBots.
- Ve "Mis NeuroBots" con su progreso y la meta de cada uno.
- Responde evaluaciones y quizzes; consulta su desempeño y su racha.
- Recibe notificaciones (NeuroBot asignado, evaluación publicada, mensajes).

---

## 4. Lo que falta

### Parche 14 — revisión final de seguridad
- La clave del servicio de voz de Azure (`VITE_AZURE_SPEECH_KEY`) queda visible en el navegador. Hay que moverla al backend.
- Autorización de padres o acudientes para estudiantes menores de edad.
- Revisión final de contraseñas, cuentas de prueba y variables de entorno.

### Antes de la entrega
- Probar a mano en el navegador los cuatro paneles después del despliegue.
- Actualizar documentos desactualizados (por ejemplo `docs/INICIO_RAPIDO.md` y los enlaces del README a archivos que ya no existen).
- Revisar el estilo del código del frontend (`npm run lint`), que hoy no se revisa en GitHub.

### Pendientes menores (decisión del equipo)
- El Súper Profesor todavía no tiene una pantalla para configurar el webhook de la institución (solo existe por la API).
- El Administrador puede abrir los paneles de los demás roles, pero el backend no le permite todo dentro de ellos. Hay que decidir si se amplía su acceso o se restringe la navegación.
- Las notificaciones se revisan cada 60 segundos; no llegan al instante.
- Vercel limita cada archivo enviado a unos 4,5 MB, aunque el backend acepta adjuntos de mensajes de hasta 25 MB.
- Los temas que el parche 12 detectó en los demás paneles quedan documentados para una revisión futura.

---

## 5. Cómo trabajar en el proyecto

- Cada cambio final (Distribuido en 14 parches) se entrega como un parche (`.patch`) que se aplica en GitHub Codespaces con `git am`, se prueba y se sube.
- Antes de subir: `cd backend && python -m pytest -q` debe pasar completo.
- Si un parche trae una migración, se ejecuta primero en Supabase y luego se mueve a `backend/migrations/applied/`.
- Guía de pruebas: `docs/PRUEBAS.md`. Guía de despliegue: `docs/DEPLOYMENT_VERCEL.md`.

---

## 6. Documentos relacionados

- `docs/MATRIZ_PERMISOS.md` — qué puede hacer cada rol.
- `docs/NEUROBOTS_NOTIFICACIONES.md` — asignación de NeuroBots y notificaciones.
- `docs/NEUROBOTS_DOCUMENTOS.md` — documentos de los NeuroBots.
- `docs/EVALUACIONES.md` — evaluaciones del profesor.
- `docs/REPORTES.md` — reportes del profesor.
- `docs/PRIVACIDAD_CONSENTIMIENTO.md` — cámara y micrófono.
- `docs/RECUPERACION_CONTRASENA_BREVO.md` — recuperación de contraseña por correo.
- `docs/SEGURIDAD_DEPENDENCIAS.md` — revisión de librerías.
- `docs/diccionario_edt_neurolearn.md` — EDT del proyecto.
