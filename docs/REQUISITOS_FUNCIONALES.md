# 📋 Requisitos Funcionales y No Funcionales — NeuroLearn AI# 📋 Requisitos Funcionales — NeuroLearn AI

## Arquitectura SaaS (Business-to-Business-to-Consumer)## Organizados por Actor del Sistema

### Plataforma de Aprendizaje Neuro-Digital con IA Adaptativa

**Fecha:** Mayo 2026  

**Enfoque:** Habilidades Transversales para Bachillerato en Colombia (Saber 11)  **Fecha:** Marzo 2026  

**Modelo de Negocio:** Institucional (Colegios adquieren cupos)  **Versión:** 1.0  

**Enfoque:** 5 Habilidades Transversales para Bachillerato en Colombia  

---

---

## 👤 1. Requisitos Funcionales por Actor del Sistema

## 🎯 CONTEXTO

### 👑 Actor 1: Súper Profesor (Rector / Administrador Institucional)

Son los directivos del colegio que compran la plataforma de NeuroLearn AI y gestionan los cupos.NeuroLearn AI se enfoca en las **5 habilidades transversales** donde los bachilleres colombianos tienen peor rendimiento según las pruebas Saber 11 (ICFES):



| ID | Requisito | Descripción | Prioridad || # | Habilidad Transversal | Problema Saber 11 |

|---|---|---|---||---|---|---|

| **RF-SP01** | **Autenticación Institucional** | El Súper Profesor debe poder iniciar y cerrar sesión mediante un número de documento y una contraseña asignada por el sistema central al momento de la compra. | 🔴 Alta || 1 | Pensamiento Lógico-Matemático | 60% en niveles 1-2 |

| **RF-SP02** | **Gestión de Docentes** | Debe poder crear, editar, bloquear y visualizar cuentas de Profesores, el sistema asignará automáticamente credenciales temporales. | 🔴 Alta || 2 | Comprensión Lectora y Pensamiento Crítico | Baja inferencia y análisis |

| **RF-SP03** | **Gestión de Cupos (Estudiantes)** | Debe poder crear cuentas de Estudiantes validando estrictamente el límite de cupos adquiridos por la institución (ej. bloquear registro si intenta añadir al estudiante 501 teniendo 500 licencias). | 🔴 Alta || 3 | Inglés Comunicativo | 75% en nivel A- (pre-básico) |

| **RF-SP04** | **Carga Masiva de Usuarios** | Debe poder cargar masivamente estudiantes y profesores a través de un archivo estándar (CSV o Excel). | 🟡 Media || 4 | Competencias Ciudadanas y Sociales | No comprenden democracia ni derechos |

| **RF-SP05** | **Dashboard Institucional** | Debe visualizar un panel con métricas generales del colegio: cantidad de licencias usadas vs disponibles, niveles de interacción global y reportes de rendimiento macro en las 5 áreas ICFES. | 🔴 Alta || 5 | Pensamiento Científico | No aplican método científico |



------



### 👨‍🏫 Actor 2: Profesor## 👥 ACTORES DEL SISTEMA

Son los guías tácticos que crean el material, gestionan a los estudiantes dentro del aula y hacen seguimiento.

| Actor | Descripción |

| ID | Requisito | Descripción | Prioridad ||---|---|

|---|---|---|---|| **Estudiante** | Alumno de bachillerato que aprende mediante el tutor IA |

| **RF-PR01** | **Autenticación Segura** | El profesor debe iniciar sesión con su documento y contraseña temporal. El sistema debe forzarle a cambiar la contraseña en su primer ingreso. | 🔴 Alta || **Profesor** | Docente que crea contenido, gestiona estudiantes y evalúa progreso |

| **RF-PR02** | **Gestión de Aulas/Grupos** | Debe poder crear grupos (ej. "Matemáticas 10-A"). El sistema debe generarle automáticamente un Código de Invitación Alfanumérico (ej. "MAT-10A-X89"). | 🔴 Alta || **Sistema IA** | Motor neuroconductual + chatbot adaptativo (actor automatizado) |

| **RF-PR03** | **Creador de Bots Expertos** | Debe poder crear y configurar sus propios Bots de tutoría, especificando un nombre y una personalidad (estricto, socrático, amigable, etc.). | 🔴 Alta || **Administrador** | Gestiona la plataforma, usuarios y contenido global |

| **RF-PR04** | **Carga de Conocimiento (RAG)** | Al crear un Bot, el profesor debe poder subir documentos PDF/TXT para que el Bot restrinja y base sus respuestas estrictamente en ese contenido institucional. | 🔴 Alta |

| **RF-PR05** | **Visibilidad de Bots** | Debe poder configurar si los bots creados son de acceso público (para todo el colegio) o restringidos (solo para alumnos con su código de clase). | 🟡 Media |---

| **RF-PR06** | **Monitoreo de Neuro-Alertas** | Debe tener acceso a un panel de alertas tempranas que le notifique qué estudiantes de sus grupos presentan altos niveles de frustración, fatiga o riesgo de deserción en tiempo real. | 🔴 Alta |

| **RF-PR07** | **Análisis de Progreso** | Debe poder visualizar el progreso individual de calificaciones y mejora académica detallada por cada estudiante. | 🔴 Alta |## 📌 NOMENCLATURA



---- **RF-XX-YYY**: Requisito Funcional - [Actor] - [Número]

  - **ES** = Estudiante

### 🎓 Actor 3: Estudiante  - **PR** = Profesor

El usuario final que interactúa con la plataforma para su propio aprendizaje activo.  - **IA** = Sistema IA

  - **AD** = Administrador

| ID | Requisito | Descripción | Prioridad |- **Prioridad:** 🔴 Alta (MVP) | 🟡 Media | 🟢 Baja (Fase futura)

|---|---|---|---|

| **RF-ES01** | **Autenticación Forzada** | El estudiante debe iniciar sesión con su documento y contraseña temporal, cambiando la misma obligatoriamente en su primer acceso por seguridad. | 🔴 Alta |---

| **RF-ES02** | **Vincular Grupo (Auto-matriculación)** | Debe poder unirse de forma autónoma a la clase de un profesor introduciendo el Código Alfanumérico que este le proporcione. | 🔴 Alta |

| **RF-ES03** | **Perfil Configurable** | Debe poder editar información básica permitida, como subir una foto de perfil o elegir un seudónimo. | 🟡 Media |---

| **RF-ES04** | **Interacción en Neuro-Chat** | Debe poder conversar libre y continuamente con los Bots Expertos de las 5 habilidades transversales mediante comandos de texto naturales (NLP). | 🔴 Alta |

| **RF-ES05** | **Visualización Gamificada** | Debe poder visualizar sus métricas de progreso (Gauges/medidores de fluidez, atención y dominio), así como sus "Días de Racha" en un Dashboard personal y motivador. | 🔴 Alta |## 👨‍🎓 ACTOR 1: ESTUDIANTE

| **RF-ES06** | **Historial y Trazabilidad** | Debe tener la capacidad de leer el historial de chat de las tutorías pasadas para repasar explicaciones emitidas por la IA en sesiones anteriores. | 🟡 Media |

### 1.1 Autenticación y Perfil

---

| ID | Requisito | Descripción | Prioridad |

### 🧠 Actor 4: Sistema Base (Motor Neuroconductual IA / Background)|---|---|---|---|

Operaciones críticas automatizadas en el backend sin intervención humana.| RF-ES-001 | Registro de cuenta | El estudiante debe poder registrarse proporcionando: nombre completo, correo electrónico, nombre de usuario, contraseña y grado escolar. | 🔴 Alta |

| RF-ES-002 | Inicio de sesión | El estudiante debe poder iniciar sesión con su nombre de usuario/correo y contraseña. El sistema genera un token JWT. | 🔴 Alta |

| ID | Requisito | Descripción | Prioridad || RF-ES-003 | Ver perfil | El estudiante debe poder ver su perfil con: datos personales, nivel actual por habilidad, total de sesiones y tiempo acumulado de estudio. | 🔴 Alta |

|---|---|---|---|| RF-ES-004 | Editar perfil | El estudiante debe poder actualizar su nombre, correo y contraseña. | 🟡 Media |

| **RF-SY01** | **Captura de Dinámica de Teclado** | El sistema debe registrar silenciosamente métricas de uso de teclado del estudiante (tiempo de pausa desde que el bot formula pregunta, velocidad en CPM y conteo de retrocesos/correcciones). | 🔴 Alta || RF-ES-005 | Recuperar contraseña | El estudiante debe poder solicitar recuperación de contraseña mediante correo electrónico. | 🟢 Baja |

| **RF-SY02** | **Captura Visual y Sonora** | El sistema debe capturar microexpresiones (cámara) y prosodia (micrófono) del estudiante si éste concede el permiso. | 🟡 Media |

| **RF-SY03** | **Fusión Multimodal Bayesiana** | El Motor Cognitivo debe procesar y unificar los datos conductuales recopilados para inferir un estado neurocognitivo (Ej: Fluidez, Duda, Fatiga). | 🔴 Alta |### 1.2 Selección de Habilidad y Aprendizaje

| **RF-SY04** | **Ajuste Dinámico de Dificultad** | El Chatbot debe recibir una señal del sistema que le obligue a simplificar o complejizar la pedagogía dependiendo del estado de frustración o dominio inferido del estudiante. | 🔴 Alta |

| **RF-SY05** | **Cadena de Intercambio IA (Fallback)** | El AI Manager debe intentar generar respuesta en un proveedor primario (ej. Groq / LLaMA 3) y, si ocurre un Timeout o fallo de API, iterar automáticamente a un proveedor de respaldo (Gemini / Local). | 🔴 Alta || ID | Requisito | Descripción | Prioridad |

|---|---|---|---|

---| RF-ES-010 | Ver catálogo de habilidades | El estudiante debe ver las 5 habilidades transversales disponibles con: nombre, descripción, icono, su nivel actual y progreso en cada una. | 🔴 Alta |

---| RF-ES-011 | Seleccionar habilidad | El estudiante debe poder seleccionar una habilidad para iniciar una sesión de aprendizaje. | 🔴 Alta |

| RF-ES-012 | Ver bots disponibles | El estudiante debe poder ver los bots de tutoría disponibles para la habilidad seleccionada (públicos + los asignados por su profesor). | 🔴 Alta |

## ⚙️ 2. Requisitos No Funcionales (Atributos de Calidad y Restricciones)| RF-ES-013 | Iniciar sesión de aprendizaje | El sistema debe iniciar una sesión con el tutor IA, registrando: usuario, habilidad, bot seleccionado, dificultad inicial y hora de inicio. | 🔴 Alta |

| RF-ES-014 | Recibir diagnóstico inicial | Al iniciar una habilidad por primera vez, el tutor IA debe realizar un diagnóstico breve (3-5 preguntas) para determinar el nivel inicial del estudiante. | 🔴 Alta |

| ID | Requisito | Descripción Técnica y Justificación |

|---|---|---|### 1.3 Interacción con el Tutor IA (Chat Adaptativo)

| **RNF-01** | **Privacidad y Ley Habeas Data** | El sistema **no debe almacenar** videos, fotos, ni audios en bruto del estudiante en el servidor central. Todo procesamiento facial y vocal debe hacerse localmente en la memoria temporal del `Frontend` para extraer únicamente metadatos numéricos (ej. `atención_score = 0.82`), asegurando anonimización y protegiendo a menores de edad bajo las leyes colombianas. |

| **RNF-02** | **Arquitectura Híbrida / PWA** | El aplicativo de interfaz (Frontend) debe empaquetarse como una Progressive Web App (PWA) con diseño plenamente *responsive*. Esto es mandatorio para funcionar correctamente en tablets de educación pública, móviles gama baja y PCs con redes inestables o variadas. || ID | Requisito | Descripción | Prioridad |

| **RNF-03** | **Latencia y Rendimiento en IA** | El tiempo de demora sistémica desde que el usuario oprime "Enviar" hasta que la IA comienza la emisión en "Streaming" de su respuesta no debe exceder de **2.5 segundos** con buena conexión, de lo contrario la ilusión conversacional decae. ||---|---|---|---|

| **RNF-04** | **Segregación de Entidades (Multi-Tenant)** | La Base de Datos (SQLAlchemy) debe estar diseñada logica y restrictivamente para separar Colegios. Ningún Súper Profesor debe poder acceder o alterar por endpoint (API) la base de datos de los estudiantes de otra institución educativa paralela. || RF-ES-020 | Enviar mensajes al tutor | El estudiante debe poder enviar mensajes de texto al tutor IA dentro de la sesión de aprendizaje. | 🔴 Alta |

| **RNF-05** | **Disponibilidad Tolerante a Fallos (99.9%)** | Si el servidor principal de IA o la red local colombiana experimentan bloqueos severos, la interfaz del estudiante nunca debe congelarse o mandar "pantallas blancas"; siempre debe proveer alertas asincrónicas de *conexión perdida* de forma amigable (Offline UI). || RF-ES-021 | Recibir explicaciones | El tutor IA debe explicar los temas paso a paso, con ejemplos, analogías y tips, adaptados al nivel del estudiante. | 🔴 Alta |

| **RNF-06** | **Seguridad Infranqueable de Contraseñas** | Bajo ningún motivo las contraseñas temporales ni reales deben guardarse en texto plano en la Base de Datos SQLite/PostgreSQL. Siempre deben pasar por un cifrado *hash* irreversible supervisado por Passlib/Bcrypt. || RF-ES-022 | Recibir evaluaciones automáticas | Después de explicar un tema, el tutor IA debe evaluar automáticamente al estudiante con preguntas, quizzes o ejercicios prácticos. | 🔴 Alta |

| **RNF-07** | **Restricción de Stack Tecnológico** | El `Backend` debe programarse estrictamente bajo el framework **FastAPI / Python (>=3.11)** para asegurar un manejo nativo excelente a hilos paralelos de IA y Websockets. El `Frontend` debe escribirse en **Vite + React (TypeScript)** para controlar la manipulación rigurosa del flujo DOM durante el enganche de Webcams y canvas asincrónicos. || RF-ES-023 | Recibir retroalimentación inmediata | Tras responder una evaluación, el estudiante debe recibir retroalimentación indicando si su respuesta es correcta/incorrecta y por qué. | 🔴 Alta |

| RF-ES-024 | Recibir refuerzo en debilidades | Cuando el estudiante falla en un tema, el tutor IA debe reforzar ese tema específico antes de avanzar, con explicación simplificada y ejemplos adicionales. | 🔴 Alta |
| RF-ES-025 | Solicitar ejemplos | El estudiante debe poder pedir un ejemplo práctico en cualquier momento escribiendo "ejemplo" o "muéstrame un caso". | 🔴 Alta |
| RF-ES-026 | Solicitar evaluación | El estudiante debe poder pedir que lo evalúen escribiendo "evaluar", "quiz" o "ponme a prueba". | 🔴 Alta |
| RF-ES-027 | Solicitar resumen | El estudiante debe poder pedir un resumen de lo aprendido escribiendo "resumen". | 🟡 Media |
| RF-ES-028 | Recibir recomendación de pausa | Cuando el sistema detecta fatiga cognitiva, el tutor debe recomendar una pausa indicando el tiempo sugerido y que el progreso está guardado. | 🔴 Alta |
| RF-ES-029 | Ver estado cognitivo en tiempo real | El estudiante debe poder ver su estado cognitivo actual (normal, flujo, duda, fatiga, etc.) representado visualmente durante la sesión. | 🟡 Media |
| RF-ES-030 | Cambiar de dificultad manualmente | El estudiante debe poder solicitar subir o bajar la dificultad del contenido en cualquier momento. | 🟡 Media |

### 1.4 Progreso y Estadísticas

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-ES-040 | Ver dashboard de progreso | El estudiante debe ver un dashboard con: nivel por cada habilidad transversal, porcentaje de avance, temas dominados y temas débiles. | 🔴 Alta |
| RF-ES-041 | Ver historial de sesiones | El estudiante debe poder ver el historial de sesiones anteriores con: fecha, duración, habilidad, dificultad alcanzada y estado cognitivo predominante. | 🟡 Media |
| RF-ES-042 | Ver mapa de fortalezas/debilidades | El sistema debe mostrar visualmente las áreas fuertes y débiles del estudiante dentro de cada habilidad transversal. | 🟡 Media |
| RF-ES-043 | Ver tiempo total de estudio | El estudiante debe poder ver su tiempo acumulado de estudio por habilidad y total. | 🟡 Media |
| RF-ES-044 | Ver racha de estudio | El sistema debe mostrar los días consecutivos de estudio del estudiante para motivar consistencia. | 🟢 Baja |

### 1.5 Funcionalidades de Clase (relación con Profesor)

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-ES-050 | Unirse a una clase | El estudiante debe poder unirse a una clase de un profesor mediante un código de invitación. | 🔴 Alta |
| RF-ES-051 | Ver clases inscritas | El estudiante debe poder ver las clases en las que está inscrito con: nombre del profesor, habilidades y bots asignados. | 🔴 Alta |
| RF-ES-052 | Ver bots del profesor | El estudiante debe poder acceder a los bots que su profesor ha asignado para la clase. | 🔴 Alta |
| RF-ES-053 | Salir de una clase | El estudiante debe poder retirarse de una clase en cualquier momento. | 🟢 Baja |

---

---

## 👨‍🏫 ACTOR 2: PROFESOR

### 2.1 Autenticación y Perfil

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-PR-001 | Registro como profesor | El profesor debe poder registrarse indicando: nombre completo, correo, institución educativa, materias que enseña y rol de profesor. | 🔴 Alta |
| RF-PR-002 | Inicio de sesión | El profesor debe poder iniciar sesión con sus credenciales. | 🔴 Alta |
| RF-PR-003 | Ver y editar perfil | El profesor debe poder ver y actualizar su información personal e institucional. | 🟡 Media |

### 2.2 Gestión de Clases

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-PR-010 | Crear clase | El profesor debe poder crear una clase con: nombre, descripción, habilidades transversales asociadas y grado escolar. | 🔴 Alta |
| RF-PR-011 | Generar código de invitación | Al crear una clase, el sistema debe generar un código único que el profesor comparte con sus estudiantes para que se unan. | 🔴 Alta |
| RF-PR-012 | Ver lista de estudiantes | El profesor debe poder ver todos los estudiantes inscritos en cada clase con su estado de actividad. | 🔴 Alta |
| RF-PR-013 | Eliminar estudiante de clase | El profesor debe poder retirar a un estudiante de una clase. | 🟡 Media |
| RF-PR-014 | Editar clase | El profesor debe poder modificar nombre, descripción y habilidades de la clase. | 🟡 Media |
| RF-PR-015 | Eliminar clase | El profesor debe poder eliminar una clase. Los estudiantes son notificados. | 🟢 Baja |

### 2.3 Creación y Gestión de Bots Expertos

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-PR-020 | Crear bot experto | El profesor debe poder crear un bot de tutoría indicando: nombre, descripción, habilidad transversal asociada y categoría. | 🔴 Alta |
| RF-PR-021 | Configurar personalidad del bot | El profesor debe poder definir el estilo de enseñanza del bot: estricto, balanceado o motivador; nivel de detalle: breve, medio o detallado; uso de ejemplos y analogías. | 🔴 Alta |
| RF-PR-022 | Agregar pasos de enseñanza | El profesor debe poder definir los pasos secuenciales del tema, cada uno con: título, descripción, detalle, si es crítico, errores comunes y tips. | 🔴 Alta |
| RF-PR-023 | Agregar advertencias | El profesor debe poder agregar advertencias críticas con: mensaje, severidad (baja, media, alta, crítica) y en qué momento mostrarse. | 🔴 Alta |
| RF-PR-024 | Agregar reglas | El profesor debe poder definir reglas operativas que el bot refuerza durante la enseñanza. | 🟡 Media |
| RF-PR-025 | Agregar preguntas frecuentes (FAQ) | El profesor debe poder crear pares de pregunta/respuesta que el bot usa para responder consultas de los estudiantes con información verificada. | 🔴 Alta |
| RF-PR-026 | Agregar escenarios prácticos | El profesor debe poder crear escenarios de simulación con: situación inicial, pasos correctos, resultado esperado y errores comunes. | 🟡 Media |
| RF-PR-027 | Agregar tips/recomendaciones | El profesor debe poder agregar recomendaciones prácticas que el bot comparte durante la enseñanza. | 🟡 Media |
| RF-PR-028 | Previsualizar bot | El profesor debe poder chatear con su propio bot para probar cómo enseña antes de publicarlo. | 🔴 Alta |
| RF-PR-029 | Publicar/despublicar bot | El profesor debe poder hacer público o privado un bot. Un bot público es visible para todos los estudiantes; uno privado solo para los de su clase. | 🔴 Alta |
| RF-PR-030 | Editar bot existente | El profesor debe poder modificar cualquier componente de un bot ya creado (pasos, FAQs, escenarios, personalidad). | 🟡 Media |
| RF-PR-031 | Eliminar bot | El profesor debe poder eliminar un bot que haya creado. Las sesiones históricas se conservan. | 🟡 Media |
| RF-PR-032 | Asignar bot a clase | El profesor debe poder asignar uno o más bots a una clase específica para que los estudiantes de esa clase lo utilicen. | 🔴 Alta |

### 2.4 Monitoreo y Evaluación de Estudiantes

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-PR-040 | Ver dashboard general de clase | El profesor debe ver un panel resumen con: número de estudiantes activos, promedio de progreso por habilidad, estudiantes con dificultades y distribución de estados cognitivos. | 🔴 Alta |
| RF-PR-041 | Ver progreso individual | El profesor debe poder seleccionar un estudiante y ver: nivel por habilidad, temas dominados, temas débiles, tiempo de estudio y estados cognitivos frecuentes. | 🔴 Alta |
| RF-PR-042 | Ver mapa de calor por habilidad | El sistema debe mostrar un mapa de calor de la clase indicando qué temas/habilidades presentan mayor dificultad colectiva. | 🟡 Media |
| RF-PR-043 | Recibir alertas de estudiantes en riesgo | El sistema debe alertar al profesor cuando un estudiante muestra: más de 3 sesiones con fatiga o frustración predominante, sin actividad por más de 7 días, o tasa de error superior al 60% en una habilidad. | 🟡 Media |
| RF-PR-044 | Ver historial de sesiones del estudiante | El profesor debe poder ver el detalle de las sesiones de un estudiante: fecha, duración, habilidad, dificultad, interacciones, aciertos/errores. | 🟡 Media |
| RF-PR-045 | Ver reporte de estado cognitivo | El profesor debe ver un reporte que muestre la distribución de estados cognitivos de un estudiante a lo largo del tiempo (cuánto tiempo en flujo, fatiga, duda, etc.). | 🟡 Media |
| RF-PR-046 | Exportar reportes | El profesor debe poder exportar los reportes de progreso de su clase en formato PDF o CSV. | 🟢 Baja |
| RF-PR-047 | Ver estadísticas de sus bots | El profesor debe ver métricas de cada bot: usuarios que lo han usado, sesiones totales, calificación promedio y efectividad (% de temas dominados). | 🟡 Media |

### 2.5 Compartir Conocimiento

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-PR-050 | Compartir bot con otros profesores | El profesor debe poder compartir un bot con otro profesor mediante correo o enlace directo. | 🟢 Baja |
| RF-PR-051 | Clonar bot público | El profesor debe poder duplicar un bot público para adaptarlo a sus necesidades. | 🟢 Baja |
| RF-PR-052 | Ver biblioteca de bots públicos | El profesor debe poder explorar bots públicos creados por otros profesores, filtrados por habilidad transversal y calificación. | 🟡 Media |

---

---

## 🤖 ACTOR 3: SISTEMA IA (Motor Neuroconductual + Chatbot Adaptativo)

### 3.1 Análisis Neuroconductual

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-IA-001 | Analizar ritmo de interacción (Patrón 1) | El sistema debe analizar en tiempo real: velocidad de respuesta, aceleración/desaceleración, pausas, velocidad de escritura y microritmos para detectar cambios en el estado cognitivo. | 🔴 Alta |
| RF-IA-002 | Analizar secuencia de decisión (Patrón 2) | El sistema debe registrar y analizar: cambios de respuesta, uso de backspace, tiempo de decisión, profundidad de la respuesta e indicadores de hesitación. | 🔴 Alta |
| RF-IA-003 | Analizar microexpresiones faciales (Patrón 3) | El sistema debe poder analizar (si el estudiante activa la cámara): emoción facial, nivel de atención, tasa de parpadeo, ceño fruncido, dirección de mirada y sonrisa. | 🟡 Media |
| RF-IA-004 | Analizar prosodia de voz (Patrón 4) | El sistema debe poder analizar (si el estudiante activa el micrófono): tono, velocidad del habla, temblor vocal, energía, palabras de relleno y pausas de silencio. | 🟡 Media |
| RF-IA-005 | Generar patrón predictivo de error (Patrón 5) | El sistema debe predecir la probabilidad de error del estudiante basándose en su historial de errores, contexto actual y nivel de dificultad. | 🔴 Alta |
| RF-IA-006 | Realizar fusión bayesiana multimodal | El sistema debe combinar los 5 patrones mediante inferencia bayesiana para inferir el estado cognitivo global. Si no hay cámara o micrófono, debe funcionar solo con los patrones 1, 2 y 5. | 🔴 Alta |
| RF-IA-007 | Determinar estado cognitivo | El sistema debe clasificar al estudiante en uno de 8 estados cognitivos: Normal, Fatiga, Sobrecarga, Duda, Dominio, Flujo, Frustración o Curiosidad, con un nivel de confianza asociado. | 🔴 Alta |

### 3.2 Decisiones Pedagógicas Automáticas

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-IA-010 | Decidir acción pedagógica | Basándose en el estado cognitivo, el sistema debe decidir automáticamente la siguiente acción: enseñar, reforzar, evaluar, simplificar, desafiar, pausar, motivar o redirigir. | 🔴 Alta |
| RF-IA-011 | Adaptar dificultad automáticamente | El sistema debe subir la dificultad cuando detecta Dominio o Flujo sostenido, y bajarla cuando detecta Sobrecarga, Frustración o errores consecutivos. | 🔴 Alta |
| RF-IA-012 | Enseñar secuencialmente | El sistema debe seguir el orden de pasos definido en el bot, avanzando al siguiente solo cuando el estudiante demuestra comprensión del paso actual. | 🔴 Alta |
| RF-IA-013 | Evaluar después de enseñar | Después de explicar un tema/paso, el sistema debe generar automáticamente una evaluación (pregunta o ejercicio) antes de avanzar. | 🔴 Alta |
| RF-IA-014 | Reforzar debilidades detectadas | Cuando el estudiante falla en una evaluación, el sistema debe reforzar ese tema específico con: explicación alternativa simplificada, ejemplo adicional y segunda evaluación. | 🔴 Alta |
| RF-IA-015 | Detectar y actuar ante fatiga | Cuando el estado cognitivo es Fatiga con confianza > 70%, el sistema debe recomendar pausa, guardar el progreso e indicar en qué paso se retomará. | 🔴 Alta |
| RF-IA-016 | Detectar y actuar ante frustración | Cuando el estado cognitivo es Frustración, el sistema debe: cambiar de enfoque, simplificar el tema, motivar al estudiante y/o sugerir un tema diferente temporalmente. | 🔴 Alta |
| RF-IA-017 | Predecir y prevenir errores | Cuando el patrón predictivo indica alta probabilidad de error, el sistema debe reforzar preventivamente el concepto antes de que el estudiante falle. | 🟡 Media |

### 3.3 Generación de Respuestas

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-IA-020 | Buscar en base de conocimiento curada | Ante una pregunta del estudiante, el sistema debe primero buscar la respuesta en las FAQs y contenido del bot (fuente verificada). | 🔴 Alta |
| RF-IA-021 | Generar respuesta con IA generativa (fallback) | Si la pregunta no tiene respuesta en la base de conocimiento, el sistema debe usar una API de IA gratuita (Groq/Gemini) con el contexto del bot como guía. | 🔴 Alta |
| RF-IA-022 | Respuesta local como último recurso | Si las APIs externas fallan o no están disponibles, el sistema debe generar respuestas usando templates locales inteligentes. | 🔴 Alta |
| RF-IA-023 | Adaptar tono y complejidad | Las respuestas deben adaptarse al nivel de dificultad actual: vocabulario más simple para beginner, más técnico para expert. | 🟡 Media |

### 3.4 Registro y Métricas

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-IA-030 | Registrar eventos cognitivos | El sistema debe registrar cada evento de interacción en la base de datos: timestamp, tipo de evento, tiempo de respuesta, velocidad de escritura, correcciones, estado cognitivo inferido y confianza. | 🔴 Alta |
| RF-IA-031 | Registrar mensajes del chat | El sistema debe almacenar cada mensaje (usuario y asistente) con: contenido, timestamp, estado cognitivo al momento del mensaje y acción pedagógica tomada. | 🔴 Alta |
| RF-IA-032 | Actualizar perfil cognitivo del estudiante | Al finalizar cada sesión, el sistema debe actualizar el perfil cognitivo acumulado del estudiante: áreas fuertes, áreas débiles, patrón de fatiga, velocidad de aprendizaje y dificultad preferida. | 🔴 Alta |
| RF-IA-033 | Calcular métricas de sesión | Al terminar una sesión, el sistema debe calcular: total de interacciones, respuestas correctas/incorrectas, tiempo promedio de respuesta, estado cognitivo predominante y nivel de dificultad alcanzado. | 🔴 Alta |
| RF-IA-034 | Generar recomendaciones para el profesor | El sistema debe generar automáticamente recomendaciones por estudiante: qué temas reforzar, si necesita atención personalizada y sugerencias de contenido. | 🟡 Media |

---

---

## 🔧 ACTOR 4: ADMINISTRADOR

### 4.1 Gestión de Usuarios

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-AD-001 | Ver lista de usuarios | El administrador debe poder ver todos los usuarios registrados con filtros por: rol (estudiante/profesor), estado (activo/inactivo) y fecha de registro. | 🟡 Media |
| RF-AD-002 | Activar/desactivar usuario | El administrador debe poder activar o desactivar la cuenta de un usuario. | 🟡 Media |
| RF-AD-003 | Asignar rol de profesor | El administrador debe poder cambiar el rol de un usuario de estudiante a profesor y viceversa. | 🔴 Alta |

### 4.2 Gestión de Contenido

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-AD-010 | Gestionar habilidades transversales | El administrador debe poder agregar, editar o desactivar las habilidades transversales disponibles en la plataforma. | 🟡 Media |
| RF-AD-011 | Moderar bots públicos | El administrador debe poder revisar, aprobar o rechazar bots marcados como públicos para asegurar calidad del contenido. | 🟢 Baja |
| RF-AD-012 | Gestionar bots pre-entrenados | El administrador debe poder cargar y actualizar los bots pre-entrenados que vienen por defecto con la plataforma. | 🟡 Media |

### 4.3 Monitoreo de Plataforma

| ID | Requisito | Descripción | Prioridad |
|---|---|---|---|
| RF-AD-020 | Ver estadísticas globales | El administrador debe ver métricas generales: total de usuarios, sesiones diarias, habilidad más usada, promedio de tiempo de sesión y distribución de estados cognitivos. | 🟢 Baja |
| RF-AD-021 | Ver estado del sistema | El administrador debe ver el estado de salud del sistema: API activa, base de datos, servicios de IA (Groq/Gemini) disponibles. | 🟢 Baja |

---

---

## 📊 RESUMEN DE REQUISITOS

### Conteo por Actor:

| Actor | 🔴 Alta | 🟡 Media | 🟢 Baja | Total |
|---|---|---|---|---|
| **Estudiante** | 15 | 8 | 3 | **26** |
| **Profesor** | 14 | 12 | 4 | **30** |
| **Sistema IA** | 18 | 5 | 0 | **23** |
| **Administrador** | 1 | 4 | 3 | **8** |
| **TOTAL** | **48** | **29** | **10** | **87** |

### Conteo por Prioridad:

| Prioridad | Cantidad | % | Para el MVP |
|---|---|---|---|
| 🔴 Alta (MVP) | 48 | 55% | ✅ Se implementan para la entrega |
| 🟡 Media | 29 | 33% | ⚠️ Se implementan si hay tiempo |
| 🟢 Baja | 10 | 12% | ❌ Trabajo futuro |

### Requisitos por Módulo Funcional:

| Módulo | Requisitos | Actor principal |
|---|---|---|
| Autenticación y perfiles | 10 | Estudiante + Profesor |
| Aprendizaje con tutor IA | 13 | Estudiante |
| Análisis neuroconductual | 7 | Sistema IA |
| Decisiones pedagógicas | 8 | Sistema IA |
| Generación de respuestas | 4 | Sistema IA |
| Gestión de clases | 9 | Profesor + Estudiante |
| Creación de bots | 13 | Profesor |
| Monitoreo y reportes | 12 | Profesor + Sistema IA |
| Administración | 8 | Administrador |

---

## 🔗 MATRIZ DE TRAZABILIDAD (Requisitos → Componentes existentes)

| Requisito | Componente Backend | Estado |
|---|---|---|
| RF-ES-001, RF-ES-002 | `api/auth.py` + `models/user.py` | ✅ Implementado |
| RF-ES-020 a RF-ES-028 | `ai/chatbot/adaptive_chatbot.py` | ✅ Implementado |
| RF-IA-001 a RF-IA-007 | `ai/cognitive/neuroconductual_engine.py` | ✅ Implementado |
| RF-IA-010 a RF-IA-017 | `ai/chatbot/adaptive_chatbot.py` (_decide_action) | ✅ Implementado |
| RF-PR-020 a RF-PR-029 | `ai/expert_bot/trainer.py` + `api/expert_bot.py` | ✅ Implementado |
| RF-IA-030 a RF-IA-033 | `models/learning.py` + `api/chat.py` | ✅ Implementado |
| RF-IA-020 | `adaptive_chatbot.py` (_search_knowledge) | ✅ Implementado |
| RF-IA-021 | Integración Groq/Gemini | ❌ Pendiente |
| RF-PR-010 a RF-PR-015 | API de clases + modelo Clase | ❌ Pendiente |
| RF-PR-040 a RF-PR-047 | API de reportes + dashboard | ❌ Pendiente |
| RF-ES-040 a RF-ES-044 | Frontend dashboard estudiante | ❌ Pendiente |
| Todo el frontend | React PWA | ❌ Pendiente |

---

> **Fuentes de referencia:** Pruebas Saber 11 ICFES (2019-2025), Informes nacionales del ICFES, Lineamientos curriculares MEN Colombia, Estándares Básicos de Competencias MEN.
