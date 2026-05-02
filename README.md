# 🧠 NeuroLearn AI# 🧠 NeuroLearn AI



## Plataforma Web Progresiva de Aprendizaje Adaptativo con Inferencia Neuroconductual Digital## Plataforma Inteligente de Aprendizaje y Transferencia de Habilidades basada en Modelado Neuroconductual Digital



> **Proyecto de Grado** — Educación Técnica y Universitaria### Descripción

> Tipo: PWA (Progressive Web App) | Estado: Backend ✅ | Frontend 🔨Plataforma que combina inteligencia artificial adaptativa y modelado de comportamiento digital para optimizar el aprendizaje y permitir la transferencia estructurada de conocimiento experto.



---### Módulos

1. **Modo Aprender** - Chatbot inteligente con IA adaptativa

### 📋 Descripción2. **Entrenar Bot Experto** - Creación de bots de conocimiento

3. **Compartir Conocimiento** - Biblioteca y transferencia de bots

NeuroLearn AI es una plataforma inteligente que combina **inteligencia artificial adaptativa** y **modelado neuroconductual digital** para personalizar el aprendizaje y facilitar la transferencia estructurada de conocimiento experto.

### Tecnologías

El sistema analiza **5 patrones neuroconductuales digitales** en tiempo real mediante **fusión bayesiana multimodal** para inferir el estado cognitivo del usuario y adaptar automáticamente la enseñanza.- **Frontend:** React.js + TypeScript

- **Backend:** Python + FastAPI

### 🧠 Patrones Neuroconductuales- **IA:** Scikit-learn, OpenAI API

- **Base de Datos:** SQLite (dev) / PostgreSQL (prod)

| # | Patrón | Qué detecta |

|---|--------|-------------|### Estructura del Proyecto

| 1 | Ritmo de Interacción | Fatiga, flujo, desconcentración |```

| 2 | Secuencia de Decisión | Duda, dominio, consistencia |proyectog/

| 3 | Microexpresiones Faciales | Frustración, confusión, interés |├── backend/          # FastAPI + Motor IA

| 4 | Prosodia de Voz | Inseguridad, confianza, estrés |│   ├── app/

| 5 | Patrones Predictivos de Error | Sobrecarga inminente, áreas débiles |│   │   ├── api/          # Endpoints REST

│   │   ├── core/         # Configuración central

### 🎯 Módulos del MVP│   │   ├── models/       # Modelos de base de datos

│   │   ├── schemas/      # Schemas Pydantic

| Módulo | Descripción | Estado |│   │   ├── services/     # Lógica de negocio

|--------|-------------|--------|│   │   ├── ai/           # Motor de IA y chatbots

| **Chatbot Adaptativo** | Chat IA que ajusta dificultad según estado cognitivo | ✅ Backend listo |│   │   │   ├── chatbot/      # Chatbot adaptativo

| **Motor Neuroconductual** | 5 patrones + fusión bayesiana + 8 estados | ✅ Backend listo |│   │   │   ├── cognitive/    # Inferencia neuroconductual

| **Bot Experto** | Profesores/expertos entrenan bots con su conocimiento | ✅ Backend listo |│   │   │   └── expert_bot/   # Bot experto entrenable

| **Autenticación** | Registro, login, JWT, perfiles | ✅ Backend listo |│   │   └── db/           # Base de datos

| **Frontend PWA** | React + TypeScript, instalable, responsive | 🔨 En desarrollo |│   ├── tests/

│   └── requirements.txt

### 🔧 Tecnologías├── frontend/         # React.js

└── data/             # Datos de entrenamiento

| Capa | Tecnología |```

|------|-----------|

| Frontend | React 18 + TypeScript + Tailwind CSS |### Instalación

| Backend | Python 3.11 + FastAPI |```bash

| IA/ML | Scikit-learn + NumPy + OpenAI API (opcional) |# Backend

| Base de datos | SQLite (dev) / PostgreSQL (prod) |cd backend

| Auth | JWT (python-jose + bcrypt) |pip install -r requirements.txt

| Validación | Pydantic v2 |uvicorn app.main:app --reload



### 📁 Estructura del Proyecto# Frontend

cd frontend

```npm install

proyectog/npm start

├── backend/                    # ✅ IMPLEMENTADO```

│   ├── app/
│   │   ├── ai/
│   │   │   ├── chatbot/           # Chatbot adaptativo (1,016 líneas)
│   │   │   ├── cognitive/         # Motor neuroconductual (1,386 líneas)
│   │   │   └── expert_bot/        # Entrenador de bots (482 líneas)
│   │   ├── api/                   # Endpoints REST (auth, chat, bots)
│   │   ├── core/                  # Configuración central
│   │   ├── db/                    # SQLAlchemy + SQLite
│   │   ├── models/                # User, LearningSession, ExpertBot
│   │   ├── schemas/               # Validación Pydantic
│   │   └── main.py                # FastAPI entry point
│   └── requirements.txt
│
├── frontend/                   # 🔨 POR CONSTRUIR
│   ├── src/
│   │   ├── pages/                 # Login, Dashboard, Chat, Bots
│   │   ├── components/            # UI components
│   │   └── services/              # API calls
│   └── package.json
│
├── docs/                       # 📄 Documentación
│   ├── IDEA_DEFINITIVA.md         # Concepto completo del proyecto
│   ├── ANALISIS_GARTNER_MQ.md    # Análisis de mercado
│   └── MATRIZ_COMPETITIVA.md     # Comparación competitiva
│
└── README.md                   # Este archivo
```

### 🚀 Instalación

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (cuando esté listo)
cd frontend
npm install
npm run dev
```

### 📖 Documentación

- 📄 [Idea Definitiva del Proyecto](docs/IDEA_DEFINITIVA.md)
- 📊 [Análisis Gartner Magic Quadrant](docs/ANALISIS_GARTNER_MQ.md)
- 📋 [Matriz Competitiva](docs/MATRIZ_COMPETITIVA.md)

### 👥 Roles de Usuario

- **Estudiante** → Chat con IA adaptativa, progreso cognitivo, biblioteca de bots
- **Profesor** → Crear bots expertos, ver reportes de estudiantes
- **Experto** → Entrenar bots con conocimiento práctico, compartir

---

*Desarrollado con ❤️ y 🧠 — Febrero 2026*
