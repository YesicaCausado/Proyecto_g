# Exportar reporte (profesor)

**Dónde:** Profesor → Analítica → «Exportar reporte».
**Endpoint:** `GET /api/v1/teacher/reports/export` (permiso `exportar_reportes`).

| Parámetro | Valores | Por defecto |
|---|---|---|
| `report` | `resumen` · `quizzes` · `evaluaciones` | `resumen` |
| `format` | `csv` · `pdf` | `csv` |
| `classroom_id` | id de un grupo del alcance | todos |
| `start_date`, `end_date` | `AAAA-MM-DD` (hora de Colombia, ambos incluidos) | sin límite |

## Contenido

- **Resumen por estudiante:** grupo(s), quizzes adaptativos completados y su
  promedio, evaluaciones entregadas / publicadas y su promedio (mejor intento),
  progreso, nivel de riesgo y última actividad.
- **Quizzes adaptativos:** fecha, estudiante, grupo(s), competencia / tema,
  dificultad, preguntas, correctas, puntaje (%) y tiempo.
- **Evaluaciones:** por evaluación publicada y estudiante del grupo: estado,
  intentos, puntaje, nota (%) y fecha de entrega.

Encabezado: institución, quién lo generó y cuándo (hora de Colombia), grupo,
periodo y totales (estudiantes, quizzes, promedio de quizzes, evaluaciones).

## Reglas

- **Alcance:** Profesor = sus grupos activos. Súper Profesor = grupos activos
  de los profesores de su institución. Otros roles: 403. Un grupo fuera del
  alcance: 404.
- **Mismas cifras que el Centro de Analítica:** los quizzes se cuentan por
  estudiante inscrito (igual que `GET /teacher/stats`); el promedio de quizzes
  del encabezado es el mismo `avg_global` del panel (en %, el panel lo muestra
  sobre 10).
- **Sin archivos vacíos:** si los filtros no producen filas, responde 404 con el
  motivo y no se descarga nada.
- **Formatos:** CSV en UTF-8 con BOM, separador `;` y coma decimal (se abre
  directamente en Excel en español). PDF A4 horizontal, generado en el backend
  sin dependencias externas (`app/services/pdf_table.py`), con paginación.
- **Nombre del archivo:** `reporte_<tipo>_<grupo|todos>[_AAAAMMDD-AAAAMMDD].<csv|pdf>`.

Archivos: `backend/app/api/teacher_reports.py`,
`backend/app/services/teacher_report_service.py`,
`backend/app/services/pdf_table.py`,
`frontend/src/pages/teacher/components/ExportReportModal.tsx`,
`backend/tests/test_teacher_reports.py`.
