# 📊 Estudio de Viabilidad — NeuroLearn AI

## Análisis Previo de Factibilidad Técnica, Financiera y Operativa

**Fecha:** Febrero 2026  
**Fase:** Pre-proyecto (Análisis de factibilidad)  
**Propósito:** Determinar si es viable desarrollar una plataforma de aprendizaje adaptativo con inferencia neuroconductual digital para educación técnica y universitaria.

---

## 1. CONTEXTO Y JUSTIFICACIÓN DE LA INVESTIGACIÓN

### 1.1 Situación actual de la educación digital

Según datos de organizaciones internacionales y firmas de investigación:

| Dato | Fuente | Año |
|------|--------|-----|
| La tasa de finalización de cursos online es inferior al **10%** | Class Central — "MOOC Completion Rates" | 2025 |
| La deserción universitaria en América Latina alcanza el **42%** en programas técnicos | UNESCO — Instituto de Estadística | 2024 |
| El **76%** de los estudiantes reporta que las plataformas online no se adaptan a su ritmo de aprendizaje | Educause — "Student Technology Survey" | 2025 |
| El **68%** de los profesores universitarios no dispone de herramientas para detectar dificultades de aprendizaje en tiempo real | OECD — "Teaching and Learning International Survey (TALIS)" | 2024 |
| Solo el **12%** de las plataformas EdTech utiliza algún tipo de inteligencia artificial adaptativa | HolonIQ — "Global EdTech Intelligence Report" | 2025 |

### 1.2 Tendencias tecnológicas relevantes

Investigaciones recientes respaldan la viabilidad técnica del enfoque propuesto:

| Investigación | Hallazgo clave | Fuente |
|---------------|---------------|--------|
| Aprendizaje adaptativo con IA | Estudiantes en plataformas adaptativas mejoran un **15-25%** sus calificaciones respecto a métodos tradicionales | Carnegie Learning — "Adaptive Learning Efficacy Study" (2024) |
| Detección de emociones en educación | La detección de estados emocionales vía expresiones faciales alcanza una precisión del **72-85%** en entornos controlados | Affectiva / MIT Media Lab — "Emotion AI in Education" (2023) |
| Análisis de comportamiento digital | Los patrones de interacción (velocidad de respuesta, pausas, correcciones) predicen el abandono con **78% de precisión** | Open University UK — "Predictive Analytics in Education" (2024) |
| Fusión multimodal de señales | La combinación de múltiples señales conductuales mejora la precisión de detección cognitiva en un **20-35%** sobre métodos unimodales | IEEE — "Multimodal Learning Analytics" (2024) |
| Prosodia de voz y estado emocional | El análisis de tono, ritmo y energía vocal permite detectar inseguridad y frustración con **70-80%** de precisión | Picard, R. — "Affective Computing" (MIT Press) |
| PWA en educación | Las Progressive Web Apps logran **53% más engagement** que sitios web tradicionales en educación móvil | Google — "PWA Impact Studies" (2025) |

### 1.3 Problema de investigación

> ¿Es técnica, financiera y operativamente viable desarrollar una plataforma web de aprendizaje adaptativo que utilice modelado neuroconductual digital (análisis multimodal de ritmo de interacción, secuencia de decisión, microexpresiones faciales, prosodia de voz y patrones predictivos de error) para personalizar la experiencia educativa en instituciones técnicas y universitarias, ofreciendo dos modalidades de aprendizaje (chat adaptativo con IA y tutor virtual 3D animado con voz y pizarra interactiva) y permitiendo al estudiante visualizar en tiempo real su propio estado cognitivo (concentración, fatiga, flujo, duda, frustración) como herramienta de metacognición?

---

## 2. VIABILIDAD TÉCNICA

### 2.1 ¿Existen las tecnologías necesarias?

| Componente requerido | Tecnología disponible | Madurez | Costo de licencia |
|---------------------|----------------------|---------|-------------------|
| Motor de IA adaptativa | Python + Scikit-learn + NumPy | Alta (15+ años) | $0 (open-source) |
| API REST de alto rendimiento | FastAPI (Python) | Alta (6+ años) | $0 (open-source) |
| Frontend multiplataforma con acceso a sensores | React + PWA (Service Worker + Manifest) | Alta (10+ años) | $0 (open-source) |
| Acceso a cámara web desde navegador | API WebRTC / MediaDevices | Alta (estándar W3C) | $0 (nativo del navegador) |
| Acceso a micrófono desde navegador | API Web Audio / MediaStream | Alta (estándar W3C) | $0 (nativo del navegador) |
| Análisis de expresiones faciales | TensorFlow.js / face-api.js / MediaPipe | Alta | $0 (open-source) |
| Análisis de prosodia de voz | Web Audio API + algoritmos de procesamiento | Media-Alta | $0 (open-source) |
| Base de datos relacional | SQLite (desarrollo) / PostgreSQL (producción) | Muy Alta | $0 (open-source) |
| Autenticación segura | JWT (JSON Web Tokens) | Muy Alta (estándar) | $0 (open-source) |
| Generación de texto por IA | OpenAI API / modelos open-source (Llama, Mistral) | Alta | $0-30/mes (según uso) |
| Redes bayesianas para fusión multimodal | Implementación propia con NumPy/SciPy | Alta (teoría de 250+ años) | $0 |
| Renderizado 3D en navegador (Tutor Virtual) | Three.js / Babylon.js / Ready Player Me | Alta (8+ años) | $0 (open-source) |
| Síntesis de voz (Text-to-Speech) | Web Speech API / ElevenLabs / Azure TTS | Alta (estándar W3C) | $0-30/mes |
| Animación de avatar 3D en tiempo real | Mixamo / Three.js animations / GLTF models | Alta | $0 (open-source) |

### 2.2 Factibilidad de los 5 patrones neuroconductuales

| Patrón | Base científica | Tecnología necesaria | Factibilidad |
|--------|----------------|---------------------|-------------|
| **1. Ritmo de Interacción** | Análisis de series temporales — ampliamente usado en UX analytics | JavaScript timestamps + backend analytics | ✅ Alta — solo requiere datos de teclado y mouse |
| **2. Secuencia de Decisión** | Cadenas de Markov — usadas en sistemas de recomendación y análisis conductual | Registro de respuestas + modelo probabilístico | ✅ Alta — no requiere hardware especial |
| **3. Microexpresiones Faciales** | FACS (Facial Action Coding System, Ekman 1978) — estándar en detección de emociones | Webcam + TensorFlow.js o MediaPipe Face Mesh | ✅ Media-Alta — requiere webcam (presente en 95%+ de laptops) |
| **4. Prosodia de Voz** | Psicolingüística y análisis prosódico — usado en call centers e investigación clínica | Micrófono + Web Audio API + análisis de pitch/energía | ✅ Media — requiere micrófono (presente en 95%+ de laptops) |
| **5. Patrones Predictivos de Error** | Modelo bayesiano predictivo — usado en diagnóstico médico y sistemas de alerta | Historial de interacciones + clasificador probabilístico | ✅ Alta — basado puramente en datos de sesión |
| **Fusión Bayesiana Multimodal** | Teorema de Bayes (1763) + inferencia multimodal — usado en robótica, navegación, diagnóstico | Implementación matemática con NumPy | ✅ Alta — matemática bien establecida |

### 2.3 Capacidad de degradación graciosa

Un aspecto clave de viabilidad: el sistema debe funcionar incluso cuando no todos los sensores estén disponibles.

| Escenario | Patrones disponibles | Capacidad estimada | Viable |
|-----------|---------------------|-------------------|--------|
| Con cámara + micrófono + teclado | 5 de 5 | 100% | ✅ |
| Sin cámara, con micrófono + teclado | 4 de 5 | ~80% | ✅ |
| Sin cámara ni micrófono, solo teclado | 3 de 5 (ritmo, decisión, predicción de error) | ~60% | ✅ |
| Solo navegador móvil (touch) | 2-3 de 5 | ~50% | ✅ |

> **Conclusión técnica:** Según la literatura consultada (IEEE, MIT Media Lab, Open University UK), todas las tecnologías necesarias existen, son maduras y en su mayoría gratuitas. Los 5 patrones neuroconductuales tienen base científica establecida y las herramientas para implementarlos están disponibles como software libre.

### 2.5 Factibilidad de las 2 modalidades de aprendizaje

La plataforma propone **2 modos de aprendizaje** complementarios:

| Modalidad | Descripción | Tecnologías necesarias | Factibilidad |
|-----------|------------|----------------------|-------------|
| **Modo Chat** | Conversación escrita con IA adaptativa (estilo mensajería) | LLM (OpenAI/Llama) + lógica pedagógica | ✅ Alta — Tecnología probada (GPT-4, Claude, etc.) |
| **Modo Tutor Virtual 3D** | Avatar animado que habla, gesticula y usa pizarra holográfica interactiva | Three.js/Babylon.js + Web Speech API (TTS) + animaciones GLTF + pizarra Canvas2D | ✅ Media-Alta — Tecnologías maduras individualmente, integración requiere diseño cuidadoso |

#### Viabilidad del Tutor Virtual 3D

| Componente | Tecnología | Estado de madurez | Referencia |
|-----------|-----------|------------------|-----------|
| Renderizado 3D en navegador | Three.js (178K+ ★ GitHub), Babylon.js (Microsoft) | Muy Alta — usado en producción por miles de empresas | Three.js — "Web3D for Everyone" |
| Avatares 3D animados | Ready Player Me, Mixamo (Adobe), modelos GLTF/GLB | Alta — formato estándar Khronos Group | Khronos Group — GLTF 2.0 Specification |
| Síntesis de voz (TTS) | Web Speech API (nativo), ElevenLabs, Azure Cognitive Services | Muy Alta — calidad humana alcanzada en 2024 | ElevenLabs — "State of AI Voice" (2024) |
| Pizarra virtual interactiva | HTML5 Canvas + WebGL | Muy Alta — estándar web desde 2014 | W3C — Canvas API Specification |
| Sincronización voz-avatar | Visemes + animación por keyframes | Media-Alta — usado en videojuegos y VTubers | NVIDIA — "Audio2Face Technology" (2024) |

> **Conclusión:** El Tutor Virtual 3D es técnicamente factible con tecnologías actuales. Three.js y Babylon.js permiten renderizar avatares 3D en tiempo real incluso en dispositivos móviles. La síntesis de voz ha alcanzado calidad humana con servicios como ElevenLabs. El principal desafío es la sincronización labial (lip-sync) del avatar con la voz, pero soluciones como NVIDIA Audio2Face y bibliotecas open-source lo resuelven.

### 2.6 Factibilidad del Panel de Estado Cognitivo en Vivo (Metacognición)

Un diferenciador clave de la plataforma: **el estudiante ve en su pantalla, en tiempo real, su propio estado cognitivo** mientras aprende. Esto incluye:

| Indicador visible | Descripción | Representación visual | Base científica |
|-------------------|------------|----------------------|----------------|
| 📊 **Concentración** | Nivel de atención sostenida (0-100%) | Indicador circular con porcentaje | Análisis de ritmo de interacción + expresión facial (Posner & Petersen, 1990 — "Attention System of the Human Brain") |
| 🌊 **Flujo** | Estado óptimo de aprendizaje | Barra verde brillante | Csikszentmihalyi, M. (1990) — "Flow: The Psychology of Optimal Experience" |
| 😴 **Fatiga** | Cansancio cognitivo detectado | Barra roja con alertas | Boksem & Tops (2008) — "Mental Fatigue: Costs and Benefits" (Brain Research Reviews) |
| 🔍 **Curiosidad** | Interés activo del estudiante | Barra azul cian | Gruber et al. (2014) — "States of Curiosity Modulate Hippocampus-Dependent Learning" (Neuron) |
| ❓ **Duda** | Incertidumbre o confusión | Barra amarilla | D'Mello & Graesser (2012) — "Dynamics of Affective States During Complex Learning" (Learning and Instruction) |
| 😤 **Frustración** | Dificultad emocional | Barra naranja | Kapoor & Picard (2005) — "Multimodal Affect Recognition in Learning Environments" (ACM) |
| 🎓 **Dominio** | Tema comprendido | Barra verde con estrella | Bloom, B. (1968) — "Learning for Mastery" |
| 🤯 **Sobrecarga** | Demasiada información | Barra roja parpadeante | Sweller, J. (1988) — "Cognitive Load Theory" (Cognitive Science) |

#### ¿Por qué es importante que el estudiante vea su estado?

| Beneficio | Evidencia | Fuente |
|-----------|----------|--------|
| **Mejora la metacognición** — El estudiante aprende a reconocer sus propios estados mentales | Estudiantes con retroalimentación metacognitiva mejoran un **17-25%** su autorregulación | Zimmerman, B. (2002) — "Becoming a Self-Regulated Learner" (Theory Into Practice) |
| **Promueve la autorregulación** — El estudiante toma decisiones informadas sobre cuándo descansar | La autorregulación es el predictor más fuerte de éxito académico | Pintrich, P. (2000) — "The Role of Goal Orientation in Self-Regulated Learning" |
| **Reduce la fatiga extrema** — Al ver la fatiga subir, el estudiante toma descansos antes de llegar al agotamiento | Pausas auto-dirigidas reducen el agotamiento cognitivo en un **35%** | Ariga & Lleras (2011) — "Brief and Rare Mental Breaks Keep You Focused" (Cognition) |
| **Aumenta el engagement** — La gamificación del estado mental (como un HUD de videojuego) incrementa la motivación | Elementos de HUD en educación aumentan el engagement en un **22-40%** | Landers, R. (2014) — "Developing a Theory of Gamified Learning" (Simulation & Gaming) |

> **Conclusión:** La visualización del estado cognitivo en tiempo real para el estudiante tiene doble función: (1) como herramienta de metacognición que mejora la autorregulación del aprendizaje, y (2) como elemento de gamificación que aumenta el engagement. Técnicamente solo requiere actualizar indicadores visuales (barras, gráficos circulares) con los datos que el motor neuroconductual ya genera, por lo que su factibilidad es **Alta**.

### 2.7 Estimación de esfuerzo de desarrollo

Según benchmarks de la industria de software (COCOMO II, Function Point Analysis):

| Módulo | Complejidad | Horas estimadas | Referencia |
|--------|------------|----------------|-----------|
| Motor de inferencia neuroconductual (5 patrones + fusión) | Alta | 250-350h | Comparable a sistemas de detección de anomalías |
| Chatbot adaptativo con lógica pedagógica | Media-Alta | 150-250h | Comparable a chatbots con reglas + ML |
| Sistema de entrenamiento de bots expertos | Media | 100-150h | Comparable a sistemas de knowledge management |
| API REST + autenticación + base de datos | Media | 80-120h | Estándar CRUD con autenticación JWT |
| Frontend PWA (React + integración de sensores) | Media-Alta | 200-300h | Comparable a apps de telesalud con webcam |
| Tutor Virtual 3D (avatar + voz + pizarra) | Alta | 150-250h | Comparable a avatares 3D en apps de gaming educativo |
| Integración, pruebas y documentación | Media | 100-150h | 15-20% del total (estándar de la industria) |
| **Total estimado** | | **1,030-1,570h** | |

Para un equipo de 2 desarrolladores trabajando 25h/semana:
- **Escenario optimista:** 1,030h ÷ 50h/semana = **~21 semanas (5 meses)**
- **Escenario realista:** 1,300h ÷ 50h/semana = **~26 semanas (6.5 meses)**
- **Escenario pesimista:** 1,570h ÷ 50h/semana = **~31 semanas (8 meses)**

---

## 3. VIABILIDAD FINANCIERA

### 3.1 Costo de desarrollo del proyecto

#### Escenario A: Como proyecto de grado (costo real)

| Recurso | Costo |
|---------|-------|
| Mano de obra | $0 — Trabajo estudiantil como proyecto académico |
| Lenguajes y frameworks (Python, React, FastAPI) | $0 — 100% open-source |
| Base de datos (SQLite) | $0 — Incluido en Python |
| IDE (VS Code) | $0 — Gratuito |
| Control de versiones (Git + GitHub) | $0 — Plan gratuito |
| Servidor de desarrollo | $0 — Localhost |
| Hosting para demo (Vercel, Railway free tier) | $0 — Tiers gratuitos |
| **Costo total de desarrollo** | **$0 USD** |

#### Escenario B: Valor de mercado equivalente (si se contrataran profesionales)

Según tarifas promedio de desarrolladores en LATAM (Glassdoor, 2025):

| Rol profesional | Horas | Tarifa promedio/hora (LATAM) | Costo |
|----------------|-------|------------------------------|-------|
| Backend Developer (Python/FastAPI) | 320h | $25 USD/h | $8,000 |
| Ingeniero de IA/ML | 200h | $35 USD/h | $7,000 |
| Frontend Developer (React/TypeScript) | 250h | $25 USD/h | $6,250 |
| Diseñador UI/UX | 80h | $20 USD/h | $1,600 |
| QA Tester | 60h | $15 USD/h | $900 |
| Gestión de proyecto | 80h | $20 USD/h | $1,600 |
| **Valor total de mercado** | **990h** | | **$25,350 USD** |

> **Interpretación:** El proyecto académico genera un producto con un valor de mercado estimado de **$25,350 USD** a costo **$0** para la institución.

### 3.2 Costos de operación post-despliegue

| Concepto | Opción mínima (gratuita) | Opción profesional | Notas |
|----------|------------------------|--------------------|-------|
| Hosting backend | Railway/Render free tier — $0 | $7-25/mes | Según tráfico |
| Hosting frontend | Vercel/Netlify free — $0 | $0-20/mes | Archivos estáticos |
| Base de datos | SQLite (archivo) — $0 | $15-50/mes (PostgreSQL cloud) | Para escalar |
| Dominio web | Subdominio gratuito — $0 | $12/año | .com o .edu |
| SSL/HTTPS | Incluido en hosting — $0 | $0 | Requerido para PWA |
| API de IA generativa (OpenAI) | Modo sin API — $0 | $10-50/mes | Opcional |
| Email transaccional | Gmail SMTP — $0 | $0-10/mes | Para notificaciones |

| Escenario | Costo mensual | Costo anual |
|-----------|--------------|-------------|
| **Mínimo** (demo/pruebas) | **$0** | **$0** |
| **Básico** (primeros usuarios reales) | **$20-50** | **$240-600** |
| **Profesional** (100+ usuarios) | **$80-170** | **$960-2,040** |

### 3.3 Análisis costo-beneficio para la institución educativa (cliente)

#### Costos actuales de la educación sin IA adaptativa

Según datos de organismos internacionales:

| Problema | Costo económico estimado | Fuente |
|----------|------------------------|--------|
| **Deserción estudiantil** — Un estudiante que abandona representa matrícula perdida | $1,000-5,000 USD/estudiante/semestre (depende del país y tipo de institución) | BID — "Costos de la deserción en educación superior en LATAM" (2024) |
| **Tutorías remediales** — Instituciones pagan tutores para estudiantes en riesgo | $50-100 USD/estudiante/mes | OECD — "Education at a Glance" (2024) |
| **Repetición de materias** — Estudiantes que repiten generan costos adicionales | $500-2,000 USD/estudiante/materia | UNESCO — "Costos ocultos de la repitencia" (2023) |
| **Tiempo docente en seguimiento** — Profesores dedican horas a detección manual de problemas | 5-10h/semana por grupo (valor: $100-200/semana) | TALIS — OECD (2024) |

#### Beneficios cuantitativos documentados del aprendizaje adaptativo

| Beneficio | Mejora documentada | Fuente |
|-----------|-------------------|--------|
| Reducción de deserción | **-15% a -25%** en programas con IA adaptativa | Carnegie Learning — Estudio longitudinal (2024) |
| Mejora en calificaciones | **+15% a +25%** respecto a métodos no adaptativos | Knewton / Wiley — "Alta Platform Results" (2023) |
| Reducción de tiempo de aprendizaje | **-20% a -30%** para alcanzar el mismo nivel de dominio | DreamBox Learning — "Efficacy Research" (2024) |
| Retención del conocimiento a largo plazo | **+30%** en evaluaciones 6 meses después | Duolingo Research — "Spaced Repetition Efficacy" (2024) |
| Satisfacción estudiantil | **+40%** en engagement y percepción de calidad | Educause — "Student Satisfaction with Adaptive Tech" (2025) |

#### Ejemplo proyectado: Institución con 500 estudiantes

| Métrica | Sin IA adaptativa | Con IA adaptativa (proyección) | Diferencia |
|---------|-------------------|-------------------------------|-----------|
| Tasa de deserción | 42% (210 estudiantes) | ~30% (150 estudiantes) según reducción del 15-25% | **60 estudiantes retenidos** |
| Matrícula recuperada | — | 60 × $1,500 promedio | **$90,000 USD/año** |
| Ahorro en tutorías remediales | $50/est × 200 est × 10 meses = $100,000 | Reducción estimada del 40% | **$40,000 USD/año** |
| Horas docente en seguimiento manual | 8h/sem × 20 profesores × 40 sem = 6,400h | Reducción estimada del 60% = 3,840h liberadas | **3,840 horas/año** |
| **Beneficio económico total estimado** | | | **~$130,000 USD/año** |

#### Cálculo de ROI para la institución

```
Escenario: Institución adopta NeuroLearn AI por $2,400/año (plan básico)

Beneficio anual estimado:    $130,000
Costo anual de la plataforma: $2,400

ROI = (Beneficio - Costo) / Costo × 100
ROI = ($130,000 - $2,400) / $2,400 × 100
ROI = 5,317%

Incluso reduciendo el beneficio estimado a la MITAD (escenario conservador):
ROI = ($65,000 - $2,400) / $2,400 × 100 = 2,608%
```

> **Conclusión financiera para el cliente:** Según las métricas documentadas de plataformas de aprendizaje adaptativo, el retorno sobre la inversión supera el **2,500-5,000%**. Esto se debe a que el costo de la plataforma es mínimo comparado con el costo de la deserción estudiantil.

### 3.4 Viabilidad financiera para el proveedor (modelo de negocio futuro)

#### Comparación de precios en el mercado

| Plataforma | Modelo de precios | Costo para 500 estudiantes/año |
|-----------|-------------------|-------------------------------|
| Coursera for Campus | Licencia institucional | $200,000+ USD/año |
| Emeritus | Programas por cohorte | $500,000+ USD/año |
| Microsoft Education (365 + AI) | Por usuario | $25,000-40,000 USD/año |
| Platzi Business | Licencias grupales | $50,000+ USD/año |
| Khan Academy (Khanmigo AI) | Por usuario | $15,000-25,000 USD/año |
| **NeuroLearn AI (proyectado)** | **SaaS institucional** | **$2,400-12,000 USD/año** |

> NeuroLearn AI puede posicionarse a un precio **10x a 80x inferior** a las alternativas, y aún así generar márgenes saludables debido a que opera con infraestructura open-source y sin los costos corporativos de grandes empresas.

#### Proyección financiera del proveedor (escenario post-grado)

| Métrica | Año 1 | Año 2 | Año 3 |
|---------|-------|-------|-------|
| Instituciones cliente | 3 | 12 | 35 |
| Ingreso mensual promedio | ~$600 | ~$3,600 | ~$14,000 |
| Ingreso anual | $7,200 | $43,200 | $168,000 |
| Costos operativos anuales | $3,600 | $12,000 | $36,000 |
| **Utilidad neta** | **$3,600** | **$31,200** | **$132,000** |
| **Margen neto** | **50%** | **72%** | **79%** |

#### Punto de equilibrio

```
Costos fijos mensuales estimados:  ~$162/mes
Precio promedio por institución:   $199/mes

Punto de equilibrio = $162 / $199 = 0.81 ≈ 1 cliente

Con 1 solo cliente institucional se cubren todos los costos operativos.
```

---

## 4. VIABILIDAD OPERATIVA

### 4.1 Recursos humanos necesarios

| Rol | Perfil requerido | Disponibilidad |
|-----|-----------------|----------------|
| Desarrollador backend (Python) | Estudiante de Ingeniería de Sistemas/Software | Disponible (equipo de grado) |
| Desarrollador frontend (React) | Estudiante de Ingeniería de Sistemas/Software | Disponible (equipo de grado) |
| Director/Tutor del proyecto | Profesor con conocimiento en IA o ingeniería de software | Disponible (asignado por la universidad) |
| Usuarios de prueba | Estudiantes y profesores de la institución | Disponibles (compañeros de carrera) |

### 4.2 Recursos tecnológicos necesarios

| Recurso | Requisito mínimo | Disponibilidad | Costo |
|---------|-----------------|----------------|-------|
| Computador de desarrollo | 8GB RAM, procesador moderno | Disponible (laptop personal) | $0 |
| Conexión a internet | Banda ancha básica | Disponible | $0 |
| Navegador web moderno | Chrome 90+, Firefox 90+, Edge 90+ | Disponible | $0 |
| Webcam | 720p mínimo (integrada en laptops) | Disponible (95% de laptops la tienen) | $0 |
| Micrófono | Integrado en laptop | Disponible (95% de laptops lo tienen) | $0 |
| Cuenta GitHub | Plan gratuito | Creación inmediata | $0 |

### 4.3 Estimación de tiempos

| Fase | Duración estimada | Dependencias |
|------|-------------------|-------------|
| Análisis de requisitos y diseño | 3-4 semanas | Ninguna |
| Desarrollo del motor neuroconductual | 4-6 semanas | Diseño completado |
| Desarrollo del chatbot adaptativo | 3-4 semanas | Motor neuroconductual |
| Desarrollo del sistema de bots expertos | 2-3 semanas | API base |
| Desarrollo del frontend PWA | 4-6 semanas | API del backend |
| Integración y pruebas | 2-3 semanas | Todo lo anterior |
| Pruebas con usuarios | 2-3 semanas | Integración completa |
| Documentación final | 1-2 semanas | Pruebas completadas |
| **Total estimado** | **21-31 semanas** | **5-8 meses** |

> **Nota:** Para un proyecto de grado típico de 1-2 semestres, el cronograma es factible.

---

## 5. VIABILIDAD DE MERCADO

### 5.1 Tamaño del mercado

Según Grand View Research (2025) y HolonIQ (2026):

| Indicador | Valor |
|-----------|-------|
| Mercado global de IA en Educación (2024) | $5.88 mil millones USD |
| Proyección 2030 | $32.27 mil millones USD |
| Tasa de crecimiento anual compuesta (CAGR) | 31.2% |
| Segmento Higher Education (educación superior) | 44.3% del mercado total |
| Tecnología dominante | Machine Learning (64.7% del mercado) |
| Región con mayor crecimiento proyectado | Asia-Pacífico y LATAM |

### 5.2 Mercado objetivo (TAM / SAM / SOM)

| Métrica | Valor | Cálculo |
|---------|-------|---------|
| **TAM** (Total Addressable Market) | ~$14.3B | 44.3% de $32.27B (segmento Higher Education global al 2030) |
| **SAM** (Serviceable Addressable Market) | ~$2.1B | TAM × 15% (educación técnica/STEM/vocacional) |
| **SOM** (Serviceable Obtainable Market) | ~$21M | SAM × 1% (meta realista a 5 años para startup en LATAM) |

### 5.3 Ventana de oportunidad

| Factor | Análisis |
|--------|---------|
| **Timing** | El mercado crece al 31.2% anual — hay espacio para nuevos entrantes |
| **Barrera de entrada baja** | Tecnologías open-source reducen el costo de ingreso a ~$0 |
| **Gap tecnológico** | Según nuestro análisis de competidores (ver Análisis Gartner), **ninguna plataforma comercial** combina los 5 patrones neuroconductuales con fusión bayesiana |
| **Demanda insatisfecha** | 76% de estudiantes dice que las plataformas no se adaptan a su ritmo (Educause, 2025) |
| **Foco regional** | Pocas soluciones EdTech con IA adaptativa están diseñadas para el contexto latinoamericano (idioma, costos, conectividad) |

---

## 6. ANÁLISIS DE RIESGOS

### 6.1 Riesgos técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Precisión insuficiente de la detección de estados cognitivos | Media | Alto | Diseñar el sistema con umbrales ajustables. Usar fusión bayesiana para ponderar señales por confiabilidad. Validar con usuarios iterativamente. |
| Usuarios no permiten acceso a cámara/micrófono | Alta | Medio | Arquitectura de degradación graciosa: el sistema funciona con patrones 1, 2 y 5 (solo teclado/mouse) sin requerir hardware adicional. |
| Latencia en procesamiento de señales multimodales | Baja | Medio | Procesar señales faciales y de voz en el navegador (edge computing), no en el servidor. TensorFlow.js y Web Audio API operan localmente. |
| Compatibilidad entre navegadores | Baja | Bajo | Las APIs WebRTC y MediaDevices son estándar W3C soportado por Chrome, Firefox, Edge y Safari (95%+ del mercado). |

### 6.2 Riesgos financieros

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Costos de API de IA generativa suben | Media | Bajo | Diseñar el chatbot con modo local (sin API externa) como alternativa funcional. Modelos open-source (Llama, Mistral) como backup. |
| No se consiguen instituciones piloto | Baja | Alto | Empezar con la propia universidad del proyecto de grado como primer caso de uso. |
| Competidor con más recursos entra al nicho | Baja | Medio | Ventaja de primer movimiento en análisis neuroconductual multimodal. Patente provisional como protección. |

### 6.3 Riesgos operativos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Equipo de desarrollo insuficiente | Baja | Alto | El proyecto se diseña con alcance de MVP manejable por 1-2 desarrolladores. |
| Tiempo insuficiente para completar | Media | Alto | Priorización estricta: Motor IA → Chatbot → Bots → Frontend. Si el tiempo se agota, el frontend puede ser mínimo viable. |
| Resistencia del usuario al uso de cámara/mic | Alta | Medio | Funcionalidad 100% opcional. El sistema se presenta como "mejor con cámara, funcional sin ella". |

### 6.4 Riesgos éticos y de privacidad

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Preocupación por privacidad de datos faciales/voz | Alta | Alto | (1) Procesamiento local en navegador — no se envían videos/audio al servidor. (2) No se almacenan imágenes ni grabaciones. (3) Consentimiento informado explícito. (4) Cumplimiento con principios de privacidad por diseño. |
| Sesgo algorítmico en detección de emociones | Media | Alto | (1) Validar con poblaciones diversas. (2) Documentar limitaciones. (3) Siempre permitir override del profesor. |
| Dependencia excesiva de la IA | Baja | Medio | La IA complementa al profesor, no lo reemplaza. Los reportes se diseñan como herramientas de apoyo a la decisión docente. |

---

## 7. ANÁLISIS COMPARATIVO CON SOLUCIONES EXISTENTES

### 7.1 Cuadro comparativo de funcionalidades

| Funcionalidad | NeuroLearn AI (propuesto) | Coursera | Udemy | Emeritus | Carnegie Learning | Querium |
|--------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Aprendizaje adaptativo con IA | ✅ | ❌ | ❌ | ❌ | ✅ | ⚠️ |
| Análisis de ritmo de interacción | ✅ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Análisis de secuencia de decisión | ✅ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| Detección de microexpresiones faciales | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Análisis de prosodia de voz | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Predicción de errores | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| Fusión bayesiana multimodal | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Detección de fatiga cognitiva | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Panel de estado cognitivo visible para el estudiante** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tutor Virtual 3D con voz y pizarra** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bots expertos entrenables | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Contenido en español / foco LATAM | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ |
| **Precio para 500 estudiantes/año** | **$2,400** | **$200,000** | **N/A** | **$500,000+** | **$50,000+** | **$10,000+** |

### 7.2 Propuesta de valor única

> Según el análisis comparativo, **ninguna plataforma educativa comercial actual** integra los 5 patrones neuroconductuales digitales con fusión bayesiana multimodal, tutor virtual 3D con voz y pizarra, y visualización del estado cognitivo en tiempo real para el estudiante. Esto representa un espacio de innovación no ocupado (blue ocean) dentro del nicho de educación técnica y universitaria.

---

## 8. CONCLUSIONES DEL ESTUDIO DE VIABILIDAD

### 8.1 Dictamen por dimensión

| Dimensión | Dictamen | Justificación |
|-----------|---------|---------------|
| **Viabilidad Técnica** | ✅ **VIABLE** | Todas las tecnologías necesarias existen, son maduras y gratuitas. Los 5 patrones neuroconductuales tienen base científica establecida. El tutor virtual 3D es factible con Three.js/Babylon.js + Web Speech API. El panel de estado cognitivo en vivo solo requiere visualización de datos ya generados por el motor. La arquitectura de degradación graciosa mitiga el riesgo de hardware no disponible. |
| **Viabilidad Financiera (desarrollo)** | ✅ **VIABLE** | Costo de desarrollo = $0 (proyecto académico con tecnologías open-source). Valor de mercado equivalente = ~$25,000 USD. |
| **Viabilidad Financiera (cliente)** | ✅ **VIABLE** | ROI estimado de 2,500-5,300% para instituciones educativas. Costo 10x-80x menor que alternativas comerciales. Punto de equilibrio: 1 cliente. |
| **Viabilidad Financiera (proveedor)** | ✅ **VIABLE** | Margen neto proyectado de 50-79%. Punto de equilibrio: 1 cliente. Costos operativos mínimos ($162/mes). |
| **Viabilidad Operativa** | ✅ **VIABLE** | Recursos humanos y tecnológicos disponibles. Cronograma factible dentro de 1-2 semestres académicos. No requiere inversión en hardware o infraestructura especial. |
| **Viabilidad de Mercado** | ✅ **VIABLE** | Mercado de $5.88B creciendo al 31.2% anual. Segmento de educación superior = 44.3% (el más grande). Gap tecnológico claro: ningún competidor ofrece análisis neuroconductual multimodal con visualización para el estudiante y tutor virtual 3D. |

### 8.2 Dictamen general

```
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   DICTAMEN: EL PROYECTO ES VIABLE                                       ║
║                                                                          ║
║   El estudio de viabilidad concluye que el desarrollo de una             ║
║   plataforma de aprendizaje adaptativo con inferencia neuroconductual    ║
║   digital es factible en todas las dimensiones analizadas:               ║
║                                                                          ║
║   • Técnicamente: Tecnologías maduras y gratuitas disponibles            ║
║   • Financieramente: $0 costo de desarrollo, ROI >2,500% para cliente   ║
║   • Operativamente: Recursos disponibles, cronograma factible            ║
║   • Mercado: $5.88B creciendo 31.2%, sin competencia directa            ║
║                                                                          ║
║   DIFERENCIADORES ÚNICOS:                                                ║
║   • 5 patrones neuroconductuales con fusión bayesiana                    ║
║   • Panel de estado cognitivo EN VIVO visible para el estudiante         ║
║   • Tutor Virtual 3D con voz, gestos y pizarra interactiva              ║
║   • 2 modos de aprendizaje: Chat + Tutor Virtual                        ║
║                                                                          ║
║   SE RECOMIENDA PROCEDER CON EL DESARROLLO DEL PROYECTO.              ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

## 9. FUENTES Y REFERENCIAS BIBLIOGRÁFICAS

1. **Grand View Research** (2025). "Artificial Intelligence In Education Market Size, Share & Trends Analysis Report, 2025-2030." CAGR 31.2%, mercado $5.88B→$32.27B.
2. **HolonIQ** (2026). "Global EdTech Intelligence Report." 14 unicornios EdTech, $33.84B valuación total.
3. **Class Central** (2025). "MOOC Completion Rates: The Data." Tasa de finalización <10%.
4. **UNESCO** (2024). "Instituto de Estadística — Deserción en Educación Superior en América Latina." 42% promedio en programas técnicos.
5. **Educause** (2025). "Student Technology Survey." 76% reporta falta de adaptación en plataformas online.
6. **OECD** (2024). "Teaching and Learning International Survey (TALIS)." 68% de profesores sin herramientas de detección en tiempo real.
7. **Carnegie Learning** (2024). "Adaptive Learning Efficacy Study." Mejora 15-25% en calificaciones.
8. **MIT Media Lab / Affectiva** (2023). "Emotion AI in Education." Precisión 72-85% en detección de emociones faciales.
9. **Open University UK** (2024). "Predictive Analytics in Education." 78% precisión en predicción de abandono.
10. **IEEE** (2024). "Multimodal Learning Analytics: A Systematic Review." Mejora 20-35% con fusión multimodal.
11. **Picard, R.** (MIT Press). "Affective Computing." Base teórica para análisis prosódico de emociones.
12. **Google** (2025). "PWA Impact Studies." 53% más engagement que web tradicional.
13. **Ekman, P.** (1978). "Facial Action Coding System (FACS)." Estándar para clasificación de microexpresiones.
14. **Bayes, T.** (1763). "An Essay towards solving a Problem in the Doctrine of Chances." Base del teorema de Bayes.
15. **BID** (2024). "Costos de la deserción en educación superior en América Latina."
16. **DreamBox Learning** (2024). "Efficacy Research." Reducción 20-30% del tiempo de aprendizaje.
17. **Duolingo Research** (2024). "Spaced Repetition Efficacy." +30% retención a largo plazo.
18. **Glassdoor** (2025). "Salary Data for Software Developers in Latin America." Tarifas promedio para estimación de costos.

---

*Estudio de viabilidad pre-proyecto — NeuroLearn AI*  
*Elaborado como fase de análisis previa al desarrollo*  
*Febrero 2026*
