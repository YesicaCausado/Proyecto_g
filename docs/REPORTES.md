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

---

# Reportes institucionales (Súper Profesor)

**Dónde:** Súper Profesor → Reportes.
**Código:** `backend/app/services/super_report_service.py` (cálculos),
`super_report_export.py` (CSV/PDF), `backend/app/api/super_reports.py` (API),
`frontend/src/pages/super/components/ReportesTab.tsx` y `reportes/`.

Reemplaza el `ReportesTab` anterior, que exportaba cuatro tablas desde
`/super/stats/dashboard`. Ese reporte tenía estos problemas: el selector de
período no filtraba nada, el «riesgo» venía del indicador neuroconductual
`Enrollment.risk_level`, los estudiantes sin actividad aparecían con promedio 0
y el reporte «áreas» solo contaba grupos por materia. `/super/stats/dashboard`
no se modificó (lo sigue usando el Dashboard).

## Endpoints (`/api/v1/super/reports`, solo Súper Profesor o admin con institución)

| Método y ruta | Contenido |
|---|---|
| `GET /filters` | Grupos, profesores, competencias, fuentes y estados para los filtros |
| `GET /overview` | Seis tarjetas, competencias + interpretación, grupos, profesores, evolución, calidad de datos |
| `GET /competencies/{key}` | Detalle de una competencia (distribución, evolución, grupos, estudiantes) |
| `GET /groups/{id}` | Detalle de un grupo |
| `GET /teachers/{id}` | Detalle de un profesor |
| `GET /students?q=&page=&size=` | Buscador paginado |
| `GET /students/{id}` | Ficha académica, puntos de la gráfica e historial |
| `GET /evaluations?page=&size=` | Evaluaciones con estado real e indicadores |
| `GET /evaluations/{id}` | Resultado por estudiante de una evaluación |
| `GET /followup?rule=&page=&size=` | Seguimiento académico con evidencia |
| `GET /export?section=&format=csv\|pdf` | `resumen`, `competencias`, `grupos`, `profesores`, `estudiante`, `evaluaciones`, `seguimiento`, `evolucion`, `calidad`, `completo` (requiere `exportar_reportes`) |

Filtros comunes: `start_date`, `end_date` (AAAA-MM-DD, hora de Colombia),
`classroom_id`, `teacher_id`, `student_id`, `competency`
(`matematicas|lectora|ingles|ciudadanas|cientifico`), `source`
(`todas|quiz|evaluacion`), `eval_status`, `threshold` (60), `min_results` (3).
Un grupo, profesor, estudiante o evaluación de otra institución → 404.

## Fuentes y fórmulas

- **Resultados:** quizzes adaptativos completados (`QuizHistory.performance_score`)
  y resultado oficial de las evaluaciones docentes (mejor intento calificado,
  `EvaluationSubmission.percentage`). Las dos fuentes usan % de aciertos de 0 a
  100, así que no hace falta convertirlas. Las entregas por calificar no entran
  en los promedios.
- **Competencia:** se toma del tema del quiz o de la materia del aula de la
  evaluación. Lo que no se puede clasificar entra solo en el promedio general.
- **Promedio:** media de los promedios por estudiante (cada estudiante pesa lo
  mismo).
- **Participación:** estudiantes con al menos un resultado ÷ estudiantes del
  alcance.
- **Variación:** diferencia frente al período anterior de igual duración, en pp.
  Solo se calcula con rango cerrado.
- **Grupo:** evaluaciones publicadas en el grupo + quizzes de sus estudiantes.
  El sistema no guarda el aula de un quiz (`classroom_id` siempre llega vacío).
- **Niveles:** Bajo < 60, Básico 60–79, Alto 80–91, Superior ≥ 92 (escala del
  Decreto 1290 con cortes 3,0 · 4,0 · 4,6 de la escala 1–5, pasados a %).
- **Comparaciones** (mejor/peor competencia, «relativamente alta/baja»): exigen
  al menos 3 estudiantes por competencia. «Relativamente alta/baja» = ±5 pp
  frente a la media de competencias. «Evolución» = ±3 pp frente al período
  anterior.
- **Evaluaciones:** finalización = estudiantes con entrega enviada ÷ inscritos.
  Abandono = abrieron un intento, no enviaron ninguno y se agotó el tiempo ÷ los
  que iniciaron.
- **Seguimiento:** cuatro reglas.
  - Bajo desempeño persistente: promedio de los últimos N resultados de una
    competencia menor que el umbral.
  - Descenso persistente: los últimos N resultados bajan uno tras otro, con una
    caída total ≥ 10 pp.
  - Evaluaciones vencidas: ≥ 2 evaluaciones vencidas sin ninguna entrega.
  - Inactividad: estudiante inscrito sin resultados en un período de ≥ 14 días.

  No se usan indicadores neurodigitales.

Los valores sin datos se devuelven como `null`, nunca como 0.

## Pendiente por falta de datos

- **Períodos académicos:** no están configurados en la institución. «Año escolar
  en curso» usa el año calendario.
- **Flujo de gestión de casos de seguimiento:** no existe (abierto, en
  seguimiento, cerrado).
- **Competencia explícita en `TeacherEvaluation`:** no existe. Hoy se deduce de
  la materia del aula.
- **Aula del quiz** (`QuizHistory.classroom_id`): no se llena al generarlo.

Pruebas: `backend/tests/test_super_reports.py`.
