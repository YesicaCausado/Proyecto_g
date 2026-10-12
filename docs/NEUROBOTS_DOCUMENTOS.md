# Base de conocimiento de los NeuroBots

El profesor sube documentos a sus NeuroBots y el bot usa ese contenido para
responder a los estudiantes.

## Flujo

```
Profesor → NeuroBots → Gestionar → Subir documento
  → frontend envía el archivo (multipart, campo "file")
  → backend valida: rol, dueño del bot, extensión, tipo MIME, firma del archivo, tamaño
  → extrae el texto (PDF: pypdf · DOCX: XML del documento · TXT/MD: texto)
  → lo divide en fragmentos de ~1.200 caracteres (con solapamiento)
  → guarda archivo + fragmentos indexados (bot_documents, bot_document_chunks)
  → responde 201: documento "procesado"
Estudiante / profesor conversa con el NeuroBot
  → /chat/start y /chat/message reciben bot_id (o lo toman de la conversación)
  → se valida que el usuario pueda usar el bot
  → BM25 elige los fragmentos más relevantes para el mensaje (máx. 4 / 6.000 caracteres)
  → se agregan al prompt del sistema con el nombre del documento
  → la respuesta indica en metadata.knowledge.sources qué documentos se usaron
```

Estados que ve el profesor: **pendiente → subiendo (% real de red) →
procesando (el servidor extrae e indexa) → procesado** o **error** con el
mensaje que devuelve el backend. No hay estados simulados: un documento solo
aparece como procesado cuando el backend respondió 201.

## Endpoints (`/api/v1/bots`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/{bot_id}/documents` | Lista de documentos del bot |
| POST | `/{bot_id}/documents` | Subir (multipart `file`). 201 procesado · 400 vacío · 409 duplicado · 413 > 4 MB · 415 formato/MIME · 422 sin texto, protegido o dañado |
| GET | `/{bot_id}/documents/{id}/download` | Descargar el archivo original |
| DELETE | `/{bot_id}/documents/{id}` | Eliminar documento y fragmentos (el bot deja de usarlo) |

`GET /bots/my-bots` incluye `document_count` y `query_count` (mensajes reales
de usuarios en sesiones con el bot).

## Reglas

- **Formatos:** PDF con texto seleccionable, Word `.docx`, `.txt`, `.md`.
  No se admiten `.doc` (Word 97-2003) ni PDF escaneados (sin texto).
- **Tamaño máximo:** 4 MB por archivo (Vercel limita el cuerpo de la petición a 4,5 MB).
- **Texto indexado por documento:** hasta 400.000 caracteres; si el documento
  es más largo se indexa la primera parte y la interfaz lo indica.
- **Quién gestiona documentos:** permiso `gestionar_documentos_neurobot`
  (Administrador, Súper Profesor, Profesor) y además ser el creador del bot o
  el Administrador.
- **Quién conversa con el bot (y usa sus documentos):** el creador, el
  Administrador y, dentro de la misma institución del creador, los usuarios de
  aulas donde el bot está asignado o cualquiera si el bot es público.
  Un usuario de otra institución recibe 403.
- Al eliminar un NeuroBot se eliminan sus documentos y fragmentos.

## Archivos

- `backend/app/models/bot_document.py` — modelos `BotDocument`, `BotDocumentChunk`.
- `backend/app/services/bot_documents.py` — validación, extracción, fragmentación, BM25, permisos.
- `backend/app/api/bot_documents.py` — endpoints.
- `backend/app/api/chat.py` — uso de la base de conocimiento en `/chat/start` y `/chat/message`.
- `backend/migrations/008_documentos_neurobots.sql` — tablas en Supabase.
- `backend/tests/test_bot_documents.py` — pruebas.
- `frontend/src/pages/teacher/components/NeuroBotsTab.tsx` — interfaz del profesor.
