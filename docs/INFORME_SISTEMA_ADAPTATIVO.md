# 🔬 Informe Técnico — Sistema Neurodigital Adaptativo de NeuroLearn AI

**Fecha:** sesión de auditoría e implementación
**Alcance:** Núcleo diferencial de la plataforma (los 5 patrones + Student Model + Motor de Adaptación Pedagógica + memoria de conversaciones)

---

## 1. Resumen ejecutivo

NeuroLearn AI **no era** un "ChatGPT con interfaz educativa": la base ya capturaba señales reales de cámara, micrófono y teclado, persistía eventos y adaptaba el system prompt según el estado cognitivo. Sin embargo, la **adaptación vivía dentro del prompt** y no existía un **Modelo del Estudiante persistente y dinámico**, ni **memoria de conversaciones** (tipo ChatGPT), ni un **Motor de Adaptación Pedagógica separado del LLM**.

Esta auditoría confirmó lo que era real y lo que era simulado, y construyó la capa faltante que convierte la personalización en **acumulativa y entre-seciones**.

---

## 2. Qué estaba implementado (REAL)

- **Captura de señales reales (frontend):**
  - **Teclado (P1/P2):** `useBehavioralMetrics.ts` mide `response_time_ms`, `typing_speed_cpm`, `corrections`, `typing_bursts`, `pause_before_ms` con timestamps reales del evento.
  - **Facial (P3):** `useFacialDetection.ts` procesa píxeles reales de la cámara (luminancia, movimiento, parpadeo, gaze) vía canvas 64×48.
  - **Voz (P4):** `useVoiceProsody.ts` usa Web Audio API real (RMS, centroide espectral, tremor, energía).
  - **Permisos/privacidad:** botones on/off reales para cámara y mic; si se deniega o no hay hardware, **no se envían datos inventados** (condicional en `ChatPage.tsx:302,321`).
- **Backend:** `neuroconductual_engine.py` (motor multimodal con baselines científicos referenciados), persistencia real a `cognitive_session_state`, `learning_sessions`, `cognitive_events`, `chat_messages`, `quiz_history`. El `AIManager` (Groq→Gemini) genera respuestas reales.
- **Dashboard (P1/P2/P5):** `CognitiveDashboard.tsx` muestra "—"/"Datos insuficientes" cuando falta el dato; **no inventa porcentajes**.

## 3. Qué estaba SIMULADO / FALSO (confirmado por auditoría)

| # | Elemento | Lugar | Naturaleza |
|---|---|---|---|
| 1 | `confidence=0.8` fijo emitido aunque el análisis falló | `chat.py:1140` | Valor inventado |
| 2 | `emotional_state = "inferido_por_voz"` | `neuroconductual_engine.py:1716` | Etiqueta emocional falsa (la prosodia mide ritmo/energía, NO emoción) |
| 3 | Frontend `?? 0.5` en engagement/atención | `ChatPage.tsx:894,896`, `LiveModeView.tsx:120,248,253,260,265` | Fabrican 50% si falta el dato |
| 4 | Defaults faciales `attention 0.5 / blink 17 / conf 0.5` inyectados | `chat.py:917-921` | Se trataban como señal real cuando el front no envió nada |
| 5 | Sin `source`/confianza honesta por señal; la "fusión bayesiana" era mezcla ponderada | motor | Documentación vs. implementación discrepantes |
| 6 | Sin Student Model persistente por habilidad | — | Falta arquitectura |
| 7 | Sin conversaciones ni memoria entre chats | — | Falta arquitectura |

`random`/`mock` **no existían** en producción (solo demo y decoración visual). La "fábrica" eran los *fallbacks* hardcodeados anteriores.

## 4. Qué corregí (componentes modificados)

### Backend (nuevos)
- `app/ai/adaptive/student_model.py` — modelos de dominio puros: `StudentModel`, `SkillMastery`, `LearningState`, `TeachingStrategy`. Regla: **no se inventa nada**; funciones *build/update* reciben solo eventos reales.
- `app/ai/adaptive/adaptation_engine.py` — **`PedagogicalAdaptationEngine`**, determinista y sin BD, separado del LLM: `StudentModel → estrategia → LLM`. Respeta umbrales de confianza (`CONF_IGNORE=0.40`, `CONF_SECONDARY=0.70`); decide dificultad, guía, ejemplos, repetición, cambio de estrategia, recuperación de base, ejercicios, pistas.
- `app/services/student_model_service.py` — `StudentModelService`: deriva el modelo **solo de datos reales de BD** (`student_mastery`, `quiz_history`, `cognitive_session_state`, `learning_state`, `student_memory`) y lo **actualiza tras cada interacción** (`record_interaction`, `save_episodic_memory`).
- `app/services/llm_context.py` — construye el bloque de contexto del LLM sin enviar historial completo: **estrategia + memoria relevante (episódica/semántica) + continuidad + señales disponibles**.
- `app/models/adaptive.py` — tablas `student_mastery`, `learning_state`, `student_memory`, `conversations`, `conversation_messages` (modelos SQLAlchemy).
- `app/api/conversations.py` — CRUD de conversaciones: listar, crear, recuperar (con mensajes), renombrar, eliminar.
- `migrations/applied/005_adaptive_student_model.sql` — migración SQL idempotente de las tablas nuevas.

### Backend (modificados)
- `app/api/chat.py`:
  - `send_message` acepta `conversation_id`; recupera el `StudentModel`, ejecuta el motor pedagógico, inyecta la estrategia en el system prompt y **persiste mensajes en la conversación**.
  - Nueva lógica `_persist_adaptive_state` (actualiza mastery + estado + memoria episódica tras el veredicto real del chat).
  - `_infer_subject`, `_available_signals` (solo señales reales).
  - `confidence` ya **no es 0.8 fijo**: sale del análisis real o de la confianza de la estrategia.
  - `start_session` guarda la bienvenida en la conversación.
- `app/ai/cognitive/neuroconductual_engine.py`: eliminado el `emotional_state="inferido_por_voz"` falso (la prosodia no infiere emociones).
- `app/schemas/schemas.py`: `conversation_id` en `ChatMessageRequest`/`StartSessionRequest` + schemas de conversaciones.
- `app/main.py`: registra router de conversaciones y registra modelos adaptativos para `create_all`.

### Frontend (modificados)
- `pages/student/ChatPage.tsx`: envía `conversation_id` en `/chat/start` y `/chat/message`; crea conversación al iniciar (si no existe); **panel de historial de conversaciones** (listar/crear nuevа/continuar/eliminar); carga mensajes al seleccionar una conversación. Eliminados los `?? 0.5`.
- `components/LiveModeView.tsx`: engagement/atención muestran "—"/"Sin datos suficientes" en vez de inventar 50%.

## 5. Cómo funciona cada patrón

1. **Facial (P3):** el navegador captura la cámara → el hook calcula atención/gaze/parpadeo → solo si el stream está activo se envía `facial_data` → `chat.py` lo convierte en `FacialData` si hay valores reales → influye en el análisis multimodal. Si cámara off → **no se emite ningún dato facial**.
2. **Voz (P4):** idem con Web Audio → `voice_data` solo si el mic está activo.
3. **Teclado (P1/P2):** métricas reales de keystrokes → `BehavioralEvent` → `InteractionRhythmAnalyzer` / `DecisionSequenceAnalyzer`.
4. **Interacción (P5-contexto y clics):** tiempo/rappids, correcciones, pausas y el grafo de sesión.
5. **Rendimiento (P5):** veredictos reales del chat (`chat_grader`) + `quiz_history` + `chat_error_rate` → `ErrorPredictionAnalyzer` → actualiza `student_mastery`.

Todos alimentan el **StudentModel** (nuevo) que el Motor Pedagógico consume.

## 6. Cómo se construye el Student Model

`StudentModelService.load_model()` lee de BD: mastery por habilidad (student_mastery), estado de continuidad (learning_state), memoria episódica/semántica (student_memory), tasa de error reciente del chat. **Si no hay intentos, mastery=0 y evidence=0** (nunca se inventa). Tras cada interacción, `record_interaction()` actualiza intentos/aciertos/racha/weak_concepts/mastery.

## 7. Memoria y recuperación de contexto

- **Memoria de conversación:** `conversation_messages` por `conversation_id`.
- **Memoria episódica/semántica:** `student_memory` (recuerdos auto-contenidos con importance/confidence/source).
- **Memoria entre conversaciones:** el `StudentModel` es transversal a todas las conversaciones; al crear/abrir un chat nuevo se recuperan mastery, debilidades y estado de continuidad **sin copiar el historial previo**.
- **Recuperación eficiente:** `llm_context.py` envía estrategia + memoria resumida pertinente + continuidad + señales disponibles (acotado, no todo el historial).

## 8. Cómo se selecciona la estrategia pedagógica

`PedagogicalAdaptationEngine.decide(model, signals)` → `TeachingStrategy` determinista:
- **Dominio alto** (≥0.80, conf ≥0.4) → más dificultad, autonomía, let-solve-alone.
- **Dominio bajo** (≤0.45) → menor dificultad, guiado, más ejemplos.
- **Errores consecutivos** ≥3 → cambio de estrategia + recuperación de base.
- **Tasa de error del chat** alta → repetir explicación, no quiz.
- **Continuidad** → propone el siguiente paso ya recomendado.
- **Confianza <0.40** → se ignora la señal para decisiones críticas.

## 9. Actualización del modelo tras cada interacción

Al final de `/chat/message`, `_persist_adaptive_state` llama a `record_interaction` (actualiza mastery/estado) y guarda memoria episódica si el veredicto fue incorrecto. El `StudentModel` **evoluciona** con cada interacción y persiste.

## 10. Pruebas ejecutadas y resultados

- `python -m tests.test_adaptive_system` → **12/12 tests, 41/41 checks ✅**
  - Test 1: misma pregunta, 2 perfiles → estrategias distintas (dominio alto vs. bajo).
  - Test 2: 4 errores seguidos → `change_strategy` + prior_recovery.
  - Test 3: abandono → se recupera conversación y mensajes.
  - Test 4: chat nuevo → recupera mastery 0.86 y estado de continuidad.
  - Test 5: cámara off → sin datos faciales.
  - Test 6: mic off → voz unavailable.
  - Test 7: cambio de asignatura → memorias/estados separados por habilidad.
  - Test 8: 4 errores registrados → mastery 0.86→0.75, racha y weak_concept.
  - Test 9: reinicio → modelo reconstruible/persistente.
  - Test 10: conversación completamente nueva → conoce progreso previo (0.86, paso actual, recomendación).
  - Extras: confianza baja → no fuerza decisión crítica; decisión determinista (no random).
- `python -m tests.test_patterns` → **14/14 tests, 36/36 checks ✅** (no roto).
- `tsc -b` (frontend) → **exit 0** (sin errores de tipos).

> Nota: `tests/test_automated.py` falla con `KeyError: 'avg_response_time'` — un **test pre-existente** que referencia una clave de baseline que el motor no usa y que depende de IA/BD en línea; **no está relacionado con los cambios de esta sesión**.

El `vite build` se bloqueó en el entorno por `spawn EPERM` al lanzar el binario nativo `@tailwindcss/oxide` (limitación del sandbox), no por error de código; la compilación TypeScript (`tsc -b`) pasa limpia.

## 11. Limitaciones técnicas reales que permanecen

- **Facial heuristic es crudo:** `useFacialDetection` es procesamiento de imagen por cuadrantes, no detección facial tipo MediaPipe/FaceMesh. Puede dar falsos positivos de "cara/atención". Limpieza: mantenerlo como señal de baja confianza o integrar librería real.
- **`pitch_mean_hz` es un centroide espectral**, no pitch fundamental real (etiqueta "tono" algo engañosa).
- **`filler_words_count=0` fijo en voz** (no hay STT de relleno).
- **AdaptiveChatbot y ServerlessNeuroEngine son código muerto** en producción; el motor real es `MultimodalCognitiveEngine`.
- **StudentModel aún no retro-llena `users.cognitive_profile`** (campo existente sin alimentar).
- La migración y el `create_all` crean las tablas en arranque; en despliegues ya existentes conviene aplicar `005_adaptive_student_model.sql` explícitamente.

## 12. Criterios de aceptación (17→20) — estado

1. ✅ Datos de interacciones reales.
2. ✅ 5 patrones conectados cuando su señal está disponible.
3. ✅ No se inventan señales que no se miden.
4. ✅ Los patrones influyen en decisiones (Motor Pedagógico).
5. ✅ Student Model persistente y dinámico.
6. ✅ Modelo se actualiza tras interacciones.
7. ✅ Historial de chats persistente (conversations + conversation_messages).
8. ✅ Un chat nuevo recupera conocimiento relevante.
9. ✅ Continuidad desde el punto donde quedó (learning_state).
10. ✅ Dos estudiantes distintos → estrategias distintas (tests).
11. ✅ Señales con timestamp/fuente/confianza (eventos y memoria).
12. ✅ Permisos/privacidad: cámara/mic opt-in, sin datos si no hay stream, sin video/audio crudo al backend.
13. ✅ Pruebas que demuestran adaptación.
14. ✔️ Sin mock actuando como dato (quitados los fallbacks; queda heurística facial cruda, documentada).
15. ✅ Señal no disponible → el sistema funciona con las restantes.