# 🧠 NeuroLearn AI — Idea Definitiva del Proyecto de Grado

## Desarrollo de una aplicación híbrida con IA para el fortalecimiento de habilidades transversales académicas en estudiantes de secundaria en Colombia

**Fecha:** Febrero 2026  
**Tipo de Aplicación:** PWA (Progressive Web App)  
**Alcance:** Proyecto de Grado — MVP funcional  

---

## 📌 1. TÍTULO DEL PROYECTO

> **"Desarrollo de una aplicación híbrida con IA para el fortalecimiento de habilidades transversales académicas en estudiantes de secundaria en Colombia"**

### 1.1 Subtítulo técnico

> *NeuroLearn AI: Plataforma adaptativa con inferencia neuroconductual digital para las 5 competencias evaluadas en las pruebas Saber 11 (ICFES)*

---

## 📋 2. PLANTEAMIENTO DEL PROBLEMA

### 2.1 Descripción del Problema

En la educación técnica y universitaria actual, los estudiantes enfrentan múltiples desafíos:

1. **Aprendizaje genérico:** Las plataformas existentes (Coursera, Udemy, edX) ofrecen el mismo contenido a todos los estudiantes, sin adaptarse al ritmo individual de aprendizaje.

2. **Sin detección del estado cognitivo:** Los profesores no pueden saber en tiempo real si un estudiante está fatigado, frustrado, sobrecargado o en estado de flujo durante el aprendizaje digital.

3. **Pérdida de conocimiento experto:** Profesionales y expertos en áreas técnicas no tienen una herramienta sencilla para transferir su conocimiento práctico de forma estructurada y escalable.

4. **Baja retención:** Sin adaptación personalizada, la tasa de abandono en cursos online supera el 90% (datos de Class Central, 2025).

5. **Brecha tecnológica en LATAM:** Las universidades técnicas de Latinoamérica carecen de herramientas de IA accesibles y asequibles para mejorar la calidad educativa.

### 2.2 Pregunta de Investigación

> ¿Cómo puede una aplicación híbrida basada en inteligencia artificial adaptativa y modelado neuroconductual digital fortalecer las habilidades transversales académicas — pensamiento lógico-matemático, comprensión lectora, inglés comunicativo, competencias ciudadanas y pensamiento científico — en estudiantes de secundaria en Colombia?

---

## 🎯 3. OBJETIVOS

### 3.1 Objetivo General

Desarrollar una aplicación híbrida (PWA) que utilice inteligencia artificial adaptativa y modelado neuroconductual digital para fortalecer las habilidades transversales académicas — pensamiento lógico-matemático, comprensión lectora, inglés comunicativo, competencias ciudadanas y pensamiento científico — en estudiantes de secundaria en Colombia, con enfoque en las competencias evaluadas por las pruebas Saber 11 (ICFES).

### 3.2 Objetivos Específicos

1. **Diseñar e implementar un motor de inferencia neuroconductual** que analice 5 patrones de comportamiento digital (ritmo de interacción, secuencia de decisión, microexpresiones faciales, prosodia de voz y patrones predictivos de error) para inferir el estado cognitivo del usuario en tiempo real.

2. **Desarrollar un chatbot adaptativo** que ajuste automáticamente la dificultad, estilo de enseñanza y tipo de contenido según el estado cognitivo detectado del estudiante.

3. **Crear un sistema de entrenamiento de bots expertos** que permita a profesores y profesionales transferir su conocimiento práctico de forma estructurada (pasos, advertencias, reglas, escenarios, preguntas frecuentes).

4. **Implementar la plataforma como PWA** accesible desde cualquier dispositivo con navegador, instalable sin tienda de aplicaciones, y funcional con conexión intermitente.

5. **Validar la efectividad del sistema** mediante pruebas con usuarios reales en un entorno educativo técnico o universitario.

---

## 💡 4. JUSTIFICACIÓN

### 4.1 Relevancia Tecnológica
- El mercado de IA en educación crece a un **CAGR del 31.2%**, de $5.88B (2025) a $32.27B (2030).
- La fusión bayesiana multimodal de señales neuroconductuales es un enfoque innovador no implementado en plataformas educativas comerciales actuales.

### 4.2 Relevancia Social
- Democratiza el acceso a educación personalizada de calidad para universidades técnicas en LATAM.
- Reduce la tasa de abandono estudiantil al detectar señales de fatiga y frustración.
- Preserva el conocimiento experto de profesionales experimentados.

### 4.3 Relevancia Académica
- Integra conceptos de IA (machine learning, NLP), neurociencia cognitiva, pedagogía adaptativa e ingeniería de software.
- Genera datos de investigación sobre patrones de aprendizaje digital.

### 4.4 Diferenciador
Ninguna plataforma educativa actual combina los 5 patrones neuroconductuales con fusión bayesiana para adaptar la enseñanza. Este enfoque multimodal es el diferenciador clave de NeuroLearn AI.

---

## 📦 5. ALCANCE DEL MVP (Proyecto de Grado)

### ✅ 5.1 Lo que SÍ incluye el MVP

| Módulo | Funcionalidad | Estado |
|--------|--------------|--------|
| **Autenticación** | Registro, login, JWT, perfil de usuario | ✅ Backend listo |
| **Motor Neuroconductual** | 5 patrones + fusión bayesiana + 8 estados cognitivos | ✅ Backend listo (1,386 líneas) |
| **Chatbot Adaptativo** | Enseñar, reforzar, quiz, simplificar, pausar, motivar | ✅ Backend listo (1,016 líneas) |
| **Bot Experto** | Crear, entrenar (pasos, reglas, escenarios, QA), compartir | ✅ Backend listo (482 líneas + API) |
| **Dashboard Estudiante** | Chat IA, ver progreso, estado cognitivo, recomendaciones | 🔨 Frontend pendiente |
| **Dashboard Profesor** | Ver reportes de estudiantes, crear contenido, gestionar bots | 🔨 Frontend pendiente |
| **Dashboard Experto** | Entrenar bots, ver estadísticas de uso, compartir | 🔨 Frontend pendiente |
| **PWA** | Instalable, responsive, funciona offline parcial | 🔨 Frontend pendiente |

### ❌ 5.2 Lo que NO incluye el MVP (Fase futura)

| Funcionalidad | Razón de exclusión |
|---------------|-------------------|
| Red social (follow, likes, feed) | Complejidad adicional fuera del alcance académico |
| Gamificación (badges, rankings) | Fase de escalamiento comercial |
| Marketplace de bots (venta) | Requiere pasarela de pagos |
| Planes de suscripción | Modelo de negocio post-grado |
| App nativa (Android/iOS) | PWA cubre esta necesidad |
| Integración LMS (Moodle, Canvas) | Fase de expansión empresarial |

---

## 🏗️ 6. ARQUITECTURA DEL SISTEMA

### 6.1 Diagrama General

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO (Navegador Web)                   │
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │ Cámara   │  │Micrófono │  │ Teclado  │  │  Mouse   │  │
│   │(Webcam)  │  │  (Voz)   │  │(Typing)  │  │(Clicks)  │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│        │              │             │              │        │
│   ┌────▼──────────────▼─────────────▼──────────────▼────┐   │
│   │              FRONTEND — React PWA                    │   │
│   │                                                      │   │
│   │  ┌─────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│   │  │ Login/  │  │Dashboard │  │  Chat IA          │   │   │
│   │  │Registro │  │(3 roles) │  │  Adaptativo       │   │   │
│   │  └─────────┘  └──────────┘  └──────────────────┘   │   │
│   │  ┌─────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│   │  │Reportes │  │ Entrenar │  │  Biblioteca       │   │   │
│   │  │Progreso │  │   Bots   │  │  de Bots          │   │   │
│   │  └─────────┘  └──────────┘  └──────────────────┘   │   │
│   │                                                      │   │
│   │  Service Worker (Offline) + Manifest (Instalable)    │   │
│   └──────────────────────┬───────────────────────────────┘   │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTPS / REST API
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   BACKEND — FastAPI (Python)                  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                    API REST v1                         │    │
│  │  /auth (register, login, me)                          │    │
│  │  /chat (start, message, stats, end)                   │    │
│  │  /bots (create, train, personality, finalize, list)   │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                          │                                    │
│  ┌───────────────────────▼──────────────────────────────┐    │
│  │              CAPA DE INTELIGENCIA ARTIFICIAL           │    │
│  │                                                        │    │
│  │  ┌─────────────────────────────────────────────────┐  │    │
│  │  │     Motor Neuroconductual (1,386 líneas)        │  │    │
│  │  │                                                  │  │    │
│  │  │  Patrón 1: Ritmo de Interacción                 │  │    │
│  │  │  Patrón 2: Secuencia de Decisión                │  │    │
│  │  │  Patrón 3: Microexpresiones Faciales            │  │    │
│  │  │  Patrón 4: Prosodia de Voz                      │  │    │
│  │  │  Patrón 5: Patrones Predictivos de Error        │  │    │
│  │  │                                                  │  │    │
│  │  │  ──► Fusión Bayesiana Multimodal ──►            │  │    │
│  │  │  ──► Estado Cognitivo Inferido                  │  │    │
│  │  └─────────────────────────────────────────────────┘  │    │
│  │                                                        │    │
│  │  ┌────────────────────┐  ┌───────────────────────┐   │    │
│  │  │ Chatbot Adaptativo │  │ Entrenador de Bot     │   │    │
│  │  │ (1,016 líneas)     │  │ Experto (482 líneas)  │   │    │
│  │  │                    │  │                        │   │    │
│  │  │ - Enseñar          │  │ - Pasos               │   │    │
│  │  │ - Reforzar         │  │ - Advertencias         │   │    │
│  │  │ - Quiz             │  │ - Reglas               │   │    │
│  │  │ - Simplificar      │  │ - Escenarios           │   │    │
│  │  │ - Pausar           │  │ - Q&A                  │   │    │
│  │  │ - Motivar          │  │ - Personalidad         │   │    │
│  │  └────────────────────┘  └───────────────────────┘   │    │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              BASE DE DATOS — SQLite                    │    │
│  │                                                        │    │
│  │  users            : Usuarios + perfil cognitivo        │    │
│  │  learning_sessions: Sesiones de aprendizaje            │    │
│  │  cognitive_events : Eventos neuroconductuales          │    │
│  │  chat_messages    : Historial de mensajes              │    │
│  │  expert_bots      : Bots expertos configurados         │    │
│  │  bot_training_data: Datos de entrenamiento             │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Flujo de Datos Neuroconductual

```
ESTUDIANTE interactúa con el CHATBOT
         │
         ├──► Tiempo de respuesta (ms)          ─┐
         ├──► Velocidad de escritura (CPM)       │
         ├──► Número de correcciones             │── Patrón 1 & 2
         ├──► Pausas antes de responder          │
         ├──► Patrones de clic/navegación       ─┘
         │
         ├──► Webcam → Microexpresiones          ── Patrón 3
         ├──► Micrófono → Prosodia de voz        ── Patrón 4
         │
         └──► Historial de errores               ── Patrón 5
                    │
                    ▼
         ┌─────────────────────┐
         │  FUSIÓN BAYESIANA   │
         │    MULTIMODAL       │
         └────────┬────────────┘
                  │
                  ▼
         Estado Cognitivo Inferido:
         ┌────────────────────────┐
         │ • Normal    • Fatiga   │
         │ • Sobrecarga • Duda    │
         │ • Dominio   • Flujo   │
         │ • Frustración          │
         │ • Curiosidad           │
         └────────┬───────────────┘
                  │
                  ▼
         CHATBOT SE ADAPTA:
         ┌─────────────────────────────┐
         │ Fatiga → Recomendar pausa   │
         │ Duda → Simplificar          │
         │ Flujo → Aumentar dificultad │
         │ Frustración → Motivar       │
         │ Dominio → Desafiar          │
         │ Sobrecarga → Reducir ritmo  │
         └─────────────────────────────┘
```

---

## 👥 7. ROLES DE USUARIO

### 7.1 Estudiante

| Función | Descripción |
|---------|-------------|
| Registrarse/Login | Crear cuenta y acceder |
| Iniciar sesión de aprendizaje | Elegir tema y comenzar con el chatbot |
| Chatear con IA | Aprender de forma adaptativa |
| Ver progreso | Estado cognitivo, dificultad, conceptos dominados |
| Aprender con bots expertos | Usar bots creados por profesores/expertos |
| Ver reportes | Historial de sesiones, tiempo, rendimiento |

**Flujo principal del estudiante:**
```
Login → Elegir tema/bot → Chatbot IA → Aprendizaje adaptativo
                                         ↓
                              Motor Neuroconductual detecta:
                              "Estudiante fatigado"
                                         ↓
                              Chatbot: "Has trabajado muy bien.
                              ¿Quieres tomar un descanso de 5 min?"
```

### 7.2 Profesor

| Función | Descripción |
|---------|-------------|
| Registrarse/Login | Crear cuenta con rol de experto |
| Crear bots expertos | Entrenar bots con su conocimiento |
| Ver reportes de estudiantes | Progreso cognitivo de su grupo |
| Compartir bots | Hacer públicos los bots para sus estudiantes |
| Gestionar contenido | Editar pasos, reglas, escenarios de sus bots |

**Flujo principal del profesor:**
```
Login → Crear Bot "Redes de Computadoras"
      → Agregar pasos del tema
      → Definir advertencias ("¡Nunca olvidar la máscara de subred!")
      → Crear escenarios de simulación
      → Agregar preguntas frecuentes
      → Publicar para sus estudiantes
```

### 7.3 Experto (Bot Creator)

| Función | Descripción |
|---------|-------------|
| Entrenar bot | Definir personalidad, pasos, reglas, escenarios |
| Configurar personalidad | Estilo de enseñanza (estricto, balanceado, motivador) |
| Agregar conocimiento | Pasos, advertencias, tips, Q&A, contexto |
| Ver métricas del bot | Cuántos lo usan, calificación, efectividad |
| Compartir | Hacer el bot público o limitado |

---

## 🔧 8. TECNOLOGÍAS

### 8.1 Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| **Frontend** | React.js | 18+ | PWA, componentes reactivos, ecosistema maduro |
| **Frontend** | TypeScript | 5+ | Tipado estático, menos errores |
| **Estilos** | Tailwind CSS | 3+ | Utility-first, rápido prototipado |
| **Backend** | Python | 3.11 | Ecosistema de IA/ML más robusto |
| **API** | FastAPI | 0.104 | Async, auto-documentación, validación |
| **ORM** | SQLAlchemy | 2.0 | Estándar de Python, flexible |
| **BD** | SQLite | 3 | Desarrollo/MVP sin infraestructura |
| **Auth** | JWT (python-jose) | - | Stateless, escalable |
| **IA/ML** | Scikit-learn | 1.3 | Clasificadores, procesamiento |
| **IA/ML** | NumPy | 1.26 | Cálculos numéricos, matrices |
| **IA Generativa** | OpenAI API | 1.6 | Generación de respuestas (opcional) |
| **Validación** | Pydantic | 2.5 | Schemas, validación automática |

### 8.2 ¿Por qué PWA?

| Ventaja | Detalle |
|---------|---------|
| **Acceso a sensores** | Cámara (webcam) y micrófono para patrones 3 y 4 |
| **Instalable** | Se instala como app nativa sin tienda |
| **Multiplataforma** | Funciona en Windows, Mac, Linux, Android, iOS |
| **Un solo código** | React sirve para web y "app" instalada |
| **Offline parcial** | Service Worker cachea recursos estáticos |
| **Bajo costo** | No requiere cuenta de desarrollador en tiendas |
| **Ideal para LATAM** | Funciona con internet intermitente |

---

## 🗄️ 9. MODELO DE DATOS

### 9.1 Entidades Principales

```
┌──────────────┐     ┌────────────────────┐     ┌──────────────┐
│    User      │     │  LearningSession   │     │  ExpertBot   │
├──────────────┤     ├────────────────────┤     ├──────────────┤
│ id           │◄────│ user_id            │     │ id           │
│ username     │     │ bot_id             │────►│ creator_id   │──► User
│ email        │     │ topic              │     │ name         │
│ password     │     │ started_at         │     │ description  │
│ full_name    │     │ ended_at           │     │ category     │
│ is_expert    │     │ current_difficulty │     │ personality  │
│ cognitive_   │     │ total_interactions │     │ knowledge_   │
│   profile    │     │ correct_responses  │     │   base       │
│ created_at   │     │ errors_count       │     │ is_public    │
└──────┬───────┘     │ avg_response_time  │     │ total_users  │
       │             │ last_cognitive_    │     │ avg_rating   │
       │             │   state            │     │ system_prompt│
       │             │ cognitive_state_   │     └──────┬───────┘
       │             │   history          │            │
       │             └────────┬───────────┘            │
       │                      │                        │
       │             ┌────────▼───────────┐   ┌───────▼────────┐
       │             │  CognitiveEvent    │   │BotTrainingData │
       │             ├────────────────────┤   ├────────────────┤
       └────────────►│ user_id            │   │ bot_id         │
                     │ session_id         │   │ data_type      │
                     │ event_type         │   │ content        │
                     │ response_time_ms   │   │ order_index    │
                     │ typing_speed_cpm   │   │ is_critical    │
                     │ error_rate         │   └────────────────┘
                     │ correction_count   │
                     │ inferred_state     │
                     └────────────────────┘
```

### 9.2 Estados Cognitivos del Sistema

| Estado | Descripción | Acción del Chatbot |
|--------|-------------|-------------------|
| **Normal** | Concentración base | Continuar normalmente |
| **Fatiga** | Deterioro progresivo detectado | Recomendar pausa, simplificar |
| **Sobrecarga** | Exceso de información/complejidad | Reducir ritmo, resumir |
| **Duda** | Incertidumbre en respuestas | Reforzar, dar ejemplos |
| **Dominio** | Alto nivel de comprensión | Aumentar dificultad, desafiar |
| **Flujo** | Estado óptimo de aprendizaje | Mantener ritmo, no interrumpir |
| **Frustración** | Estado emocional negativo | Motivar, cambiar enfoque |
| **Curiosidad** | Exploración activa | Expandir tema, profundizar |

---

## 🔌 10. API REST — ENDPOINTS

### 10.1 Autenticación (`/api/v1/auth`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/register` | Registrar nuevo usuario |
| POST | `/login` | Iniciar sesión → Token JWT |
| GET | `/me` | Perfil del usuario autenticado |

### 10.2 Chat Adaptativo (`/api/v1/chat`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/start` | Iniciar sesión de aprendizaje |
| POST | `/message` | Enviar mensaje + métricas conductuales |
| GET | `/stats` | Estadísticas de la sesión actual |
| POST | `/end` | Finalizar sesión |

### 10.3 Bot Experto (`/api/v1/bots`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/create` | Crear nuevo bot |
| POST | `/{id}/personality` | Configurar personalidad |
| POST | `/{id}/steps` | Agregar pasos de proceso |
| POST | `/{id}/warnings` | Agregar advertencias |
| POST | `/{id}/scenarios` | Agregar escenarios |
| POST | `/{id}/qa` | Agregar preguntas/respuestas |
| POST | `/{id}/finalize` | Finalizar entrenamiento |
| GET | `/list` | Listar bots disponibles |

---

## 🖥️ 11. INTERFACES DE USUARIO (Vistas del Frontend)

### 11.1 Pantallas Principales

| # | Pantalla | Descripción |
|---|----------|-------------|
| 1 | **Landing/Login** | Página de bienvenida + formulario de login/registro |
| 2 | **Dashboard Estudiante** | Vista principal del estudiante con sus sesiones y progreso |
| 3 | **Chat IA** | Interfaz de chat con el chatbot adaptativo |
| 4 | **Progreso Cognitivo** | Gráficas del estado cognitivo, métricas, historial |
| 5 | **Biblioteca de Bots** | Lista de bots expertos disponibles para aprender |
| 6 | **Dashboard Profesor** | Gestión de estudiantes y bots |
| 7 | **Entrenar Bot** | Formulario guiado para crear un bot experto |
| 8 | **Reportes** | Estadísticas detalladas de estudiantes/bots |
| 9 | **Perfil** | Datos del usuario y configuración |

### 11.2 Wireframe — Chat IA (Pantalla principal)

```
┌────────────────────────────────────────────────────┐
│  🧠 NeuroLearn AI          [Perfil] [🔔] [⚙️]    │
├────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📊 Estado: Flujo ● Dificultad: Media       │   │
│  │ 🎯 Tema: Redes de Computadoras             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                              │   │
│  │  🤖 NeuroLearn:                              │   │
│  │  "Una subred es una división lógica de       │   │
│  │   una red IP. ¿Sabes para qué se usa        │   │
│  │   la máscara de subred?"                     │   │
│  │                                              │   │
│  │  👤 Tú:                                      │   │
│  │  "Creo que es para dividir la red en         │   │
│  │   partes más pequeñas..."                    │   │
│  │                                              │   │
│  │  🤖 NeuroLearn:                              │   │
│  │  "¡Exacto! 🎉 La máscara de subred          │   │
│  │   determina qué parte de la IP es la red     │   │
│  │   y qué parte es el host. Te voy a poner    │   │
│  │   un ejemplo práctico..."                    │   │
│  │                                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────┐  ┌────────┐   │
│  │ Escribe tu respuesta...         │  │ Enviar │   │
│  └─────────────────────────────────┘  └────────┘   │
│                                                     │
│  [📷 Cámara] [🎤 Voz] [📊 Mi Progreso]            │
└────────────────────────────────────────────────────┘
```

---

## 📊 12. LOS 5 PATRONES NEUROCONDUCTUALES DIGITALES

Este es el **corazón científico** del proyecto y lo que lo diferencia de cualquier otra plataforma.

### Patrón 1: Ritmo de Interacción
| Aspecto | Detalle |
|---------|---------|
| **Qué mide** | Velocidad de respuesta, pausas, aceleraciones |
| **Datos** | Timestamps de cada interacción, intervalos entre mensajes |
| **Detecta** | Fatiga (respuestas cada vez más lentas), Flujo (ritmo constante) |
| **Técnica** | Análisis de serie temporal con ventana deslizante |

### Patrón 2: Secuencia de Decisión
| Aspecto | Detalle |
|---------|---------|
| **Qué mide** | Calidad y consistencia de las respuestas del usuario |
| **Datos** | Respuestas correctas/incorrectas, cambios de opción |
| **Detecta** | Duda (cambios frecuentes), Dominio (consistencia alta) |
| **Técnica** | Cadenas de Markov para modelar transiciones |

### Patrón 3: Microexpresiones Faciales
| Aspecto | Detalle |
|---------|---------|
| **Qué mide** | Expresiones faciales en tiempo real via webcam |
| **Datos** | Landmarks faciales, AUs (Action Units) |
| **Detecta** | Frustración, confusión, aburrimiento, concentración |
| **Técnica** | Clasificación de emociones por geometría facial |

### Patrón 4: Prosodia de Voz
| Aspecto | Detalle |
|---------|---------|
| **Qué mide** | Tono, ritmo, velocidad y energía del habla |
| **Datos** | Pitch (F0), energía, tasa de habla, pausas |
| **Detecta** | Inseguridad (voz temblorosa), confianza (tono firme) |
| **Técnica** | Análisis espectral de características prosódicas |

### Patrón 5: Patrones Predictivos de Error
| Aspecto | Detalle |
|---------|---------|
| **Qué mide** | Probabilidad de que el usuario cometa un error |
| **Datos** | Historial de errores, contexto actual, dificultad |
| **Detecta** | Sobrecarga inminente, áreas débiles, conceptos frágiles |
| **Técnica** | Modelo predictivo bayesiano con historial acumulado |

### Fusión Bayesiana Multimodal
```
P(Estado | Evidencia) = P(E₁|Estado) × P(E₂|Estado) × ... × P(E₅|Estado) × P(Estado)
                        ───────────────────────────────────────────────────────────────
                                              P(Evidencia)

Donde:
  E₁ = Ritmo de Interacción
  E₂ = Secuencia de Decisión
  E₃ = Microexpresión Facial
  E₄ = Prosodia de Voz
  E₅ = Patrón Predictivo de Error
```

La fusión bayesiana permite que si no hay cámara o micrófono, el sistema sigue funcionando con los patrones disponibles (1, 2 y 5) sin perder capacidad de inferencia.

---

## 📅 13. CRONOGRAMA SUGERIDO

| Fase | Duración | Actividades |
|------|----------|-------------|
| **Fase 1: Análisis** | 2 semanas | Requisitos, casos de uso, revisión bibliográfica |
| **Fase 2: Diseño** | 2 semanas | Arquitectura, modelo de datos, wireframes, prototipo UI |
| **Fase 3: Backend** | 3 semanas | API REST, motor neuroconductual, chatbot, bots expertos |
| **Fase 4: Frontend** | 4 semanas | React PWA, dashboards, chat UI, reportes, integración |
| **Fase 5: Integración** | 2 semanas | Conectar frontend-backend, pruebas de integración |
| **Fase 6: Pruebas** | 2 semanas | Pruebas con usuarios, ajustes, corrección de bugs |
| **Fase 7: Documentación** | 1 semana | Manual de usuario, documentación técnica, presentación |
| **Total** | **~16 semanas** | **4 meses aproximadamente** |

> **Nota:** El backend (Fase 3) ya está implementado en su mayor parte, lo que reduce significativamente el tiempo total del proyecto.

---

## 📚 14. MARCO TEÓRICO (Temas Clave)

| Área | Conceptos |
|------|-----------|
| **Inteligencia Artificial** | Machine Learning, NLP, Redes Bayesianas, Clasificación |
| **Neurociencia Cognitiva** | Carga cognitiva, atención, fatiga mental, estados de flujo |
| **Pedagogía** | Aprendizaje adaptativo, zona de desarrollo próximo (Vygotsky), scaffolding |
| **Ingeniería de Software** | PWA, API REST, arquitectura cliente-servidor, patrones de diseño |
| **HCI** | Interacción humano-computadora, detección de emociones, interfaces adaptativas |
| **Análisis de Datos** | Series temporales, análisis conductual, métricas de engagement |

---

## 📐 15. METODOLOGÍA

**Metodología de desarrollo:** Ágil — Scrum adaptado

| Elemento | Detalle |
|----------|---------|
| **Sprints** | 2 semanas cada uno |
| **Roles** | Desarrollador(es) + Tutor como Product Owner |
| **Herramientas** | Git (control de versiones), VS Code (IDE), SQLite Browser |
| **Testing** | Pruebas unitarias (pytest), pruebas de integración, pruebas de usuario |
| **Documentación** | Progresiva durante cada sprint |

---

## 🎯 16. RESULTADOS ESPERADOS

1. **Plataforma funcional** (PWA) con los 3 módulos principales operativos.
2. **Motor neuroconductual validado** con datos de al menos 10-20 usuarios reales.
3. **Evidencia de adaptación** — demostrar que el chatbot cambia su comportamiento según el estado cognitivo detectado.
4. **Al menos 3 bots expertos** creados por profesores/expertos reales.
5. **Documentación técnica completa** y manual de usuario.
6. **Métricas de satisfacción** de usuarios piloto.

---

## 📊 17. INDICADORES DE ÉXITO

| Indicador | Meta |
|-----------|------|
| Precisión de detección de estado cognitivo | > 70% |
| Tasa de adaptación correcta del chatbot | > 75% |
| Satisfacción del usuario (encuesta 1-5) | > 3.5/5 |
| Tiempo promedio de sesión | > 15 minutos |
| Bots expertos creados exitosamente | ≥ 3 |
| Usuarios de prueba | ≥ 10 |

---

## 🧪 18. PLAN DE VALIDACIÓN

| Fase | Método | Participantes |
|------|--------|---------------|
| **Alfa** | Pruebas internas, testing funcional | Desarrolladores |
| **Beta cerrada** | Prueba con grupo pequeño | 5-10 estudiantes de la universidad |
| **Beta abierta** | Prueba con grupo más amplio | 10-20 estudiantes + 2-3 profesores |
| **Evaluación** | Encuestas + análisis de datos | Todos los participantes |

---

## 📝 19. ESTRUCTURA DEL DOCUMENTO DE GRADO

```
1. Introducción
2. Planteamiento del Problema
3. Justificación
4. Objetivos (General y Específicos)
5. Marco Teórico
   5.1 Inteligencia Artificial en Educación
   5.2 Modelado Neuroconductual Digital
   5.3 Aprendizaje Adaptativo
   5.4 Progressive Web Apps
6. Estado del Arte (Análisis Competitivo / Gartner)
7. Metodología
8. Análisis y Diseño
   8.1 Requisitos Funcionales y No Funcionales
   8.2 Casos de Uso
   8.3 Arquitectura del Sistema
   8.4 Modelo de Datos
   8.5 Diseño de Interfaces
9. Implementación
   9.1 Motor Neuroconductual
   9.2 Chatbot Adaptativo
   9.3 Sistema de Bot Experto
   9.4 Frontend PWA
10. Pruebas y Resultados
11. Conclusiones y Recomendaciones
12. Trabajos Futuros
13. Referencias Bibliográficas
14. Anexos
```

---

## 📁 20. ESTRUCTURA DEL PROYECTO (Código)

```
proyectog/
├── backend/                        # ✅ IMPLEMENTADO
│   ├── app/
│   │   ├── ai/
│   │   │   ├── chatbot/
│   │   │   │   └── adaptive_chatbot.py    (1,016 líneas)
│   │   │   ├── cognitive/
│   │   │   │   └── neuroconductual_engine.py (1,386 líneas)
│   │   │   └── expert_bot/
│   │   │       ├── trainer.py             (482 líneas)
│   │   │       └── persistence.py
│   │   ├── api/
│   │   │   ├── auth.py                    (Autenticación JWT)
│   │   │   ├── chat.py                    (Chat adaptativo)
│   │   │   └── expert_bot.py              (Bot experto)
│   │   ├── core/
│   │   │   └── config.py                  (Configuración central)
│   │   ├── db/
│   │   │   └── database.py                (SQLAlchemy + SQLite)
│   │   ├── models/
│   │   │   ├── user.py                    (Usuario + perfil cognitivo)
│   │   │   ├── learning.py                (Sesiones + eventos)
│   │   │   └── expert_bot.py              (Bot + datos entrenamiento)
│   │   ├── schemas/
│   │   │   └── schemas.py                 (Pydantic validation)
│   │   └── main.py                        (FastAPI entry point)
│   ├── requirements.txt
│   └── neurolearn.db
│
├── frontend/                       # 🔨 POR CONSTRUIR
│   ├── public/
│   │   ├── manifest.json              (PWA manifest)
│   │   └── service-worker.js          (Offline support)
│   ├── src/
│   │   ├── components/                (Componentes React)
│   │   ├── pages/                     (Vistas/Pantallas)
│   │   ├── services/                  (Llamadas a API)
│   │   ├── hooks/                     (Custom hooks)
│   │   ├── context/                   (Estado global)
│   │   └── App.tsx                    (Router principal)
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                           # 📄 DOCUMENTACIÓN
│   ├── IDEA_DEFINITIVA.md             (Este documento)
│   ├── ANALISIS_GARTNER_MQ.md        (Análisis competitivo)
│   └── MATRIZ_COMPETITIVA.md         (Matriz de características)
│
├── scripts/                        # 🛠️ UTILIDADES
│   └── generar_cuadrante_gartner.py   (Generador de gráficos)
│
└── README.md                       # Presentación del proyecto
```

---

## ✅ 21. RESUMEN EJECUTIVO

| Aspecto | Valor |
|---------|-------|
| **Nombre** | NeuroLearn AI |
| **Tipo** | PWA (Progressive Web App) |
| **Problema** | Educación digital genérica, sin adaptación cognitiva |
| **Solución** | IA adaptativa + modelado neuroconductual de 5 patrones |
| **Usuarios** | Estudiantes, profesores y expertos técnicos/universitarios |
| **Tecnologías** | React, TypeScript, FastAPI, Python, SQLite, Scikit-learn |
| **Diferenciador** | Fusión bayesiana multimodal de señales neuroconductuales |
| **Código backend** | ~2,884 líneas de IA ya implementadas |
| **Estado** | Backend completo, Frontend pendiente |
| **Duración estimada** | ~16 semanas (reducido porque el backend ya existe) |
| **Nicho** | Educación técnica y universitaria en LATAM |

---

> **Este documento es la guía maestra del proyecto de grado NeuroLearn AI. Todo lo aquí definido es el alcance comprometido para la entrega final.**
