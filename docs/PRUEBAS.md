# Pruebas automáticas del backend — NeuroLearn IA

La suite del backend comprueba **comportamiento real** de la API (FastAPI +
SQLAlchemy) en proceso: hace peticiones HTTP con `TestClient` contra la
aplicación real, sobre una base SQLite en memoria creada para cada clase de
pruebas. No hay pruebas que solo verifiquen que una pantalla carga.

## Cómo ejecutarlas

**Requisito: Python 3.12** (la versión de Vercel y de GitHub Actions). Con
Python 3.13 o 3.14 algunas librerías fijadas no tienen paquetes compilados y
`pip` intenta compilarlas, lo que falla.

`requirements-dev.txt` instala exactamente las dependencias de producción
(`api/requirements.txt`, lo que instala Vercel) más pytest, para que las
pruebas corran con lo mismo que corre en producción.

Preparar el entorno, una sola vez (por ejemplo en GitHub Codespaces):

```bash
cd backend
pip install uv
uv venv --python 3.12 .venv
source .venv/bin/activate          # el prompt empieza con (.venv)
uv pip install -r requirements-dev.txt
```

En cada terminal nueva basta con `source .venv/bin/activate`. Luego, desde
`backend/`:

```bash
python -m pytest                        # toda la suite
python -m pytest -v                     # con el nombre de cada prueba
python -m pytest tests/test_auth_roles.py -v          # un archivo
python -m pytest tests/test_auth_roles.py -k token    # por nombre
```

En Windows (PowerShell) es igual, con el intérprete del entorno virtual:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -v
```

Las pruebas escritas con `unittest` también se pueden ejecutar sin pytest,
módulo por módulo:

```bash
python -m unittest tests.test_auth_roles -v
python -m unittest tests.test_flujo_institucional -v
```

> `python -m unittest discover` **no** es el ejecutor de la suite: intentaría
> importar los scripts manuales antiguos (ver más abajo), que llaman a un
> servidor en vivo. Use `python -m pytest`.

Resultado esperado: `139 passed` (≈ 12 s). No requiere internet, servidor
levantado, base de datos ni claves de IA o de correo.

## Aislamiento: qué nunca tocan las pruebas

`tests/entorno_pruebas.py` fija las variables de entorno **antes** de importar
la app. Lo carga `tests/conftest.py` (pytest) y cada archivo de pruebas que usa
la app (para que también quede aislado con `unittest`). Las variables de
entorno tienen prioridad sobre `backend/.env`, así que se imponen aunque exista
un `.env` con datos reales:

| Variable | Valor en pruebas | Efecto |
|---|---|---|
| `DATABASE_URL` | `sqlite:///:memory:` | Nunca se usa Supabase ni `neurolearn.db` |
| `EMAIL_PROVIDER` | `console` | Nunca se envían correos reales por Brevo |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | vacías | Nunca se llama a la IA; donde se necesita, se usa un doble (`unittest.mock`) |
| `SECRET_KEY` | clave exclusiva de pruebas | Los tokens de prueba no sirven en producción |
| `PASSWORD_RESET_MIN_RESPONSE_SECONDS` | `0` | La recuperación de contraseña no espera el tiempo mínimo anti-enumeración |

Verificado: con un `.env` y variables exportadas que apuntan a una base
PostgreSQL y a Brevo, la suite pasa igual y no se envía ningún correo.

## Qué cubre

### Autenticación, roles, permisos y aislamiento — `tests/test_auth_roles.py` (12 pruebas)

Reemplaza las pruebas de humo manuales (`test_login.py`, `test_all_logins.py`,
recorridos por rol y `_audit_live_tests.ps1`). Usa dos instituciones (A y B),
cada una con Súper Profesor, Profesor y Estudiante, más un Administrador.

| Caso | Qué se comprueba |
|---|---|
| Login correcto (4 roles) | 200, rol correcto, `sub` del JWT = usuario |
| Login incorrecto | Contraseña errada y usuario inexistente → 401 con el **mismo** mensaje (no revela si el usuario existe) |
| Usuario o institución desactivados | Login → 403 |
| Contraseña temporal | `must_change_password` en la respuesta |
| Fuerza bruta | Tras `RATE_LIMIT_MAX_REQUESTS` fallos → 429 |
| Token | Ausente, basura, alterado, firmado con otra clave, vencido, usuario borrado → 401; usuario desactivado después de emitido → 403 |
| Algoritmo y claims | Token sin firma (`alg=none`), firmado con HS512, sin `sub` o con `sub` no textual → 401 |
| Matriz de permisos | Cada endpoint protegido se llama con los 4 roles; solo los roles permitidos reciben 200, el resto 403 (ver tabla abajo) |
| Generación con IA | `POST /teacher/ai/generate` → 403 para Súper Profesor y Estudiante |
| Sin autenticación | Endpoints protegidos → 401 |
| Aislamiento por institución | El Súper Profesor B no ve profesores de A ni edita un profesor de A; el Profesor B no ve estudiantes de un aula de A; un bot privado ajeno → 403; `shared-with-me` no incluye bots públicos de otra institución; un reporte con `classroom_id` de otra institución → 404 |
| Administrador global | Ve todas las instituciones |
| Recuperación de contraseña de punta a punta | Respuesta genérica igual para usuario inexistente (sin enviar correo); el enlace llega en el correo capturado; validar token; token inválido → 400; restablecer; el token es de un solo uso; la contraseña anterior deja de funcionar y la nueva funciona |

Matriz de permisos probada (✔ = 200, el resto 403):

| Endpoint | Admin | Súper Prof. | Profesor | Estudiante |
|---|:-:|:-:|:-:|:-:|
| `GET /admin/users`, `/admin/institutions`, `/admin/config` | ✔ | | | |
| `GET /super/teachers` | | ✔ | | |
| `GET /super/stats/dashboard` | ✔ | ✔ | | |
| `GET /teacher/stats` | ✔ | ✔ | ✔ | |
| `GET /teacher/evaluations`, `/classrooms/my-classes` | | | ✔ | |
| `GET /teacher/reports/export` | | ✔ | ✔ | |
| `GET /classrooms/my-enrolled`, `/student/evaluations` | | | | ✔ |
| `GET /auth/me`, `/consents/me` | ✔ | ✔ | ✔ | ✔ |

### Flujo institucional completo — `tests/test_flujo_institucional.py`

Recorre de punta a punta el alta B2B con los 4 roles, verificando datos en cada
paso:

1. El Administrador crea la institución y recibe las credenciales del Súper Profesor.
2. Primer ingreso con contraseña temporal → cambio obligatorio → la temporal deja de servir.
3. El Súper Profesor crea un profesor y un estudiante (mismo ciclo de contraseña temporal).
4. El profesor crea un aula y un NeuroBot y lo asigna al aula.
5. El estudiante se une con el código de invitación; ve el aula y el bot asignado; el profesor lo ve en su lista.
6. Acciones prohibidas por rol → 403 (estudiante crea aula, profesor se une a un aula, Súper Profesor inicia chat, estudiante ve alertas, Súper Profesor lista usuarios globales).
7. El estudiante inicia chat con el bot del aula (IA reemplazada por un doble).
8. El Administrador desactiva la institución: los tokens vigentes de sus usuarios → 403 y el login → 403; el Administrador sigue activo. Al reactivarla, vuelven a entrar.

### Resto de la suite

| Archivo | Pruebas | Cubre |
|---|--:|---|
| `test_dependencias_produccion.py` | 4 | Toda librería que importa `backend/app` está en `api/requirements.txt` (lo que instala Vercel); detecta casos como el de `cryptography` |
| `test_password_reset_service.py` | 25 | CU-03 a nivel de caso de uso: límites (cooldown, 3/hora), hash del token, expiración, contraseña débil, adaptador de Brevo, plantilla |
| `test_security.py` | 7 | Validación de origen (CSRF), bloqueo por fuerza bruta, XSS y SQLi en login, cabeceras de seguridad |
| `test_bot_documents.py` | 15 | Documentos de NeuroBots: validación, extracción PDF/DOCX/TXT, PDF que excede los límites del lector, recuperación, permisos por institución |
| `test_preguntas_ia.py` | 8 | Generación de preguntas con IA (doble), normalización, errores 502/503 sin datos falsos |
| `test_evaluaciones_estudiantes.py` | 5 | Ciclo borrador → publicada → cerrada, intentos, envío atómico, calificación |
| `test_consentimientos.py` | 6 | Consentimiento de cámara y micrófono, versiones, retiro, efecto en el chat |
| `test_teacher_reports.py` | 6 | Exportación CSV/PDF y alcance por rol |
| `test_institucion_usuario.py` | 2 | Nombre real de la institución en login y `/auth/me` |
| `test_adaptive_system.py` | 12 | Modelo del estudiante y motor de adaptación pedagógica |
| `test_patterns.py` | 14 | Patrones neuroconductuales |
| `test_integration_service.py` | 4 | Cifrado de tokens, webhooks reales a un servidor local, automatizaciones |
| `test_crear_admin.py` | 5 | Alta del Administrador global con `scripts/crear_admin.py`: inicia sesión y crea instituciones, política de contraseñas, no pisa cuentas ni cambia roles, nunca imprime la contraseña |
| `test_neurobots_notificaciones.py` | 13 | Parche 11B: flujo completo profesor asigna NeuroBot → notificación → Mis NeuroBots → chat → progreso → completado → resultado al profesor; el respaldo local no cuenta como interacción; meta y desasignación; roles y aislamiento por institución; asignación + notificación atómicas; estado leído y contador persistidos; mensajes directos agrupados y preferencias; evaluación publicada; alerta de riesgo alto; grupo nuevo y estudiante que se une; racha persistida una vez; moderación del Súper Profesor |

## Scripts manuales que no forman parte de la suite

Se ejecutan a mano desde `backend/`; pytest no los recoge:

- `python -m tests.test_chatbot_interactive`: conversación interactiva por
  terminal con el chatbot adaptativo (excluido en `tests/conftest.py`).
- `python -m tests.test_8_states`: valida que el motor detecte los 8 estados
  cognitivos con confianza > 0,6 e imprime el resultado (no define funciones
  `test_*`).

En el parche 11 se retiraron los scripts manuales obsoletos:

- de `tests/`: `test_e2e_sprint3.py` y `test_full_flow.py` (usaban el registro
  público, que ya no existe), `test_automated.py` (fallaba con el motor actual)
  y `test_bots_preentrenados.py` (probaba bots que ya no existen);
- de `backend/`: `test_login.py`, `test_all_logins.py`, `test_db_connection.py`,
  `_audit_live_tests.ps1`, `_audit_db_inspect.py` y `_verify_patterns.py`.

Sus escenarios útiles (login de los 4 roles, flujo por rol, recuperación,
patrones) están cubiertos por `test_auth_roles.py`, `test_flujo_institucional.py`
y `test_patterns.py`.

## Integración continua (GitHub Actions)

`.github/workflows/ci.yml` ejecuta todo esto automáticamente en GitHub en cada
`push` (a cualquier rama) y en cada pull request hacia `main`. No usa secretos
ni servicios externos y solo tiene permiso de lectura sobre el repositorio.
Los cambios que solo tocan documentación (`*.md`, `docs/`) no lo disparan.

| Job | Qué hace | Falla si… |
|---|---|---|
| **Backend · pruebas y auditoría (Python 3.12)** | Instala `backend/requirements-dev.txt` (dependencias de producción + pytest), ejecuta `python -m pytest -v` y `pip-audit -r ../api/requirements.txt` | alguna prueba falla, falta una dependencia en `api/requirements.txt`, una dependencia de producción tiene una vulnerabilidad conocida o una prueba modificó un archivo versionado (por ejemplo `neurolearn.db`) |
| **Frontend · auditoría y compilación (Node 22)** | `npm ci`, `npm audit` y `npm run build` (`tsc -b && vite build`), el mismo comando de Vercel | una dependencia de producción tiene una vulnerabilidad moderada o mayor, hay errores de TypeScript o la compilación de Vite falla |

Cómo ver el resultado:

- En GitHub, cada commit muestra ✓ (todo bien), ✗ (algo falló) o un punto
  amarillo (en ejecución) junto a su mensaje, y el README muestra la insignia
  **CI** con el estado de `main`.
- La pestaña **Actions** del repositorio lista cada ejecución. Al abrir una con
  ✗ se ve el job y el paso que fallaron, con la salida completa de pytest o de
  `tsc`.
- Para relanzar una ejecución: **Actions → CI → Run workflow**, o el botón
  **Re-run jobs** dentro de la ejecución.

Si la CI falla, se reproduce el mismo error en local con los comandos de
arriba (backend) o con `cd frontend && npm ci && npm run build` (frontend),
se corrige y se hace un nuevo `push`.

El workflow `deploy-pages.yml` (publicación en GitHub Pages) es independiente y
sigue funcionando igual.

## Escribir una prueba nueva

1. Crear `backend/tests/test_<tema>.py`.
2. Importar el entorno aislado **antes** que cualquier módulo de `app`:

   ```python
   sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
   import tests.entorno_pruebas  # noqa: E402,F401
   ```

3. Crear un motor SQLite en memoria con `StaticPool`, `Base.metadata.create_all`,
   y reemplazar `get_db` con `app.dependency_overrides` (ver cualquier archivo
   de la tabla anterior).
4. Reemplazar la IA o el correo con `unittest.mock.patch.object` cuando el caso
   lo necesite. Nunca depender de servicios externos.
5. Comprobar respuestas y datos (códigos de estado, contenido, filas en la BD),
   no solo que el endpoint responda.
