# Auditoría READ-ONLY — Páginas del Estudiante (NeuroLearn AI)

## frontend/src/pages/student/StudentDashboard.tsx

[ST-1] (SEVERITY: MENOR)
- Línea(s): 87, 114
- Problema: Los bots se descargan del backend pero nunca se muestran — el valor del estado se destruye al declararlo (`const [, setBots] = useState<ExpertBot[]>([])`). Petición GET /bots/ innecesaria en cada carga del dashboard (cacheada 15s).
- Causa: Refactor que retiró la UI de bots del dashboard sin retirar el fetch.
- Evidencia: `const [, setBots] = useState<ExpertBot[]>([]);` … `setBots(botsRes.data.bots || []);`
- Fix sugerido: Eliminar el estado, el fetch de `/bots/` y el tipo `ExpertBot` (líneas 7, 87, 108, 114) o volver a renderizar los bots.

[ST-2] (SEVERITY: MENOR)
- Línea(s): 100, 148
- Problema: Estado de carga declarado pero nunca leído — `const [, setLoading] = useState(true)`. No hay indicador de carga; mientras llegan los datos la página muestra ceros (0%, 0 clases, 0 ejercicios) que parecen datos reales.
- Causa: El valor de `loading` se descarta en la desestructuración.
- Evidencia: `const [, setLoading] = useState(true);` … `finally { setLoading(false); }`
- Fix sugerido: Leer `loading` y renderizar un skeleton (igual que BotsPage líneas 94-97) mientras `loading === true`.

[ST-3] (SEVERITY: MENOR)
- Línea(s): 145-146
- Problema: catch exterior vacío (`catch { // silently fail }`) — si todas las APIs fallan (ej. backend caído), la página renderiza ceros sin ningún mensaje de error. Los catches individuales por petición (108-111) con datos vacíos por defecto son razonables, pero no existe estado de error visible.
- Causa: Diseño "fail-silent" sin feedback al usuario.
- Evidencia: `} catch {` / `  // silently fail` / `} finally {`
- Fix sugerido: Añadir un banner de error/reintento cuando `dashData === null` y `perfData === null` (líneas 117-140).

Endpoints verificados (contrato OK): GET /api/v1/bots/ (expert_bot.py:58); GET /api/v1/classrooms/my-enrolled (classroom.py:160); GET /api/v1/stats/dashboard (stats.py:14); GET /api/v1/stats/performance (stats.py:146). Links internos OK: /performance, /bots, /chat/:slug, /chat, /quizzes, /my-classes, /tablero, /messages, /calendar.

## frontend/src/pages/student/ChatPage.tsx

[ST-4] (SEVERITY: IMPORTANTE)
- Línea(s): 688
- Problema: `POST /chat/end` NO existe en el backend — chat.py solo define /patterns/save, /patterns, /start, /message, /stats, /generate-quiz, /submit-quiz, /quiz-history (grep chat.py:871-2055). Cada click en "Terminar sesión" lanza un 404 que el catch ignora silenciosamente.
- Causa: Endpoint eliminado/renombrado en el backend sin actualizar el frontend.
- Evidencia: `try { await api.post("/chat/end"); } catch { /* ignore */ }`
- Fix sugerido: Eliminar la llamada (línea 688) o crear `@router.post("/end")` en backend/app/api/chat.py que cierre la sesión activa (cognitive_session_state).

[ST-5] (SEVERITY: IMPORTANTE)
- Línea(s): 1205-1206
- Problema: Like/Dislike falsos — `onLike`/`onDislike` NO registran nada en el backend; en su lugar envían al tutor IA un mensaje de usuario que dice "✅ Tu respuesta 'me gusta' ha sido registrada para {id}". Es un mensaje de éxito falso (no hay confirmación de backend) y además contamina la conversación: la IA responderá a ese pseudo-mensaje.
- Causa: Placeholder nunca conectado a un endpoint real (no existe /chat/message/{id}/feedback ni similar).
- Evidencia: `onLike={(id) => sendMessageWithText(`✅ Tu respuesta "me gusta" ha sido registrada para ${id}`)}`
- Fix sugerido: Crear endpoint POST /chat/feedback en backend (guardar reacción por message_id/user) y en onLike/onDislike llamarlo; solo mostrar éxito si responde 2xx.

[ST-6] (SEVERITY: MENOR)
- Línea(s): 1209
- Problema: Botón "Reportar" solo hace `console.log` — no registra el reporte en ningún lado, sin feedback al usuario.
- Causa: Handler placeholder.
- Evidencia: `onReport={(id) => console.log(`Reporte de mensaje: ${id}`)}`
- Fix sugerido: Conectar a un endpoint de reportes (o al menos mostrar un toast "Reporte enviado" tras un POST real) o quitar el botón.

[ST-7] (SEVERITY: MENOR)
- Línea(s): 741
- Problema: `loadConversation` falla silenciosamente — catch vacío `catch (e) { /* ignore */ }`. Si GET /chat/conversations/{id} falla (404/borrada en otra pestaña), el usuario hace click en el historial y no ocurre nada, sin mensaje.
- Causa: catch sin feedback.
- Evidencia: `} catch (e) { /* ignore */ }` al final de loadConversation.
- Fix sugerido: Añadir mensaje de error en la lista del sidebar o un toast al fallar la carga.

[ST-8] (SEVERITY: MENOR)
- Línea(s): 797-803
- Problema: `deleteConversation` falla silenciosamente — el catch es vacío y `loadConversations()` está dentro del try, así que si el DELETE falla la lista no se refresca ni se avisa al usuario. Además no hay confirmación antes de eliminar.
- Causa: Manejo de error omitido.
- Evidencia: `try { await api.delete(`/chat/conversations/${id}`); if (conversationId === id) resetChatState(); loadConversations(); } catch (e) { /* ignore */ }`
- Fix sugerido: Mover `loadConversations()` a un finally, mostrar error si falla y añadir confirmación.

[ST-9] (SEVERITY: MENOR)
- Línea(s): 555
- Problema: Historial enviado al backend usa closure obsoleta — `messages.slice(-10)` captura el estado del render anterior, por lo que el mensaje del usuario recién agregado (línea 540) no se incluye en `history`. El backend pierde el último turno en su contexto.
- Causa: setState es asíncrono; `messages` no está actualizado dentro de la misma llamada.
- Evidencia: `history: messages.slice(-10).map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.content }))`
- Fix sugerido: Construir el history a partir de `[...messages, userMsg].slice(-10)`.

Endpoints usados: POST /chat/conversations, POST /chat/start, POST /chat/message, POST /chat/end (NO EXISTE — ST-4), GET /chat/conversations, GET /chat/conversations/{id}, DELETE /chat/conversations/{id}. Errores 4xx/5xx de /chat/start y /chat/message sí se muestran al usuario (líneas 437-462, 596-627) — sin pantallas blancas.

## frontend/src/pages/student/BotsPage.tsx

[ST-10] (SEVERITY: MENOR)
- Línea(s): 29-31
- Problema: Error al cargar bots compartidos solo hace `console.error` — no hay estado de error; tras el fallo la sección "Bots de tus Profesores" simplemente no se renderiza (línea 137 `: null}`), el usuario cree que no hay bots.
- Causa: catch sin estado de error.
- Evidencia: `} catch (err) { console.error('Error fetching shared bots:', err); } finally { setLoading(false); }`
- Fix sugerido: Añadir `const [error, setError] = useState<string|null>(null)` y renderizar mensaje con botón de reintento.

## frontend/src/pages/student/MyClassesPage.tsx

[ST-11] (SEVERITY: MENOR)
- Línea(s): 21-22, 89-94
- Problema: Error al cargar las clases se traga silenciosamente (`catch { setClassrooms([]); }`) — si el fetch falla, la página muestra el estado vacío "No estás inscrito en ninguna clase", enmascarando el error como si el estudiante no tuviera clases.
- Causa: catch sin estado de error; el estado vacío se muestra aunque la causa sea un fallo de red.
- Evidencia: `} catch { setClassrooms([]); } finally { setLoading(false); setFetched(true); }`
- Fix sugerido: Distinguir error de vacío: `setError('No se pudieron cargar tus clases')` en el catch y mostrar un banner de reintento.

[ST-12] (SEVERITY: MENOR)
- Línea(s): 30
- Problema: Efecto secundario en el cuerpo del render: `if (!fetched && !loading) fetchClasses();`. En React 18 StrictMode el render se invoca dos veces → doble GET; es un anti-pattern (debería ser useEffect).
- Causa: Fetch iniciado durante render en lugar de useEffect.
- Evidencia: `// Fetch on first render` / `if (!fetched && !loading) fetchClasses();`
- Fix sugerido: Mover a `useEffect(() => { if (!fetched) fetchClasses(); }, []);`.

Endpoints verificados (contrato OK): GET /api/v1/classrooms/my-enrolled (classroom.py:160, response ClassroomListResponse con `classrooms`); POST /api/v1/classrooms/join (classroom.py:377, body `invite_code` — backend hace `.upper()` igual que el frontend línea 66; errores 4xx mostrados con `detail` líneas 42-45; éxito solo tras 2xx línea 39; doble envío bloqueado con `joinLoading`). Link /my-classes/:id OK.

## frontend/src/pages/student/ClassroomPage.tsx

Sin hallazgos críticos. Página correcta: maneja loading (72-78), error con navegación de vuelta (80-101), empty states reales para descripción y bots (150-154, 173-176). Endpoints verificados (contrato OK): GET /api/v1/classrooms/{id}/student-detail (classroom.py:265, response ClassroomStudentDetailResponse incluye overall_progress/average_score/risk_level/teacher_name/bots — classroom.py:341-346). Navegación OK: /chat?bot_id=..., /chat, /my-classes (líneas 183, 262-267, 84, 93).

## frontend/src/pages/student/QuizzesPage.tsx

[ST-13] (SEVERITY: MENOR)
- Línea(s): 200-201, 684-691
- Problema: Error al cargar el historial se ignora silenciosamente (`catch { // silently ignore }`) — si GET /chat/quiz-history falla, la pantalla de historial muestra "Aún no has hecho ningún quiz" (estado vacío falso que enmascara el error).
- Causa: catch sin estado de error.
- Evidencia: `} catch {` / `  // silently ignore` / `} finally { setHistoryLoading(false); }`
- Fix sugerido: Añadir estado de error y mensaje "No se pudo cargar el historial" con botón de reintento.

[ST-14] (SEVERITY: MENOR)
- Línea(s): 249-254
- Problema: Si el texto `answer` del backend no coincide con ninguna opción tras normalizar, se asigna `correct_answer = options[0]?.letter || 'A'` — marca arbitrariamente la primera opción como correcta. La revisión al estudiante ("Correcta: A") puede estar mal y el puntaje local (líneas 287-291) divergir del porcentaje real del backend (línea 558).
- Causa: Fallback defensivo sin advertencia.
- Evidencia: `const correctOption = options.find(o => norm(o.text) === norm(correctText));` … `correct_answer: correctOption?.letter || options[0]?.letter || 'A',`
- Fix sugerido: Si no hay coincidencia, marcar la pregunta como "sin clave válida" y usar SIEMPRE el porcentaje del backend; registrar console.warn con el answer crudo.

[ST-15] (SEVERITY: MENOR)
- Línea(s): 304-305
- Problema: Si POST /chat/submit-quiz falla, se muestran resultados sin análisis y sin ninguna nota al usuario (`// show results without analysis`) — el estudiante no sabe que el análisis adaptativo/conceptos débiles no se guardaron ni se calcularon.
- Causa: catch silencioso.
- Evidencia: `} catch {` / `  // show results without analysis` / `} finally { setIsAnalyzing(false); }`
- Fix sugerido: Mostrar un aviso "Resultados guardados localmente — análisis no disponible" cuando `analysisResult === null` en la pantalla results (línea 598).

[ST-16] (SEVERITY: MENOR)
- Línea(s): 265
- Problema: Error de generación se comunica con `alert()` nativo — funciona pero es UX pobre e inconsistente con el resto de la app (no hay estados de error inline).
- Causa: Placeholder de UI.
- Evidencia: `alert('Error al generar el quiz. Intenta de nuevo.');`
- Fix sugerido: Reemplazar por mensaje inline en la pantalla select con botón reintentar.

Endpoints verificados (contrato OK): GET /api/v1/chat/quiz-history (chat.py:2055, response QuizHistoryResponse{history,total_quizzes} — mapping frontend línea 181 compatible); POST /api/v1/chat/generate-quiz (chat.py:1594, request QuizRequest{topic,num_questions,difficulty} — frontend líneas 221-227 compatible; en modo auto no envía difficulty, backend la calcula); POST /api/v1/chat/submit-quiz (chat.py:1891, request QuizSubmission{quiz_title,user_answers:Dict[int,str],duration} — frontend líneas 298-302 compatible, backend acepta claves int/str). Doble envío bloqueado (isSubmitted líneas 272/278, botones disabled 491/517), validación "responde todas" (517), reset al iniciar (214-218), historial persiste en backend y se refresca tras submit (309). Links /performance, /quizzes/history OK.

## frontend/src/pages/student/DesempenoPage.tsx

[ST-17] (SEVERITY: MENOR)
- Línea(s): 790
- Problema: Mensaje de error con instrucción de desarrollo expuesta al usuario final: "Verifica que el backend esté corriendo en localhost:8000". En producción no hay localhost:8000 y confunde al estudiante.
- Causa: Texto hardcodeado de entorno dev.
- Evidencia: `<p className="text-[#9B9A97] text-xs">Verifica que el backend esté corriendo en localhost:8000</p>`
- Fix sugerido: Mensaje genérico "Intenta de nuevo más tarde" + botón de reintento que re-fetch (líneas 777-782).

[ST-18] (SEVERITY: MENOR)
- Línea(s): 786-792
- Problema: El estado de error no ofrece botón de reintento — el único camino es recargar la página manualmente.
- Causa: Falta el botón en el bloque de error.
- Evidencia: bloque `if (apiError) return (...)` sin acción de retry.
- Fix sugerido: Extraer el fetch a una función `loadPerf()` y llamarla desde un botón "Reintentar".

Endpoints verificados (contrato OK): GET /api/v1/stats/performance (stats.py:146). Página bien estructurada: loading (784), error (786-792), empty real cuando total_quizzes === 0 (794). Sin datos hardcodeados (los estilos son solo visual, línea 40-47; los datos vienen de perf.subjects/weekly/calendar/recent_history/overview/cognitive/achievements).

## frontend/src/pages/student/MaterialPage.tsx

[ST-19] (SEVERITY: IMPORTANTE)
- Línea(s): 42-112, 115-209
- Problema: Catálogo 100% hardcodeado — `MATERIALS` (6 PDFs) y `EXTERNAL_RESOURCES` (10 recursos) son arrays estáticos en el código. Cero llamadas API en toda la página. El backend tiene teacher_materials.py (GET /api/v1/materials, carpetas + archivos subidos por profesores, línea 126) pero esta página NUNCA lo consume: los materiales que suban los profesores jamás aparecen aquí, y el listado no se puede gestionar sin redeploy del frontend.
- Causa: Página prototipo nunca conectada al backend de materiales.
- Evidencia: `const MATERIALS: Material[] = [` con 6 entradas fijas (líneas 42-112) y `const EXTERNAL_RESOURCES: ExternalResource[] = [` (líneas 115-209); no existe ningún `api.` en el archivo.
- Fix sugerido: Consumir GET /api/v1/materials (teacher_materials.py:126) filtrando archivos visibles para estudiantes, con loading/error/empty states; mantener los recursos externos como configuración o moverlos a backend.

[ST-20] (SEVERITY: MENOR)
- Línea(s): 284-288, 268-275
- Problema: El visor PDF embebe `${B}material/N.pdf` como asset estático — si el PDF no existe en el deploy, el iframe queda en blanco sin mensaje de error y "Descargar"/"Abrir" dan 404.
- Causa: Dependencia de assets estáticos sin verificación de existencia.
- Evidencia: `<iframe src={`${material.file}#toolbar=1&navpanes=1`} ... />`
- Fix sugerido: Verificar existencia (HEAD request) o mostrar fallback "Documento no disponible" en el visor.

Sin más problemas: modal PDFViewer abre/cierra bien (253, 276, 603), búsqueda y filtros funcionan (427-439), empty state de búsqueda real (562-569), enlaces externos reales con target/rel correctos.

## frontend/src/pages/student/TableroPage.tsx

[ST-21] (SEVERITY: IMPORTANTE)
- Línea(s): 254-259
- Problema: Botones de adjuntos SIN onClick — muestran "Abrir enlace" cuando el adjunto es una URL pero al hacer click no ocurre nada. El estudiante no puede abrir adjuntos de las publicaciones del profesor.
- Causa: Botón renderizado sin handler; mapPost (línea 62) reduce los adjuntos a strings y descarta la URL/estructura.
- Evidencia: `<button key={a}` / `  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F6F3] ..."` / `  <Paperclip className="w-3 h-3" />` / `  {a.startsWith('http') ? 'Abrir enlace' : a}` / `</button>` — sin onClick.
- Fix sugerido: Si `a.startsWith('http')` renderizar `<a href={a} target="_blank" rel="noopener noreferrer">`; para archivos, enlazar a la descarga del material del backend (teacher_materials.py:279 GET /materials/files/{file_id}/download).

[ST-22] (SEVERITY: MENOR)
- Línea(s): 85, 201-205
- Problema: Error al cargar publicaciones se traga (`catch(() => setPosts([]))`) — si el fetch falla, se muestra "No hay publicaciones para mostrar" enmascarando el error como vacío.
- Causa: catch sin estado de error.
- Evidencia: `.catch(() => setPosts([]))`
- Fix sugerido: Estado de error con mensaje "No se pudieron cargar las publicaciones" + reintento.

[ST-23] (SEVERITY: MENOR)
- Línea(s): 137-140
- Problema: Fallo al comentar se revierte silenciosamente (el texto vuelve al input) pero no se muestra ningún mensaje de error al usuario — no sabe por qué su comentario no apareció.
- Causa: catch sin feedback visible.
- Evidencia: `} catch {` / `  // Restaurar texto si falla` / `  setCommentText(prev => ({ ...prev, [postId]: text }));` / `}`
- Fix sugerido: Añadir mensaje inline "No se pudo publicar el comentario" por post.

[ST-24] (SEVERITY: MENOR)
- Línea(s): 305-307
- Problema: Avatar del estudiante hardcodeado como "E" fijo en el input de comentarios, en vez de la inicial del usuario logueado.
- Causa: Placeholder nunca conectado a useAuth.
- Evidencia: `<div className="w-7 h-7 rounded-full bg-[#37352F] text-white ...">E</div>`
- Fix sugerido: Usar la inicial de `user.full_name`/`user.username` de useAuth.

Endpoints verificados (contrato OK): GET /api/v1/posts (posts.py:93, response {posts:[{id,post_type,title,content,due_date,attachments,teacher_name,classroom_name,reactions_count,user_reacted,comments:[{id,author_name,author_role,content,created_at}]}]} — mapPost líneas 42-65 compatible); POST /api/v1/posts/{id}/reactions (posts.py:217, responde {reacted, reactions_count} — sincronizado línea 110-113 con revert optimístico correcto); POST /api/v1/posts/{id}/comments (posts.py:290, body {content}, response con id/author_name/author_role/content/created_at — compatible línea 128-136).

## frontend/src/pages/student/MessagesPage.tsx (+ components/Messaging.tsx)

[ST-25] (SEVERITY: IMPORTANTE)
- Línea(s): Messaging.tsx 232, 241 (backend messages.py:54)
- Problema: Descarga de adjuntos ROTA por doble prefijo — el backend devuelve `url = "/api/v1/messages/{id}/attachment"` (messages.py:54) y el frontend la pasa a `api.get(msg.attachment.url)` cuya baseURL ya es '/api/v1' → URL final '/api/v1/api/v1/messages/{id}/attachment' → 404. El catch es noop (línea 241) así que la descarga falla silenciosamente: el botón de adjunto no descarga nunca.
- Causa: El backend incluye el prefijo completo en `url` y axios lo concatena con baseURL.
- Evidencia: `const res = await api.get(msg.attachment.url, { responseType: 'blob' });` … `} catch { /* noop */ }` — backend: `"url": f"/api/v1/messages/{msg.id}/attachment" if msg.attachment_name else None`
- Fix sugerido: En Messaging.tsx línea 232, extraer el prefijo: `api.get(msg.attachment.url.replace(/^\/api\/v1/, ''), { responseType: 'blob' })` o que el backend devuelva url sin prefijo (`/messages/{id}/attachment`).

[ST-26] (SEVERITY: MENOR)
- Línea(s): Messaging.tsx 126, 148-150, 213, 241
- Problema: Errores silenciosos sistemáticos — (a) carga de conversaciones falla → lista vacía con hint "Habla con tus profesores" que enmascara el error; (b) abrir una conversación falla → mensajes quedan vacíos mostrando "Inicia la conversación" aunque haya mensajes; (c) contactos falla → modal muestra "Sin resultados" aunque sea error; (d) descarga falla → nada. Ningún mensaje de error en todo el componente.
- Causa: catches con `setConvs([])`/noop sin estado de error.
- Evidencia: `.catch(() => setConvs([]))` (126); `} catch { setActive({ ...conv, unread: 0 }); }` (148-150); `} catch { /* noop */ }` (213, 241).
- Fix sugerido: Añadir estado de error con banner y reintento; al fallar la apertura, toast "No se pudieron cargar los mensajes".

[ST-27] (SEVERITY: MENOR)
- Línea(s): Messaging.tsx 193-196
- Problema: Fallo al enviar mensaje: el mensaje temporal se elimina y el texto vuelve al input, pero NO se muestra ningún error — el usuario ve cómo su mensaje desaparece sin explicación (p. ej. 403 por licencia, 400 por archivo >25MB con detail que nunca se muestra).
- Causa: catch sin feedback.
- Evidencia: `} catch { setText(content); setAttachment(file); setActive(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== tempMsg.id) } : prev); }`
- Fix sugerido: Mostrar el `detail` del backend en un toast/banner y conservar el mensaje marcado como fallido.

[ST-28] (SEVERITY: MENOR)
- Línea(s): Messaging.tsx 175-183
- Problema: Mensaje temporal se muestra como enviado ANTES de la confirmación del backend (success visual anticipado). Si falla se revierte, pero entre envío y error el remitente ve "Ahora" y el check gris como si estuviera enviado.
- Causa: Optimistic UI sin indicador "enviando…" en el mensaje.
- Evidencia: `const tempMsg: Message = { id: `tmp-${Date.now()}`, ... lastTime: 'Ahora', unread: 0 };`
- Fix sugerido: Marcar tempMsg con `pending: true` y mostrar spinner hasta la respuesta.

Endpoints verificados (contrato OK): GET /api/v1/messages/conversations (messages.py:217); GET /api/v1/messages/conversations/{other_user_id} (messages.py:384, response {other_user_id, other_user_name, other_user_role, messages, total} — mapConv/mapMessage compatible); POST /api/v1/messages/conversations/{other_user_id} (messages.py:451, multipart Form content + file, límite 25MB — compatible con FormData líneas 187-192); POST /api/v1/messages/conversations/{other_user_id}/read (messages.py:511); GET /api/v1/messages/contacts (messages.py:130). Doble envío bloqueado (sending línea 168), Enter con isComposing manejado (161), adjunto removible (411). RUTA /messages OK.

## frontend/src/pages/student/CalendarPage.tsx

[ST-29] (SEVERITY: MENOR)
- Línea(s): 62, 221-222, 266-268
- Problema: Error al cargar eventos se traga (`catch(() => setEvents([]))`) — si el fetch falla, el calendario y el panel "Próximos eventos" muestran "Sin eventos próximos" / "Sin eventos este mes", enmascarando el error como vacío.
- Causa: catch sin estado de error.
- Evidencia: `.catch(() => setEvents([]))`
- Fix sugerido: Estado de error con mensaje y reintento.

[ST-30] (SEVERITY: MENOR)
- Línea(s): 151, 178, 195, 300
- Problema: Render asume que `event_type` siempre está en EVENT_COLORS (`EVENT_COLORS[ev.type].textBg`) — pero el backend NO valida el tipo (events.py:31 `event_type: str = "clase"` es String(30) libre, solo documentado por comentario). Un profesor que cree un evento con tipo fuera del catálogo (p. ej. "recordatorio", que existe en el Tablero pero no aquí) causa TypeError → pantalla blanca en todo el calendario.
- Causa: Falta de validación en backend + acceso sin null-safety en frontend.
- Evidencia: `className={\`w-full text-[9px] px-1 py-0.5 rounded font-medium truncate text-left ${EVENT_COLORS[ev.type].textBg}\`}` — backend: `event_type: str = "clase"             # examen|tarea|clase|anuncio|evento|feriado`
- Fix sugerido: En mapEvent (línea 37) usar `EVENT_COLORS[raw.event_type] ? raw.event_type : 'evento'`, o validar event_type en el backend contra Literal['examen','tarea','clase','anuncio','evento','feriado'].

[ST-31] (SEVERITY: MENOR)
- Línea(s): 149-154
- Problema: Solo se muestran 2 eventos por celda y el indicador "+N" (línea 156) no es clicable — no hay forma de ver los eventos ocultos de un día desde la celda (solo seleccionando el día, que sí los lista en 167-202).
- Causa: Recorte visual sin acción en "+N".
- Evidencia: `{evs.length > 2 && (<p className="text-[9px] text-[#AEADAB] pl-1">+{evs.length - 2}</p>)}`
- Fix sugerido: Hacer "+N" un botón que haga `setSelected(ds)`.

Endpoints verificados (contrato OK): GET /api/v1/events?month=YYYY-MM (events.py:86, acepta `month` query param y lo filtra con startswith — events.py:138-139; response {events:[{id,title,event_type,event_date,event_time,description,classroom_name,teacher_name}]} — mapEvent líneas 32-43 compatible). Modal de detalle funcional (293-332). Navegación de meses OK (80-81). Eventos correctamente acotados por institución/inscripción en el backend (97-133).

## frontend/src/pages/student/SettingsPage.tsx (+ components/ProfileSettings.tsx)

[ST-32] (SEVERITY: IMPORTANTE)
- Línea(s): ProfileSettings.tsx 150-154, 28-34
- Problema: Preferencias de notificación SOLO en localStorage — el toggle "Mensaje directo"/"Nueva actividad" sugiere controlar las notificaciones, pero no se envía al backend (no existe endpoint de preferencias) ni afecta al panel de notificaciones real (notifications.py regenera siempre las notificaciones sin filtrar por estas prefs). Datos mostrados que no tienen ningún efecto funcional y se pierden al limpiar el navegador.
- Causa: Persistencia local con comentario que da a entender que es válida ("o en preferencias").
- Evidencia: `const savePrefs = () => { localStorage.setItem(prefsStorageKey, JSON.stringify(prefs)); setSaved('prefs'); ... }`
- Fix sugerido: Conectar a un endpoint PATCH de preferencias en el backend y hacer que notifications.py (línea 180) filtre por ellas, o etiquetar la sección como "preferencias de este dispositivo".

[ST-33] (SEVERITY: MENOR)
- Línea(s): ProfileSettings.tsx 42-45 (uso en 286)
- Problema: "Marcar todas como leídas" es persistencia falsa — useNotifications.markAllRead (useNotifications.ts:42-45) solo actualiza el estado local sin llamar al backend; el backend no tiene endpoint para marcar leídas y regenera las notificaciones con `read: False` en cada request (notifications.py:58/78/98/108/124/140/161). Al recargar, todas reaparecen como no leídas.
- Causa: No existe POST /notifications/read en el backend; el handler es local-only.
- Evidencia: `const markAllRead = useCallback(() => { setNotifications(prev => prev.map(n => ({ ...n, read: true }))); setUnreadCount(0); }, []);`
- Fix sugerido: Crear POST /api/v1/notifications/read en el backend que persista el estado (o guardar ids leídos por usuario) y llamarlo desde markAllRead; solo marcar como leídas si responde 2xx.

[ST-34] (SEVERITY: MENOR)
- Línea(s): ProfileSettings.tsx 212-215, 252-256
- Problema: Botones "Guardar cambios" y "Actualizar contraseña" sin estado de guardado/deshabilitado — no se desactivan durante la petición, permitiendo doble click → doble PATCH/doble envío (el cambio de contraseña doble puede provocar errores de rate-limit 429 con mensaje genérico).
- Causa: No hay `saving` state en los handlers (113-131, 137-148).
- Evidencia: `const handleSaveProfile = async () => { setError(''); try { ... await api.patch('/auth/me', payload); ...` — sin `setSaving` ni `disabled={saving}`.
- Fix sugerido: Añadir `const [saving, setSaving] = useState(false)` y `disabled={saving}` en ambos botones.

[ST-35] (SEVERITY: MENOR)
- Línea(s): ProfileSettings.tsx 145-147
- Problema: El catch de cambio de contraseña muestra mensaje genérico y descarta el `detail` del backend ("La contraseña actual es incorrecta." o el error de fortaleza específico de validate_password_strength, auth.py:349-353).
- Causa: catch sin lectura de `e?.response?.data?.detail` (a diferencia de handleSaveProfile:129 que sí lo lee).
- Evidencia: `} catch { setError('No se pudo actualizar la contraseña. Verifica tu contraseña actual.'); }`
- Fix sugerido: `catch (e: any) { setError(e?.response?.data?.detail || 'No se pudo actualizar la contraseña...'); }`.

## frontend/src/types/index.ts

[ST-36] (SEVERITY: IMPORTANTE)
- Línea(s): 67-81
- Problema: `ChatMessageResponse` declara como REQUERIDOS `emotional_state`, `attention_level`, `engagement_score`, `error_risk`, `active_modalities` — el schema del backend (schemas.py:125-133) NO tiene esos campos y FastAPI filtra la respuesta por response_model (chat.py:1021/1443-1509: active_modalities y error_risk viven dentro de `metadata`). Consecuencias: (a) el tipo miente sobre el contrato real; (b) ChatPage.tsx líneas 1339-1364 lee `lastResponse.engagement_score`/`error_risk`/`active_modalities` a nivel raíz — siempre undefined → la UI muestra permanentemente "Engagement: —", "Riesgo error: —" y "0/5 patrones activos" (UI muerta).
- Causa: El frontend tipó campos que el backend movió a metadata y nunca envió a nivel raíz.
- Evidencia: frontend: `emotional_state: string | null;` / `attention_level: number;` / `engagement_score: number;` / `error_risk: number;` / `active_modalities: string[];` — backend (schemas.py:125-133): `message, action, difficulty, cognitive_state, confidence, suggestions, should_pause, metadata` solamente.
- Fix sugerido: En ChatPage.tsx leer desde `lastResponse.metadata?.error_risk`, `lastResponse.metadata?.active_modalities` (y calcular engagement desde metadata.patterns si existe); corregir types/index.ts quitando los campos inexistentes o marcándolos opcionales dentro de metadata.

[ST-37] (SEVERITY: MENOR)
- Línea(s): 53-65
- Problema: `StartSessionRequest` y `ChatMessageRequest` de types/index.ts están desactualizados — no incluyen `conversation_id`, `history`, `cognitive_state`, `typing_bursts`, `is_question`, `message_length`, `facial_data`, `voice_data` que el backend sí acepta (schemas.py:67-92) y que ChatPage envía construyendo payloads como `any` (ChatPage.tsx 430-432, 549-592), perdiendo la verificación de tipos en las llamadas principales del chat.
- Causa: Tipos no actualizados tras añadir los patrones neuroconductuales y conversaciones.
- Evidencia: `export interface ChatMessageRequest { message: string; response_time_ms?: number; typing_speed_cpm?: number; corrections?: number; pause_before_ms?: number; }` (solo 5 campos).
- Fix sugerido: Sincronizar ambos interfaces con schemas.py:67-92 y tipar los api.post de ChatPage (líneas 433, 550) para recuperar type-safety.

---

# RESUMEN DE ENDPOINTS frontend → backend VERIFICADOS

## SÍ existen con contrato correcto (verificados en código):
- GET /api/v1/bots/ — expert_bot.py:58 → StudentDashboard.tsx:108 (lista bots; datos cargados no se muestran, ST-1)
- GET /api/v1/bots/shared-with-me — expert_bot.py:123 → BotsPage.tsx:27 (response {bots:[{id,name,description,subject,creator_name,classroom_name,is_required,source}]} coincide con SharedBot)
- GET /api/v1/classrooms/my-enrolled — classroom.py:160 → StudentDashboard.tsx:109, MyClassesPage.tsx:19
- GET /api/v1/classrooms/{id}/student-detail — classroom.py:265 → ClassroomPage.tsx:52 (overall_progress/average_score/risk_level/teacher_name/bots)
- POST /api/v1/classrooms/join — classroom.py:377 → MyClassesPage.tsx:38 (body invite_code, backend .upper())
- GET /api/v1/stats/dashboard — stats.py:14 → StudentDashboard.tsx:110 (progress_percentage/total_exercises/total_classes/active_skills/study_hours)
- GET /api/v1/stats/performance — stats.py:146 → StudentDashboard.tsx:111, DesempenoPage.tsx:778 (subjects/weekly/calendar/recent_history/overview/cognitive/achievements/hourly_distribution, datos reales por usuario)
- POST /api/v1/chat/conversations — conversations.py:64 → ChatPage.tsx:415 (ConversationCreate subject/skill/topic/bot_id; response ConversationMeta con id)
- GET /api/v1/chat/conversations — conversations.py:47 → ChatPage.tsx:707 (ConversationListResponse; historial user-scoped por student_id)
- GET /api/v1/chat/conversations/{id} — conversations.py:87 → ChatPage.tsx:719 (response {conversation, messages:[{id,role,content,timestamp}]})
- DELETE /api/v1/chat/conversations/{id} — conversations.py:144 → ChatPage.tsx:799 (soft delete, user-scoped)
- POST /api/v1/chat/start — chat.py:966 → ChatPage.tsx:433 (StartSessionRequest topic/difficulty/bot_id/conversation_id; response ChatMessageResponse)
- POST /api/v1/chat/message — chat.py:1021 → ChatPage.tsx:550 (ChatMessageRequest completo incl. facial_data/voice_data; ✗ engagement_score/error_risk/active_modalities llegan en metadata, no a nivel raíz — ST-36)
- POST /api/v1/chat/generate-quiz — chat.py:1594 → QuizzesPage.tsx:229 (QuizRequest topic/num_questions/difficulty)
- POST /api/v1/chat/submit-quiz — chat.py:1891 → QuizzesPage.tsx:298 (QuizSubmission quiz_title/user_answers/duration; acepta claves int/str)
- GET /api/v1/chat/quiz-history — chat.py:2055 → QuizzesPage.tsx:180 (QuizHistoryResponse{history,total}; persiste en QuizHistory por user_id)
- GET /api/v1/posts — posts.py:93 → TableroPage.tsx:78 (posts de clases inscritas, con comments/reactions/attachments/due_date)
- POST /api/v1/posts/{id}/reactions — posts.py:217 → TableroPage.tsx:108 (optimistic + sync con {reacted, reactions_count})
- POST /api/v1/posts/{id}/comments — posts.py:290 → TableroPage.tsx:128 (body {content}, response completo)
- GET /api/v1/messages/conversations — messages.py:217 → Messaging.tsx:120
- GET /api/v1/messages/conversations/{other_user_id} — messages.py:384 → Messaging.tsx:141
- POST /api/v1/messages/conversations/{other_user_id} — messages.py:451 → Messaging.tsx:190 (multipart content+file, límite 25MB)
- POST /api/v1/messages/conversations/{other_user_id}/read — messages.py:511 → Messaging.tsx:142,153
- GET /api/v1/messages/contacts — messages.py:130 → Messaging.tsx:206
- GET /api/v1/messages/{message_id}/attachment — messages.py:420 existe, PERO el frontend lo llama con doble prefijo /api/v1/api/v1/... (Messaging.tsx:232 + messages.py:54) → descarga rota (ST-25)
- GET /api/v1/events?month=YYYY-MM — events.py:86 → CalendarPage.tsx:60 (eventos por institución/inscripción)
- GET /api/v1/notifications — notifications.py:168 → useNotifications.ts:25 ({notifications, unread_count}; datos reales de quizzes/sesiones)
- PATCH /api/v1/auth/me — auth.py:278 → ProfileSettings.tsx:119 (full_name/email/photo con validación data-URL)
- POST /api/v1/auth/change-password — auth.py:335 → ProfileSettings.tsx:141 (current_password/new_password, rate-limit, 204)

## NO existen o ROTOS:
- POST /api/v1/chat/end — NO EXISTE en chat.py (ChatPage.tsx:688 lo llama en cada "Terminar sesión" → 404 silencioso) — ST-4
- GET descarga de adjunto (doble prefijo) — messages.py:54 devuelve url CON '/api/v1' y Messaging.tsx:232 la llama vía api.get con baseURL '/api/v1' → 404 silencioso — ST-25
- Feedback de mensajes de chat (like/dislike) — no existe endpoint; ChatPage.tsx:1205-1206 finge éxito enviando un mensaje al tutor — ST-5
- Reporte de mensaje — no existe; ChatPage.tsx:1209 solo console.log — ST-6
- Persistencia de "marcar notificaciones leídas" — no existe endpoint; useNotifications.ts:42-45 solo local — ST-33
- Preferencias de notificación — sin backend; ProfileSettings.tsx:150-154 solo localStorage y sin efecto real — ST-32
- Materiales del estudiante — MaterialPage.tsx 100% hardcodeado; NO consume GET /api/v1/materials (teacher_materials.py:126) que sí existe — ST-19

## Resumen de severidades (37 hallazgos):
- CRÍTICO: 0
- IMPORTANTE: 7 (ST-4 chat/end 404, ST-5 like/dislike falso, ST-19 Material hardcodeado, ST-21 adjuntos sin onClick, ST-25 descarga adjuntos doble prefijo, ST-32 prefs sin efecto, ST-36 contrato ChatMessageResponse/UI muerta)
- MENOR: 30

Nota: ST-36 se enumera como IMPORTANTE (UI muerta permanente de engagement/riesgo/patrones). No se detectaron pantallas blancas en los flujos principales: todas las páginas manejan loading/error/empty (excepciones menores documentadas).
