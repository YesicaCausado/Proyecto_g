# Evaluaciones profesor → estudiante

## Flujo

```
PROFESOR   Crear (borrador) → grupo, tipo, fecha límite, tiempo, intentos
           → preguntas (manuales o generadas con IA, ver parche 3) → Guardar borrador
           → Publicar
ESTUDIANTE Evaluaciones (menú) o la página de la clase → abrir → Comenzar
           → responder (se guarda el progreso) → Enviar → confirmación
           → nota (cuando no hay preguntas abiertas) → corrección al cerrar o vencer
PROFESOR   Resultados → estudiantes, intentos, nota oficial, respuestas
           → calificar preguntas abiertas → Cerrar
```

## Reglas

| Tema | Regla |
|---|---|
| Estados | `borrador` (solo el profesor) → `publicada` (la responden los estudiantes del aula) → `cerrada` (sin entregas; se ve la corrección). No se reabre. |
| Edición | Solo mientras nadie la haya empezado y no esté cerrada. |
| Quién la ve | Estudiantes con inscripción activa en el aula (activa) de la evaluación. Otras aulas u otra institución reciben 404. |
| Fecha límite | Último día para entregar, hasta las 23:59:59 hora de Colombia. Vacía = sin límite. No puede estar en el pasado al crear, editar o publicar. |
| Tiempo | `duration` minutos desde que el estudiante abre el intento, sin pasar de la fecha límite. Margen de red de 60 s. |
| Tiempo agotado | El intento se envía solo con las respuestas guardadas (`auto_submitted`). |
| Intentos | Máximo `attempts` por estudiante; cada intento abierto cuenta. |
| Nota oficial | El mejor intento calificado. |
| Calificación | Selección múltiple y V/F: automática en el servidor. Abiertas: quedan *pendientes de revisión* hasta que el profesor asigna puntos (0 a los puntos de la pregunta) y comentario. |
| Corrección para el estudiante | Respuestas correctas, explicación y comentarios solo cuando la evaluación está cerrada o venció la fecha límite. Antes, solo su puntaje. |
| Duplicados | Un intento por número (`UNIQUE evaluation_id, student_id, attempt_number`); el envío es atómico (un segundo envío recibe 409). |
| Emparejamiento | Retirado del editor. Preguntas antiguas de ese tipo se califican como selección múltiple. |

## Endpoints

Profesor (`gestionar_evaluaciones`): `GET/POST /teacher/evaluations`,
`PUT /teacher/evaluations/{id}`, `POST …/{id}/publish`, `POST …/{id}/close`,
`DELETE …/{id}`, `GET …/{id}/results`, `GET …/{id}/submissions/{sid}`,
`POST …/{id}/submissions/{sid}/grade`.

Estudiante (`participar_en_aulas`): `GET /student/evaluations[?classroom_id=]`,
`GET /student/evaluations/{id}`, `POST …/{id}/start`, `PUT …/{id}/progress`,
`POST …/{id}/submit`.

## Archivos

- `backend/app/models/evaluation.py` — `TeacherEvaluation`, `EvaluationSubmission`.
- `backend/app/services/evaluation_service.py` — fechas, tiempo, calificación, intentos.
- `backend/app/api/teacher_evaluations.py`, `backend/app/api/student_evaluations.py`.
- `backend/migrations/009_evaluaciones_estudiantes.sql` — ejecutar en Supabase **antes** de desplegar.
- `frontend/src/pages/teacher/components/EvaluacionesTab.tsx`, `EvaluationResults.tsx`.
- `frontend/src/pages/student/EvaluationsPage.tsx`, `frontend/src/components/evaluations/`.
- `backend/tests/test_evaluaciones_estudiantes.py`.
