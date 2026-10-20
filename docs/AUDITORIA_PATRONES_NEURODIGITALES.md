# Auditoría de los cinco patrones neurodigitales

Fecha: 2026-10-20. Alcance: captura en el navegador, validación, motor
neuroconductual, persistencia, API y visualización de los patrones facial, voz,
teclado, interacción y rendimiento.

**Regla aplicada:** dato inexistente no es cero, dato no medido no es resultado
negativo y error técnico no es una medición válida.

## 1. Resumen

El flujo existía de extremo a extremo para facial, voz y teclado (en el chat del
estudiante), pero varias etapas **sustituían datos ausentes o inválidos por
valores inventados** que luego se presentaban como mediciones. El patrón de
interacción no existía. El de rendimiento tenía un fallo que **registraba como
correctas las respuestas incorrectas**.

Hallazgos más graves, todos corregidos:

| # | Hallazgo | Efecto |
|---|----------|--------|
| 1 | `chat_grader`: `"CORRECTO" in "INCORRECTO"` es verdadero | Toda respuesta calificada como incorrecta se guardaba como **correcta** (tasa de error, riesgo y racha falsos). |
| 2 | `InputValidator` reemplazaba los valores fuera de rango por promedios poblacionales | El rango de voz esperaba F0 80–400 Hz y dB SPL 30–100; el navegador envía centroide espectral y dBFS (−60..0). **Todos los valores de voz se sustituían por 150 Hz / 60 dB**: el patrón analizaba constantes. RT 0 → 3200 ms, CPM 0 → 140, parpadeo 0 → 17/min. |
| 3 | Cada mensaje (calificado o no) se registraba en el predictor de errores; `error = ≥5 caracteres borrados` | El riesgo de error mezclaba ruido de escritura con resultados académicos y contaba dos veces los mensajes calificados. |
| 4 | Velocidad de escritura con 1 s supuesto cuando no hubo escritura | Un dictado por voz de 50 caracteres aparecía como 1000 cpm. |
| 5 | Correcciones comparadas con el valor de hace **dos** cambios | Se perdían borrados. |
| 6 | Voz y rostro: se enviaba el valor instantáneo del momento del envío | Con micrófono activo pero sin hablar se enviaban −60 dB y 0 Hz como medición. |
| 7 | Confianza facial fija 0,5 y de voz fija 0,25 | Peso en la fusión sin respaldo en datos. |
| 8 | Sin datos, el estado MAP era el primer estado del diccionario | Salía **"fatiga"** sin ninguna evidencia. |
| 9 | Motor y caché por estudiante (no por tema) | Al cambiar de competencia se mezclaban historiales y líneas base. |
| 10 | El calificador usaba la **primera** pregunta del historial | Las respuestas se evaluaban contra la bienvenida. |
| 11 | `/stats/performance`: fatiga=25, duda=25, sobrecarga = s/pregunta × 1,2 sin datos; +0,5 h por sesión; hora pico 15:00 por defecto | Indicadores mostrados al estudiante sin medición. |
| 12 | Tendencia por materia con período anterior = 0 | Cualquier nota aparecía como una mejora. |
| 13 | El panel recalculaba puntuaciones propias (`3200/RT`, `cpm/200`) y marcaba Ritmo/Decisión/Predicción siempre activos | Cifras sin equivalente en el backend. Además leía `engagement_score`, `attention_level`, `error_risk` en el nivel superior de la respuesta, campos que el backend nunca enviaba. |
| 14 | `facial_data`/`voice_data` sin esquema (`Dict[str, Any]`) | Cualquier tipo o campo (incluido un blob de imagen) se aceptaba y se guardaba. |
| 15 | La cámara quedaba encendida si el modelo de MediaPipe fallaba al cargar | Captura sin análisis. |

## 2. Trazabilidad por patrón

Cadena: captura → validación → procesamiento → persistencia → API → frontend.

| Patrón | Captura (navegador) | Validación | Procesamiento | Persistencia | API (respuesta) | Visualización |
|---|---|---|---|---|---|---|
| Facial | `useFacialDetection.ts` (MediaPipe local). Agregado por turno solo con fotogramas con rostro; `no_face` si no hubo rostro | `FacialSignal` (`schemas/neuro_signals.py`); consentimiento `camara_facial` | `FacialMicroexpressionAnalyzer`; confianza = fracción de fotogramas con rostro | `cognitive_events.event_data.facial_data` (solo números) | `metadata.pattern_status.facial` | `CognitiveDashboard` |
| Voz | `useVoiceProsody.ts` (Web Audio local). Agregado por turno solo con frames con voz; `insufficient` si < 1 s | `VoiceSignal`; consentimiento `microfono_voz` | `VoiceProsodyAnalyzer`; comparaciones solo contra línea base personal (10 turnos) | `event_data.voice_data` | `pattern_status.voice` | `CognitiveDashboard` |
| Teclado | `useBehavioralMetrics.ts`: tiempos y conteos, nunca el texto | `ChatMessageRequest` (límites, `input_mode`) | `InteractionRhythmAnalyzer` + `DecisionSequenceAnalyzer` | `event_data` + columnas de `cognitive_events` | `pattern_status.keyboard` | `CognitiveDashboard` |
| Interacción | `useInteractionMetrics.ts` (nuevo): pestaña oculta, foco, clics en el chat, sugerencias | `InteractionSignal` | Observacional: **no** entra en la inferencia | `event_data.interaction_data` | `pattern_status.interaction` | `CognitiveDashboard` |
| Rendimiento | Respuesta del chat y quizzes | Calificación en el servidor (`chat_grader`, `/submit-quiz`) | `ErrorPredictionAnalyzer` solo con veredictos reales (≥ 3 para informar riesgo) | `cognitive_session_state.chat_answers`, `quiz_history` | `pattern_status.performance` | `CognitiveDashboard`, `/performance` |

Estados de cada medición (`app/ai/cognitive/pattern_status.py`): `available`,
`pending` (solo en el frontend mientras se envía), `unavailable`,
`not_applicable`, `error`, `stale` (quizzes de más de 30 días). Cada entrada
lleva `reason`, `measured_at`, `values` (solo valores medidos), `units`,
`source` y `engine.weight` (peso con el que contribuyó a la estimación).

Unidades documentadas: velocidad en caracteres/min desde la primera pulsación;
volumen en dBFS; "tono" = centroide espectral (no F0); ritmo de habla estimado
por inicios de voz (sin reconocimiento de voz); `window_ms` de interacción es
permanencia, no tiempo activo; "caracteres borrados" no son errores ortográficos.

## 3. Motor neuroconductual

- Valores inválidos se descartan; nunca se sustituyen.
- Una modalidad sin confianza no recibe peso (antes peso uniforme).
- El resultado informa `modality_weights` (suman 1), `excluded_modalities` con
  motivo y `sufficient_evidence` (≥ 2 fuentes con datos válidos). Sin
  evidencia suficiente no se adapta la dificultad y el estado se presenta como
  no disponible.
- `attention_level` es `None` sin observación facial (antes 1,0);
  `error_risk` solo se informa con ≥ 3 respuestas calificadas.
- Estado serializado v2: las calibraciones de voz/facial y el historial del
  predictor de la v1 (calculados con valores sustituidos) no se restauran.
- Los resultados se etiquetan como "estimación experimental; no es un
  diagnóstico".

## 4. Cambios

**Backend**
- `app/ai/cognitive/neuroconductual_engine.py`: validación sin sustitución, `outcome_known`, unidades reales de voz, confianza por calidad de muestra, trazabilidad de la fusión, estado v2.
- `app/ai/cognitive/pattern_status.py` (nuevo): estado de los cinco patrones.
- `app/ai/cognitive/chat_grader.py`: veredicto por palabra exacta; fallo técnico distinto de "neutro".
- `app/schemas/neuro_signals.py` (nuevo): `FacialSignal`, `VoiceSignal`, `InteractionSignal`.
- `app/schemas/schemas.py`: `client_message_id`, `input_mode`, `keystrokes`, `facial_status`, `voice_status`, `interaction_data`, límites superiores; `QuizSubmission.duration` acotado.
- `app/api/chat.py` (`/chat/message`, `/chat/patterns/save`, `/chat/submit-quiz`): validación de señales, idempotencia por `client_message_id`, motor por estudiante y tema, calificación contra la última pregunta, racha de errores solo con veredicto real, `metadata.pattern_status` y `metadata.engine`, sin copia del texto del mensaje en `cognitive_events`, duración de quiz acotada al tiempo real.
- `app/api/stats.py` (`/stats/dashboard`, `/stats/performance`): sin indicadores inventados; `cognitive_meta`; tendencia solo con período comparable.

No hubo cambios de modelos ni migraciones: los datos nuevos viven en columnas JSON existentes (`event_data`, `extra_data`, `neural_state`). No se eliminaron registros.

**Frontend**
- `hooks/useBehavioralMetrics.ts` (reescrito), `hooks/useFacialDetection.ts`, `hooks/useVoiceProsody.ts`, `hooks/useInteractionMetrics.ts` (nuevo).
- `pages/student/ChatPage.tsx`: envío de los agregados del turno, estado de cada sensor, `client_message_id`, modo de entrada (escrito, voz, pegado, botón).
- `components/CognitiveDashboard.tsx` (reescrito): muestra `pattern_status` con valores, unidades, fecha y estado; mensajes por estado.
- `pages/student/DesempenoPage.tsx`, `pages/student/StudentDashboard.tsx`: "—" y estado vacío en lugar de 0 %.
- `types/index.ts`: contrato de `ChatMessageResponse` alineado con el backend.

## 5. Pruebas

`backend/tests/test_patrones_neurodigitales.py` (18 pruebas, casos A–J):
medición correcta de extremo a extremo con comprobación de valores en API y
BD; patrón desactivado, denegado y sin rostro; turno sin eventos; calificador
caído, señal inválida, fallo de sensor y fallo del motor; cambio de actividad;
reenvío duplicado; entradas inválidas (422 en campos de nivel superior,
`error` en señales, campos desconocidos descartados); tasas de acierto con
resultados conocidos y regresión de `INCORRECTO`; aislamiento entre
estudiantes y consentimiento; estadísticas sin valores inventados;
reproducibilidad y datos faltantes en el motor.

Resultado: suite completa del backend **220 pasadas, 0 fallidas**. Frontend:
`tsc -b` sin errores; ESLint sin errores en los archivos modificados (2
advertencias previas de dependencias de efectos en `ChatPage.tsx`).

Se actualizaron `tests/test_patterns.py` y `tests/test_consentimientos.py`:
usaban muestras de voz en dB SPL y sin duración de voz, un formato que el
navegador nunca envía.

## 6. Estado final

| Patrón | Captura | Procesamiento | Backend | Base de datos | Frontend | Pruebas | Estado |
|---|---|---|---|---|---|---|---|
| Facial | Revisado en código; **sin prueba con cámara real** | Verificado | Verificado | Verificado (JSON) | Compila; sin prueba de UI | Automatizadas (backend) | Parcial: falta validar en navegador |
| Voz | Revisado en código; **sin prueba con micrófono real** | Verificado (proxies acústicos) | Verificado | Verificado (JSON) | Compila; sin prueba de UI | Automatizadas (backend) | Parcial: falta validar en navegador |
| Teclado | Revisado en código; sin prueba en navegador | Verificado | Verificado | Verificado | Compila; sin prueba de UI | Automatizadas (backend) | Parcial |
| Interacción | Nuevo, solo dentro del chat | No aplica (observacional) | Verificado | Verificado (JSON) | Compila; sin prueba de UI | Automatizadas (backend) | Parcial: no cubre navegación global |
| Rendimiento | Servidor | Verificado | Verificado | Verificado | Compila; sin prueba de UI | Automatizadas (backend) | Correcto en el chat; evaluaciones docentes no auditadas a fondo |

El sistema **no** se declara al 100 %.

## 7. Pendientes y riesgos

- **Dispositivos reales:** la captura de cámara, micrófono y teclado no se probó en un navegador con permisos reales (caso J de recursos incluido). Recomendado: prueba manual en Chrome y Firefox, escritorio y Android, entrando y saliendo del chat varias veces y revisando en DevTools que no queden pistas de medios activas.
- **Frontend sin pruebas automatizadas:** el proyecto no tiene runner de pruebas de UI; las comprobaciones de la interfaz son de tipos y lint.
- **Reintentos:** si falla la red, el mensaje no se reintenta solo; el `client_message_id` ya hace idempotente un reintento futuro.
- **Interacción:** solo eventos del chat; no hay telemetría de navegación entre secciones ni de evaluaciones.
- **Evaluaciones de docentes** (`student_evaluations`, `teacher_evaluations`): no se auditaron con la misma profundidad que el chat y los quizzes.
- **Datos históricos:** los eventos anteriores a esta corrección no tienen `sufficient_evidence` y ya no alimentan los indicadores cognitivos; los usuarios con historial verán "no disponible" hasta acumular análisis nuevos. Las tasas de acierto del chat guardadas antes contienen respuestas incorrectas registradas como correctas.
- **Validez de los indicadores:** las heurísticas faciales (atención, valencia) y los proxies de voz no están validados contra un criterio externo; se presentan como estimaciones experimentales.
