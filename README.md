# 🧠 NeuroLearn AI


**Plataforma B2B2C de Aprendizaje Adaptativo con Inferencia Neuroconductual Digital**

> **Proyecto de Grado** | PWA (Progressive Web App) | Colombia — Saber 11 ICFES

---

## 📋 Descripción

NeuroLearn AI es una plataforma educativa SaaS institucional que combina **inteligencia artificial adaptativa** y **análisis neuroconductual en tiempo real** para personalizar el aprendizaje de bachilleres colombianos en las 5 habilidades transversales con peores resultados Saber 11.

El sistema analiza 5 patrones de comportamiento digital mediante **fusión bayesiana multimodal** para inferir el estado cognitivo del estudiante (Flujo, Fatiga, Frustración, etc.) y adaptar automáticamente la pedagogía de la IA.

---

## 🎯 Las 5 Habilidades Transversales (Saber 11)

| # | Habilidad | Problema detectado |
|---|-----------|-------------------|
| 1 | Pensamiento Lógico-Matemático | 60% en niveles 1-2 |
| 2 | Comprensión Lectora y Pensamiento Crítico | Baja inferencia y análisis |
| 3 | Inglés Comunicativo | 75% en nivel A- (pre-básico) |
| 4 | Competencias Ciudadanas y Sociales | No comprenden democracia ni derechos |
| 5 | Pensamiento Científico | No aplican método científico |

---

## 👥 Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| **Estudiante** | Aprende con el tutor IA adaptativo, visualiza su progreso cognitivo |
| **Profesor** | Crea bots expertos con su material, monitorea alertas neuroconductuales |
| **Súper Profesor (Rector)** | Gestiona licencias institucionales, dashboards macro del colegio |
| **Sistema IA** | Motor neuroconductual automatizado — analiza y adapta en tiempo real |

---

## 🧠 Patrones Neuroconductuales

| # | Patrón | Señal capturada |
|---|--------|----------------|
| 1 | Ritmo de Interacción | Velocidad de escritura, pausas, CPM |
| 2 | Secuencia de Decisión | Uso de backspace, tiempo de hesitación |
| 3 | Microexpresiones Faciales | Atención, frustración, curiosidad (cámara) |
| 4 | Prosodia de Voz | Tono, temblor, energía vocal (micrófono) |
| 5 | Patrón Predictivo de Error | Historial + contexto → probabilidad de fallo |

---

## 🏗️ Arquitectura del Proyecto

```
proyectog/
│
├── backend/                        # ✅ API REST — FastAPI + Python 3.11
│   ├── app/
│   │   ├── main.py                 # Entry point FastAPI
│   │   ├── api/                    # Endpoints REST
│   │   │   ├── auth.py             # Login / Registro / JWT
│   │   │   ├── chat.py             # Sesiones de tutoría IA
│   │   │   ├── expert_bot.py       # CRUD de bots expertos
│   │   │   └── classroom.py        # Gestión de aulas / clases
│   │   ├── ai/                     # Motor de IA
│   │   │   ├── chatbot/            # Chatbot adaptativo
│   │   │   ├── cognitive/          # Motor neuroconductual (fusión bayesiana)
│   │   │   ├── expert_bot/         # Entrenador y persistencia de bots
│   │   │   └── providers/          # Groq / Gemini / Fallback local
│   │   ├── core/                   # Configuración central (settings)
│   │   ├── db/                     # SQLAlchemy + SQLite/PostgreSQL
│   │   ├── models/                 # ORM: User, LearningSession, ExpertBot, Classroom
│   │   ├── schemas/                # Validación Pydantic
│   │   └── services/               # Lógica de negocio reutilizable
│   ├── data/
│   │   └── trained_bots/           # Bots pre-entrenados (5 habilidades Saber 11)
│   ├── tests/                      # Pruebas unitarias e integración
│   └── requirements.txt
│
├── frontend/                       # 🔨 PWA — React 18 + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/               # LoginPage, RegisterPage
│   │   │   ├── student/            # StudentDashboard, ChatPage, BotsPage, MyClassesPage
│   │   │   └── teacher/            # TeacherDashboard, CreateClassroomPage, ClassroomDetailPage
│   │   ├── components/             # Layout, ProtectedRoute, CognitiveDashboard
│   │   ├── hooks/                  # useBehavioralMetrics, useFacialDetection, useVoiceProsody
│   │   ├── context/                # AuthContext
│   │   ├── services/               # api.ts (cliente HTTP)
│   │   └── types/                  # Tipos TypeScript globales
│   └── package.json
│
├── docs/                           # 📄 Documentación del proyecto
│   ├── REQUISITOS_FUNCIONALES.md   # 87 requisitos organizados por actor
│   ├── IDEA_DEFINITIVA.md          # Concepto y propuesta de valor
│   ├── DIAGRAMAS_UML.md            # Diagramas de arquitectura
│   ├── ESTUDIO_VIABILIDAD.md       # Análisis de viabilidad técnica y económica
│   ├── ANALISIS_GARTNER_MQ.md      # Posicionamiento en el mercado
│   ├── MATRIZ_COMPETITIVA.md       # Comparación con competidores
│   ├── CRONOGRAMA.md               # Plan de desarrollo
│   └── PROMPTS_MOCKUPS_IA.md       # Prompts para generadores de UI/mockups
│
└── README.md
```

---

## 🔧 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Backend** | Python 3.11 + FastAPI + Uvicorn |
| **Base de datos** | SQLite (desarrollo) / PostgreSQL (producción) |
| **ORM** | SQLAlchemy |
| **Auth** | JWT (python-jose) + Bcrypt (passlib) |
| **IA Generativa** | Groq (LLaMA 3) → Gemini (fallback) → Local (fallback) |
| **Análisis conductual** | NumPy + Scikit-learn |
| **Validación** | Pydantic v2 |

---

## 🚀 Instalación y Ejecución

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Documentación interactiva: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App en: http://localhost:5173
```

---

## 📊 Estado del Proyecto

| Módulo | Estado |
|--------|--------|
| API REST (auth, chat, bots, classroom) | ✅ Implementado |
| Motor Neuroconductual (5 patrones + fusión bayesiana) | ✅ Implementado |
| Chatbot Adaptativo con decisiones pedagógicas | ✅ Implementado |
| Bots pre-entrenados (5 habilidades Saber 11) | ✅ Implementado |
| Frontend React PWA (6 vistas principales) | 🔨 En desarrollo |
| Integración IA Generativa (Groq / Gemini) | ⏳ Pendiente |
| Despliegue en producción | ⏳ Pendiente |

---

## 📖 Documentación

- 📋 [Requisitos Funcionales (87 RF)](docs/REQUISITOS_FUNCIONALES.md)
- 💡 [Idea Definitiva del Proyecto](docs/IDEA_DEFINITIVA.md)
- 📐 [Diagramas UML y Arquitectura](docs/DIAGRAMAS_UML.md)
- 📊 [Análisis de Viabilidad](docs/ESTUDIO_VIABILIDAD.md)
- 🗓️ [Cronograma de Desarrollo](docs/CRONOGRAMA.md)

---

*NeuroLearn AI — Proyecto de Grado 2026 🇨🇴*
