# NeuroLearn IA

[![CI](https://github.com/YesicaCausado/Proyecto_g/actions/workflows/ci.yml/badge.svg)](https://github.com/YesicaCausado/Proyecto_g/actions/workflows/ci.yml)

**Plataforma de aprendizaje adaptativo con inteligencia artificial para colegios**

> Proyecto de grado 2026 · Aplicación web instalable (PWA) · Colombia, preparación Saber 11 (ICFES)

---

## Descripción

NeuroLearn IA ayuda a los estudiantes de bachillerato a prepararse para el
Saber 11 con un tutor de inteligencia artificial que se adapta a cada uno.

Mientras el estudiante estudia, el sistema observa cómo interactúa (ritmo de
escritura, pausas, errores y, si el estudiante lo autoriza, cámara y
micrófono) para estimar si está concentrado, cansado o frustrado, y ajusta la
forma de enseñar.

Los colegios usan la plataforma con sus propias cuentas: cada institución
tiene un Súper Profesor (rector o coordinador), sus profesores y sus
estudiantes. No hay planes ni licencias: lo que cada usuario puede hacer
depende solo de su rol.

---

## Competencias del Saber 11

| # | Competencia |
|---|---|
| 1 | Pensamiento lógico-matemático |
| 2 | Comprensión lectora y pensamiento crítico |
| 3 | Inglés comunicativo |
| 4 | Competencias ciudadanas |
| 5 | Pensamiento científico |

---

## Roles

| Rol | Qué hace |
|---|---|
| **Administrador** | Crea instituciones y la cuenta de su Súper Profesor; activa o desactiva instituciones y usuarios; revisa la auditoría. |
| **Súper Profesor** | Crea profesores y estudiantes (uno por uno o con CSV); ve el tablero, los grupos, las alertas y los reportes de su institución; envía comunicados. |
| **Profesor** | Crea grupos y NeuroBots, asigna NeuroBots con una meta, crea evaluaciones, sube materiales y sigue el progreso de sus estudiantes. |
| **Estudiante** | Se une a grupos con un código, conversa con el tutor y con sus NeuroBots, responde evaluaciones y quizzes y consulta su desempeño. |

Detalle de permisos: [docs/MATRIZ_PERMISOS.md](docs/MATRIZ_PERMISOS.md).

---

## Funciones principales

- **Tutor con IA** para las 5 competencias, que adapta su forma de enseñar según el estado del estudiante.
- **NeuroBots:** tutores creados por el profesor con sus propios documentos, asignados a grupos o estudiantes, con progreso y resultados.
- **Evaluaciones:** el profesor crea (a mano o con IA), publica y califica; el estudiante responde con tiempo e intentos.
- **NeuroAlertas:** avisos de estudiantes con bajo rendimiento o sin actividad.
- **Notificaciones** con campana en todos los paneles.
- **Reportes** en PDF y CSV.
- **Integraciones** con Google Drive y Google Calendar, y automatizaciones.
- **Privacidad:** la cámara y el micrófono solo se usan con el consentimiento del estudiante.

---

## Tecnologías

| Parte | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite y Tailwind CSS (aplicación instalable, PWA) |
| Backend | Python 3.12 y FastAPI |
| Base de datos | PostgreSQL en Supabase (SQLite para desarrollo local) |
| Inicio de sesión | Tokens JWT y contraseñas cifradas con bcrypt |
| Inteligencia artificial | Groq y, como respaldo, Gemini |
| Correo | Brevo (recuperación de contraseña y credenciales) |
| Despliegue | Vercel |

---

## Estructura del proyecto

```
Proyecto_g/
├── api/              Punto de entrada del backend en Vercel y sus dependencias
├── backend/
│   ├── app/
│   │   ├── api/      Rutas de la API (auth, chat, bots, grupos, evaluaciones…)
│   │   ├── ai/       Motor de análisis del estudiante y conexión con la IA
│   │   ├── core/     Configuración y permisos por rol
│   │   ├── models/   Tablas de la base de datos
│   │   └── services/ Lógica del negocio (notificaciones, NeuroBots, reportes…)
│   ├── data/         Bots base de las 5 competencias
│   ├── migrations/   Scripts SQL para Supabase
│   ├── scripts/      Creación del primer Administrador
│   └── tests/        Pruebas automáticas
├── frontend/
│   └── src/
│       ├── pages/    Pantallas de cada rol (admin, super, teacher, student)
│       ├── components/
│       ├── context/  Sesión y notificaciones
│       └── services/ Cliente de la API
├── docs/             Documentación del proyecto
└── PLAN.md           Estado y pendientes del proyecto
```

---

## Instalación local

### Backend
```bash
cd backend                        # requiere Python 3.12
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Documentación de la API: http://localhost:8000/docs
```

Las variables de entorno necesarias están en `docs/VARIABLES_ENTORNO.md`
(base de datos, clave de los tokens, claves de IA y de correo).

### Primer Administrador
No hay cuentas de demostración. El Administrador se crea con un script; la
contraseña se pide sin mostrarse:
```bash
cd backend
python -m scripts.crear_admin --usuario admin.neurolearn --correo admin@colegio.edu.co --nombre "Nombre Apellido"
python -m scripts.crear_admin --usuario admin.neurolearn --restablecer   # cambiar su contraseña
```
Desde su panel se crean las instituciones; el Súper Profesor de cada una crea
a los profesores y estudiantes.

### Frontend
```bash
cd frontend
npm install
npm run dev
# Aplicación en http://localhost:5173
```

### Pruebas
```bash
cd backend
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -r requirements-dev.txt
python -m pytest -q
```
Usan una base de datos en memoria, sin correos ni IA reales. GitHub Actions
las ejecuta en cada cambio, junto con la compilación del frontend. Detalle en
[docs/PRUEBAS.md](docs/PRUEBAS.md).

---

## Estado

La programación está prácticamente terminada y la aplicación funciona en
Vercel. Falta la revisión final de seguridad y las pruebas manuales antes de
la entrega. El detalle está en [PLAN.md](PLAN.md).

---

## Documentación

- [Plan y estado del proyecto](PLAN.md)
- [Requisitos funcionales y no funcionales](<docs/Requisitos funcionales y no funcionales version3 (1).md>)
- [Idea del proyecto](docs/IDEA_DEFINITIVA.md)
- [Diagramas UML](docs/DIAGRAMAS_UML.md)
- [EDT del proyecto](docs/diccionario_edt_neurolearn.md)
- [Permisos por rol](docs/MATRIZ_PERMISOS.md)
- [NeuroBots y notificaciones](docs/NEUROBOTS_NOTIFICACIONES.md)
- [Evaluaciones](docs/EVALUACIONES.md)
- [Pruebas automáticas](docs/PRUEBAS.md)
- [Despliegue en Vercel](docs/DEPLOYMENT_VERCEL.md)
- [Seguridad de dependencias](docs/SEGURIDAD_DEPENDENCIAS.md)
- [Estudio de viabilidad](docs/ESTUDIO_VIABILIDAD.md)

---

*NeuroLearn IA — Proyecto de grado 2026*
