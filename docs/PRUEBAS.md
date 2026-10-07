# Pruebas automáticas del backend — NeuroLearn IA

La suite del backend comprueba **comportamiento real** de la API (FastAPI +
SQLAlchemy) en proceso: hace peticiones HTTP con `TestClient` contra la
aplicación real, sobre una base SQLite en memoria creada para cada clase de
pruebas. No hay pruebas que solo verifiquen que una pantalla carga.

## Cómo ejecutarlas

Desde la carpeta `backend/`, con el entorno virtual del proyecto activo:

```bash
pip install -r requirements-dev.txt     # requirements.txt + pytest

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

Resultado esperado: `115 passed` (≈ 7 s). No requiere internet, servidor
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

### Autenticación, roles, permisos y aislamiento — `tests/test_auth_roles.py`

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
| `test_password_reset_service.py` | 25 | CU-03 a nivel de caso de uso: límites (cooldown, 3/hora), hash del token, expiración, contraseña débil, adaptador de Brevo, plantilla |
| `test_security.py` | 7 | Validación de origen (CSRF), bloqueo por fuerza bruta, XSS y SQLi en login, cabeceras de seguridad |
| `test_bot_documents.py` | 14 | Documentos de NeuroBots: validación, extracción PDF/DOCX/TXT, recuperación, permisos por institución |
| `test_preguntas_ia.py` | 8 | Generación de preguntas con IA (doble), normalización, errores 502/503 sin datos falsos |
| `test_evaluaciones_estudiantes.py` | 5 | Ciclo borrador → publicada → cerrada, intentos, envío atómico, calificación |
| `test_consentimientos.py` | 6 | Consentimiento de cámara y micrófono, versiones, retiro, efecto en el chat |
| `test_teacher_reports.py` | 6 | Exportación CSV/PDF y alcance por rol |
| `test_institucion_usuario.py` | 2 | Nombre real de la institución en login y `/auth/me` |
| `test_adaptive_system.py` | 12 | Modelo del estudiante y motor de adaptación pedagógica |
| `test_patterns.py` | 14 | Patrones neuroconductuales |
| `test_integration_service.py` | 4 | Cifrado de tokens, webhooks reales a un servidor local, automatizaciones |

## Scripts manuales que no forman parte de la suite

`tests/conftest.py` excluye de la colección estos scripts antiguos, que se
ejecutan a mano con `python -m tests.<nombre>`:

- `test_automated.py`, `test_bots_preentrenados.py`, `test_chatbot_interactive.py` (interactivo): simulaciones con `print`, sin aserciones.
- `test_e2e_sprint3.py`, `test_full_flow.py`: llaman por HTTP a un servidor en `localhost` y usan el registro público, que ya no existe (alta B2B).
- `test_8_states.py`: script de validación sin funciones de prueba.

Sus escenarios útiles (login, flujo por rol, recuperación) quedaron cubiertos
por `test_auth_roles.py` y `test_flujo_institucional.py`. Los scripts sueltos
de `backend/` (`test_login.py`, `test_all_logins.py`, `_audit_live_tests.ps1`,
`_audit_db_inspect.py`) también quedan reemplazados; su retiro se hace en el
punto de limpieza del repositorio.

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
