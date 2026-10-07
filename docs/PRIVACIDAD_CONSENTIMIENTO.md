# Privacidad: consentimiento de cámara y micrófono

## Qué hace el sistema (verificado en el código)

| Función | Dónde se procesa | Qué sale del dispositivo | Qué NO se guarda |
|---|---|---|---|
| Cámara — detección facial (`useFacialDetection.ts`) | En el navegador, con MediaPipe Face Landmarker (archivos servidos desde `/mediapipe`) | Indicadores numéricos en `facial_data` de `/chat/message`: emoción estimada, valencia, activación, atención, parpadeo, ceño, sonrisa, mirada | Video, fotos, huella biométrica |
| Micrófono — prosodia (`useVoiceProsody.ts`) | En el navegador, con Web Audio API | Indicadores numéricos en `voice_data`: tono, volumen, ritmo, pausas, muletillas, temblor, energía | Audio |
| Micrófono — modo de voz (`useVoiceTutor.ts`) | Reconocimiento de voz del navegador; en Chrome/Edge lo hacen servicios en línea de Google/Microsoft | Solo el texto dictado llega a NeuroLearn | Audio |

Los indicadores se guardan con los mensajes del chat (`chat_messages.extra_data`,
`cognitive_events`) y alimentan el motor neuroconductual.

## Flujo de consentimiento

```
Estudiante pulsa Cámara / Micrófono en el chat
  → ¿consentimiento vigente? (GET /consents/me)
       sí → se activa el dispositivo (el navegador pide su propio permiso)
       no → modal con el texto vigente → casilla + "Acepto y activar"
              → POST /consents (usuario, tipo, versión, fecha y hora UTC, IP, navegador)
              → se activa el dispositivo
            "No acepto" → no se activa nada y se informa
Mi Perfil → Privacidad → Retirar → DELETE /consents/{tipo}
```

- **Antes del consentimiento no se llama a `getUserMedia`.** La única forma de
  activar cámara o micrófono es `requestDevice()` en `ChatPage.tsx`.
- **El servidor también lo exige:** `/chat/message` y `/chat/patterns/save`
  descartan `facial_data` / `voice_data` si el usuario no tiene el
  consentimiento vigente.
- **Versiones:** los textos están en `backend/app/services/consent_service.py`
  con su versión. Si cambia lo que hace el código, se actualiza el texto y la
  versión; los consentimientos anteriores dejan de valer y se pide de nuevo.
- **Permiso del navegador denegado / sin dispositivo:** los hooks muestran el
  motivo (permiso bloqueado, sin cámara/micrófono, dispositivo en uso). Si no hay
  dispositivo, el botón no se ofrece.
- **Retirar:** el registro conserva la aceptación y marca `revoked_at`; volver a
  aceptar crea un registro nuevo (historial auditable).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/consents/me` | Estado y textos vigentes |
| POST | `/api/v1/consents` | `{consent_type, version, accepted: true}` → 201 · 400 sin aceptación explícita · 409 versión desactualizada |
| DELETE | `/api/v1/consents/{camara_facial \| microfono_voz}` | Retirar |

## Pendiente de validar (no técnico)

Los datos faciales y de voz pueden considerarse datos sensibles y la mayoría de
estudiantes son menores de edad (Ley 1581 de 2012 y Decreto 1377 de 2013). El
texto avisa que el menor debe usar la función solo si la institución cuenta con
la autorización del acudiente, pero **el sistema no registra esa autorización**.
Esto debe revisarlo el equipo con la institución o asesoría jurídica.
