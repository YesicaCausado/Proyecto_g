# Auditoría del rol Súper Profesor y sus relaciones con los demás roles

> Fecha: 20 de octubre de 2026 · Rama `main` · Alcance: panel del Súper Profesor
> (13 pestañas), su relación con Profesor, Estudiante y Administrador, y los
> módulos del Profesor que comparten datos con él (Grupos y NeuroAlertas).

## A. Estado general

No se da un porcentaje: la evidencia son pruebas automáticas del backend,
compilación y comprobación de tipos del frontend. **No hubo pruebas en el
navegador** (el entorno no tiene navegador ni base de datos Supabase), así que
ninguna interacción visual se declara probada a mano.

| Estado | Elementos |
|---|---|
| Verificado sin cambios | Autenticación (token revocado, cuenta o institución inactiva → rechazo), aislamiento institucional de profesores/estudiantes, calendario (permisos en backend), chat directo (regla de 15 min en servidor, sin acceso a conversaciones ajenas), moderación de NeuroBots, cadena profesor → NeuroBot → estudiante (`can_use_bot`), Reportes institucionales (17 pruebas propias), Seguridad (cierre real de sesiones) |
| Corregido y verificado con pruebas | Dashboard, Grupos (+ crear/editar), NeuroBots, NeuroAlertas (Súper y Profesor), Mensajería, Auditoría, Configuración (DANE), carga masiva de estudiantes, auditoría de edición/desactivación de usuarios, «Mis grupos» del profesor |
| Decisión del equipo | El Súper Profesor no usa IA generativa (RF-13 se ajusta en requisitos). Se retiraron color, zona horaria e idioma de Configuración; el logo ahora se muestra en todos los paneles de la institución |
| Sin implementar | Integraciones (RF-12) en el panel del Súper Profesor (ver I) |
| No verificable aquí | Google Drive/Calendar, envío real de correos (Brevo), captura facial/voz en navegador, migraciones en Supabase |

## B. Páginas del Súper Profesor

| Pestaña | Estado final | Problemas encontrados → corrección |
|---|---|---|
| Dashboard | Corregido | «Rendimiento por área» mostraba en realidad el % de grupos por materia → ahora es el promedio real por área. Promedios de profesores contaban como 0 a estudiantes sin sesiones y profesores sin datos salían con «0» en rojo → `null` / «Sin datos». El riesgo elegía la inscripción equivocada (orden alfabético de `risk_level`) y la materia salía vacía. Un error del servidor se mostraba como «¡Sin alertas activas!». Contaba estudiantes desactivados. |
| Profesores | Corregido | La edición no quedaba en auditoría (el registro se agregaba después del `commit`); la desactivación no se auditaba. |
| Estudiantes | Corregido | Igual que profesores (incluida la autorización del acudiente, que es un registro legal). Carga masiva: «Asignar lote a un profesor» se enviaba y el backend lo ignoraba → ahora «Inscribir el lote en un grupo» real, con cupo. Correo repetido → error 500 **después de enviar credenciales** de cuentas no guardadas → validación + envío tras el `commit`. La vista previa validaba distinto que la creación → misma función. |
| Grupos | Corregido | Faltaba crear y editar (RF-10) → implementado. «Total estudiantes» sumaba inscripciones (duplicaba) → estudiantes distintos. «Promedio global» incluía grupos sin datos como 0. Profesor desactivado no se distinguía. |
| NeuroBots | Corregido | Bots de profesores desactivados desaparecían (seguían activos para estudiantes). No contaba asignaciones individuales. Error de carga mostraba KPIs en 0. Sin función de crear (correcto). |
| NeuroAlertas | Corregido | «Marcar resuelta» solo en pantalla → persiste en BD y se reabre si cambia la condición. Lista cortada a 50 con contadores sobre el recorte. Error = «Sin alertas». Incluía estudiantes desactivados. N+1 por estudiante. |
| Reportes | Verificado | Sin cambios; fórmulas documentadas y `null` ante falta de datos. |
| Mensajería | Corregido | «Programar envío» simulado (salía de inmediato) → retirado. Papelera solo local → retirada. «Por grado» sin grado enviaba **a toda la institución**. Lecturas contaban cualquier mensaje del rector. Errores silenciados. |
| Calendario | Verificado | — |
| Auditoría | Corregido | Filtros aplicados en el navegador sobre los 50 últimos → en servidor con paginación. Comunicados mostraban JSON interno. Columna «Navegador» siempre vacía → retirada. CSV sin escapar comillas. |
| Configuración | Corregido | DANE duplicado → 500 por restricción única → 400 con mensaje. Color, zona horaria e idioma se guardaban sin efecto → retirados (UI y API; las columnas quedan en BD). El logo no se veía en ningún lado y no se podía quitar → se valida (PNG/JPG/WebP ≤ 2 MB), se puede quitar y aparece en el menú de los paneles de Súper Profesor, profesores y estudiantes (`GET /auth/institution-branding`). |
| Seguridad / Mi perfil | Verificado | — |

## C. Botones y acciones (cambios de clasificación)

| Rol · página | Acción | Antes | Ahora |
|---|---|---|---|
| Súper · Mensajería | Programar envío | Simulado | Retirado |
| Súper · Mensajería | Eliminar enviado | Simulado (local) | Retirado |
| Súper · Mensajería | Enviar «Por grado» sin grado | Roto (toda la institución) | Bloqueado (front y 400) |
| Súper · NeuroAlertas | Marcar resuelta / Reabrir | Simulado | Funcional |
| Súper · Grupos | Crear grupo / Editar | Sin implementar | Funcional |
| Súper · Estudiantes | Asignar lote | Simulado | Funcional (inscribir en grupo) |
| Súper · Auditoría | Filtros, Exportar CSV, Cargar más | Parcial | Funcional |
| Profesor · Mis grupos | Activar/Desactivar (menú) | Simulado | Retirado (el Súper reactiva) |
| Profesor · Mis grupos | Nuevo código (2 botones) | Sin implementar (vacío) | Funcional |
| Profesor · Mis grupos | Eliminar | Engañoso: desactivaba y, si fallaba, igual lo quitaba | «Desactivar grupo» con error visible |
| Profesor · Mis grupos | Imagen del grupo | Simulado | Retirado |
| Profesor · Mis grupos | Tarjeta «Tareas activas: 3» | Dato fijo | Reemplazada por «Creado» |
| Profesor · Mis grupos › Estudiantes | Lista | Roto (nombres y correos «—») | Funcional |
| Profesor · NeuroAlertas | Resolver | Simulado | Funcional |
| Profesor · NeuroAlertas › perfil | «Uso de IA 0 %», «Tendencia Negativa», gráfico 6 semanas, «NeuroInsight generado por IA» | Datos fabricados | Retirados; se muestran sesiones, tiempo, última actividad y factores reales |

El resto de acciones de las pestañas listadas como «Verificado» llama a un
endpoint real con validación en backend (inventario de llamadas revisado con
búsqueda de `api.*` en `frontend/src/pages/super`).

## D. Relaciones y permisos

La matriz completa está en `docs/MATRIZ_PERMISOS.md` (actualizada). Todas las
restricciones nuevas se aplican en el **backend**:

| Operación | Admin | Súper | Profesor | Estudiante | Otra institución |
|---|:-:|:-:|:-:|:-:|:-:|
| Crear/editar grupo de la institución | — | ✅ | solo los suyos | ❌ 403 | ❌ 404 |
| Asignar grupo a profesor inactivo / de otra institución | — | ❌ 400 | — | — | — |
| Resolver alerta (Súper) | — | ✅ | ❌ 403 | ❌ | ❌ 404 |
| Resolver alerta del aula | — | — | solo sus aulas (otra → 403) | ❌ | ❌ |
| Regenerar código | — | — | solo sus aulas | ❌ 403 | ❌ |
| Inscribir lote en grupo | — | ✅ (activo, con cupo) | ❌ | ❌ | ❌ 404 |
| Moderar NeuroBot (incl. de profesor inactivo) | ✅ | ✅ | solo propios | ❌ | ❌ 403 |

## E. Inventario de datos (indicadores tocados)

| Indicador | Fuente y fórmula | Sin datos |
|---|---|---|
| Profesores / Estudiantes activos | `users` de la institución, rol y `is_active` | 0 (conteo real) |
| Grupos activos | `classrooms.is_active` cuyo dueño es profesor o Súper de la institución (misma definición en Dashboard y Grupos) | 0 |
| En riesgo | Estudiantes activos distintos con `risk_level` medio/alto en una inscripción activa | 0 |
| Rendimiento por área | Media de `enrollments.average_score` con `total_sessions > 0`, por materia del grupo | Estado vacío |
| Promedio de profesor / grupo | Igual, escala 0-10 | `null` → «Sin datos» |
| Participación | Estudiantes con actividad en 7 días / estudiantes del profesor | `null` |
| NeuroBots: activos, públicos, documentos, consultas | `expert_bots`, `bot_documents`, mensajes `role=user` en `learning_sessions` del bot (consultas agrupadas, sin multiplicar por joins) | «—» si falla la carga |
| Lecturas de comunicado | `direct_messages.is_read` de los ids que entregó ese comunicado | 0 |
| NeuroAlertas | Reglas únicas en `services/neuroalert_service.py` | Lista vacía / error explícito |

Diferencia documentada (no es un error): el Dashboard usa el promedio de
seguimiento de la inscripción; **Reportes** usa quizzes y evaluaciones
oficiales con promedio por estudiante. Las etiquetas indican cada fuente.

## F. Hallazgos y correcciones

| ID | Grav. | Rol | Archivo | Causa → efecto | Corrección · prueba |
|---|---|---|---|---|---|
| H01 | Alta | Súper | `api/super_stats.py` | Comunicado «Por grado» sin grado caía al caso por defecto → mensaje a toda la institución | 400 + botón deshabilitado · `test_broadcast_by_grade_…` |
| H02 | Alta | Súper | `api/credentials.py` | Correo duplicado en CSV → 500 tras enviar credenciales de cuentas no creadas | Validación común + correos tras `commit` · `test_bulk_students_…` |
| H03 | Alta | Súper | `api/credentials.py` | `_log` después de `commit` → ediciones (y autorización del acudiente) sin auditoría | Orden corregido + auditoría de desactivaciones · `test_user_edits_…` |
| H04 | Alta | Profesor | `MisGruposTab.tsx` | Lectura de campos inexistentes → lista de estudiantes con «—» | Campos reales · build + revisión de esquema |
| H05 | Media | Súper/Prof. | `NeuroAlertasTab.tsx` ×2 | «Resolver» solo local | Tabla `alert_acknowledgements` + endpoints · `test_*_alerts_*` |
| H06 | Media | Profesor | `teacher/NeuroAlertasTab.tsx` | Métricas fabricadas en el perfil | Retiradas, datos reales del backend |
| H07 | Media | Súper | `DashboardGeneral.tsx`, `super_stats.py` | Gráfica mal rotulada, promedios con ceros falsos, riesgo mal elegido, error oculto | Recalculado · `test_dashboard_counts_…` |
| H08 | Media | Súper | `MensajeriaTab.tsx` | Programación y borrado simulados | Retirados |
| H09 | Media | Súper | `super_stats.py` | Lecturas inflaban con mensajes ajenos al comunicado | Ids guardados · `test_broadcast_reads_…` |
| H10 | Media | Súper | `super_stats.py` / `GruposTab.tsx` | Sin crear/editar grupos (RF-10) | Implementado · `test_super_creates_and_edits_groups_…` |
| H11 | Media | Súper | `UsersTabs.tsx`, `credentials.py` | Asignación de lote ignorada | Inscripción real con cupo · pruebas de carga |
| H12 | Media | Profesor | `MisGruposTab.tsx`, `classroom.py` | Regenerar código vacío, toggle local, «3» fijo, imagen falsa | Endpoint real / retirados · `test_teacher_classes_…` |
| H13 | Media | Súper | `AuditoriaTab.tsx`, `super_stats.py` | Filtros sobre 50 registros, JSON visible | Filtros en servidor · `test_audit_…` |
| H14 | Baja | Súper | `super_stats.py` | NeuroBots de profesores inactivos ocultos; sin asignaciones individuales | Incluidos · `test_bots_include_…` |
| H15 | Baja | Súper | `super_stats.py` | DANE duplicado → 500 | 400 · `test_institution_dane_…` |
| H16 | Baja | Todos | `super_stats.py`, `classroom.py` | Estudiantes desactivados en conteos, alertas y promedios | Excluidos · varias pruebas |
| H17 | Baja | — | `ai/cognitive/serverless_neuro_engine.py` | Valores 0,5 por defecto | Sin cambio: el módulo no se importa (código muerto) |

## G. Archivos modificados

Backend: `api/super_stats.py` (dashboard, alertas, grupos, bots, comunicados,
auditoría, institución), `api/credentials.py` (auditoría, carga masiva),
`api/classroom.py` (alertas, resolver, regenerar código, promedio),
`schemas/schemas.py` (`avg`, `enrolled`, `classroom`), **nuevos**
`models/alert_ack.py`, `services/neuroalert_service.py`,
`migrations/015_alertas_resueltas.sql`, `tests/test_auditoria_super_profesor.py`;
ajustado `tests/test_neurobots_notificaciones.py` (nuevo contrato `groups`).

Frontend: `pages/super/SuperDashboard.tsx` y `components/{DashboardGeneral,
GruposTab, NeuroBots, NeuroAlertasTab, MensajeriaTab, AuditoriaTab,
UsersTabs}.tsx`; `pages/teacher/components/{MisGruposTab, NeuroAlertasTab}.tsx`.

Docs: `docs/MATRIZ_PERMISOS.md`, `backend/migrations/README.md`, este archivo.
No se tocó el cambio pendiente del equipo en `backend/app/main.py`.

## H. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `backend/.venv/Scripts/python -m pytest -q` (antes) | 187 aprobadas |
| `backend/.venv/Scripts/python -m pytest -q` (después) | **202 aprobadas**, 0 fallidas (15 nuevas) |
| `frontend/node_modules/.bin/tsc -b` | Sin errores |
| `vite build` | Correcto |
| `eslint src/pages/super` (antes) | 72 errores preexistentes, casi todos `no-explicit-any` |

Durante el trabajo las pruebas nuevas detectaron dos fallas reales adicionales
(estudiantes desactivados en el detalle del grupo y en «Mis grupos»), ya
corregidas. No realizadas: E2E en navegador, pruebas contra Supabase,
integraciones de Google, captura de cámara/micrófono.

## I. Pendientes reales

1. **Ejecutar la migración 015 en Supabase** (el backend también crea la tabla
   al arrancar, así que no bloquea el despliegue).
2. **RF-13**: actualizar el documento de requisitos con la decisión (el Súper
   Profesor no usa IA generativa).
3. **RF-12**: el backend ya permite integraciones al Súper Profesor, pero su
   panel no tiene la pestaña. Montar `IntegracionesTab` requiere probar con
   credenciales de Google reales.
4. **Prueba manual en navegador** de las pantallas cambiadas (sección C) y del
   logo en los tres paneles.
5. Opcional: borrar `serverless_neuro_engine.py` (no se usa) y reducir los
   errores de lint `no-explicit-any`.

## J. Criterios de aceptación

Cumplidos con evidencia automática: datos simulados retirados en los módulos
auditados, indicadores con fuente y fórmula trazables, estados vacíos y de
error diferenciados, permisos críticos en backend con pruebas de otra
institución, persistencia verificada en BD, NeuroBots del Súper Profesor
reales, sin creación propia y coherentes con profesor y estudiante.
**No cumplidos todavía:** verificación en navegador y los puntos 2-3 de I. Por
eso no se declara el sistema al 100 %.
