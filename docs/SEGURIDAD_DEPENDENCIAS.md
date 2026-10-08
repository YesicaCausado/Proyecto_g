# Seguridad de dependencias — NeuroLearn IA

Análisis de vulnerabilidades conocidas en las dependencias del proyecto
(punto 10 del plan de cierre). Fuente: GitHub Advisory Database, la misma base
que consulta `npm audit`, cruzada con las versiones exactas de
`frontend/package-lock.json` y de los `requirements` de Python.

Fecha del análisis: 7 de octubre de 2026.

## 1. Frontend (npm)

### Estado antes del parche 10

`npm audit` reportaba **15 paquetes vulnerables: 9 altos, 4 moderados y 2
bajos** (83 avisos en total). Ninguno es crítico.

En todos los casos la versión corregida está **dentro del rango que ya admite
el paquete que la usa**, de modo que se corrigen sin cambios de versión mayor
y sin `npm audit fix --force`.

| Dependencia | Versión | Uso | Severidad (avisos) | Corregida en | La trae (rango permitido) | Compatibilidad | Actualización |
|---|---|---|---|---|---|---|---|
| `axios` | 1.14.0 | producción | Alta (12 altos, 21 moderados, 1 bajo): prototype pollution, fuga de credenciales de proxy, DoS, SSRF por `NO_PROXY` | 1.20.0 | directa (`^1.14.0`) | Misma API. `services/api.ts` usa `axios.getAdapter` y `defaults.adapter`, que no cambian en 1.20 | Mínimo `^1.20.0` en `package.json` |
| `react-router` | 7.13.2 | producción | Alta (5 altos, 4 moderados, 1 bajo): DoS, redirección abierta en `<Link>`/`useNavigate`, CSRF y XSS en modo RSC | 7.18.2 | `react-router-dom` 7.13.2 (versión exacta) | El frontend usa solo el modo declarativo (`HashRouter`, `Routes`, `Link`, `useNavigate`), estable en 7.x | Mínimo `react-router-dom ^7.18.2` |
| `form-data` | 4.0.5 | producción (dentro de axios) | Alta (1): inyección CRLF en multipart | 4.0.6 | `axios` (`^4.0.5`) | Solo la usa el adaptador de Node de axios; en el navegador no se carga | Llega con axios 1.20 |
| `follow-redirects` | 1.15.11 | producción (dentro de axios) | Moderada (1): fuga de cabeceras de autenticación en redirecciones | 1.16.0 | `axios` (`^1.15.11`) | Igual que `form-data` | Llega con axios 1.20 |
| `dompurify` | 3.4.11 | producción (dentro de jsPDF) | Moderada (1 moderado, 2 bajos): XSS con `IN_PLACE` | 3.4.16 | `jspdf` (`^3.3.1`) | Parche de la misma versión | `npm audit fix` |
| `fflate` | 0.6.10 | producción (dentro de three-stdlib) | Moderada (1): bucle infinito con ZIP64 mal formado | 0.6.11 | `three-stdlib` (`^0.6.9`) | Parche | `npm audit fix` |
| `vite` | 8.0.3 | desarrollo | Alta (3 altos, 2 moderados): lectura de archivos del servidor de desarrollo | 8.0.16 | directa (`^8.0.1`) | Sin cambios incompatibles hasta 8.3.x; sigue pidiendo Node `^20.19 \|\| >=22.12`; plugins (`@vitejs/plugin-react`, `vite-plugin-pwa`, `@tailwindcss/vite`) admiten `^8` | Mínimo `^8.0.16` |
| `postcss` | 8.5.8 | desarrollo (dentro de Vite) | Alta (2 altos, 2 moderados): lectura de archivos vía source maps | 8.5.23 | `vite` (`^8.5.8`) | Parche | Llega con Vite / `npm audit fix` |
| `nanoid` | 3.3.11 | desarrollo (dentro de PostCSS) | Alta (3): bucles infinitos, desbordamiento | 3.3.18 | `postcss` (`^3.3.11`) | Parche | `npm audit fix` |
| `source-map-js` | 1.2.1 | desarrollo | Alta (1): DoS con source maps indexados | 1.2.2 | `postcss`, `@tailwindcss/node` (`^1.2.1`) | Parche | `npm audit fix` |
| `brace-expansion` | 1.1.13 y 5.0.5 | desarrollo (ESLint, minimatch) | Alta (5 altos y 1–2 moderados en cada una): DoS por expansión | 1.1.21 y 5.0.12 | `minimatch` (`^1.1.7` y `^5.0.5`) | Parche | `npm audit fix` |
| `js-yaml` | 4.1.1 | desarrollo (ESLint) | Alta (3 altos, 1 moderado): consumo cuadrático de CPU | 4.3.2 | `@eslint/eslintrc` (`^4.1.1`) | Versión menor | `npm audit fix` |
| `@humanfs/node` | 0.16.7 | desarrollo (ESLint) | Moderada (1): copia siguiendo enlaces simbólicos | 0.16.8 | `eslint` (`^0.16.6`) | Parche | `npm audit fix` |
| `@babel/core` | 7.29.0 | desarrollo (PWA, ESLint) | Baja (1): lectura de archivos vía source maps | 7.29.6 | `workbox-build`, `eslint-plugin-react-hooks` (`^7.24.4`) | Parche | `npm audit fix` |
| `serialize-javascript` | 7.1.1 | desarrollo (PWA) | Baja (1): XSS en la salida serializada | 7.1.2 | `@rollup/plugin-terser` (`^7.0.3`) | Parche | `npm audit fix` |

**Uso «desarrollo»** significa que la librería solo corre en la máquina del
desarrollador o en el build (Vite, ESLint, Babel, Workbox); no llega al
navegador del usuario. Igual se corrigen, porque el servidor de desarrollo de
Vite expone archivos locales en la red.

### Cómo se aplicó

1. `package.json` sube el mínimo de las tres dependencias directas afectadas
   (`axios ^1.20.0`, `react-router-dom ^7.18.2`, `vite ^8.0.16`), para que una
   reinstalación nunca vuelva a una versión vulnerable.
2. `npm install` y luego `npm audit fix` (**sin `--force`**) actualizan el
   `package-lock.json` a las versiones corregidas dentro de los rangos
   existentes.

### Verificación

- `npm audit` → `found 0 vulnerabilities`.
- `npm run build` (`tsc -b && vite build`), el mismo comando de Vercel.
- CI: el job *Frontend* ejecuta ambos en cada push.
- Revisión manual de lo que tocan las librerías de producción actualizadas:
  - inicio de sesión y cualquier pantalla con datos (axios);
  - navegación entre paneles, enlaces y redirecciones al login (React Router);
  - exportar un reporte en PDF desde el panel del Súper Profesor (jsPDF);
  - el avatar 3D de la pantalla de inicio y del tutor (three-stdlib).

### Control continuo (GitHub Actions)

| Paso del job *Frontend* | Comando | Efecto |
|---|---|---|
| Auditoría de dependencias de producción | `npm audit --omit=dev --audit-level=moderate` | **Bloqueante**: la CI falla si una librería que llega al navegador tiene una vulnerabilidad moderada o mayor |
| Auditoría completa | `npm audit --audit-level=high` | **Informativa**: si una herramienta de desarrollo tiene una vulnerabilidad alta, la ejecución muestra una advertencia sin bloquear |

Cuando la CI falle por una vulnerabilidad nueva:

```bash
cd frontend
npm audit                 # ver cuál es y en qué versión se corrige
npm audit fix             # sin --force
npm run build
```

Si `npm audit` indica que la corrección exige un cambio de versión mayor
(«fix available via `npm audit fix --force`»), no se aplica a ciegas: se revisa
el changelog de esa dependencia, se prueba y se documenta aquí.

## 2. Backend (Python)

### Corregido en el parche 10

| Dependencia | Antes | Ahora | Motivo |
|---|---|---|---|
| `pytest` (solo pruebas) | 8.3.3 | 9.1.1 | GHSA-6w46-j5rx-g56g (moderada): manejo inseguro de `tmpdir`. Las 119 pruebas pasan con 9.1.1 sin cambios |
| `backend/requirements.txt` | 21 paquetes fijados a mano | `-r ../api/requirements.txt` + `uvicorn` | `pandas==2.1.4` y `numpy==2.1.0` eran incompatibles (el archivo no podía instalarse). `scikit-learn`, `numpy`, `pandas`, `joblib`, `openpyxl`, `openai` y `alembic` no se importan en ningún archivo del proyecto. Ahora local, Docker, pruebas y Vercel usan las mismas versiones |

### Corregido en el parche 10B: dependencias de producción (`api/requirements.txt`)

Antes del parche, lo que instala Vercel tenía **62 avisos conocidos** en sus
dependencias directas y 9 más en las indirectas fijadas por FastAPI 0.104.1
(`starlette` 0.27.x y `anyio` 3.7.x). Después del parche, ninguna de las
versiones fijadas tiene avisos en la GitHub Advisory Database.

| Dependencia | Antes | Ahora | Avisos que corrige | Exposición en NeuroLearn | Cambio en el código |
|---|---|---|---|---|---|
| `python-multipart` | 0.0.6 | 0.0.32 | 5 altos, 1 moderado, 3 bajos: DoS y ReDoS al procesar `multipart/form-data` | Alta: subida de documentos de NeuroBots, carga masiva CSV y adjuntos | Ninguno |
| `pypdf` | 5.1.0 | 6.19.0 | 10 altos, 36 moderados, 3 bajos: bucles infinitos y consumo de memoria con PDF manipulados | Alta: se extrae el texto de los PDF que suben los profesores | `bot_documents.py` atiende `LimitReachedError` (nuevo en pypdf 6) con un 422 y un mensaje claro |
| `starlette` | 0.27.0 (vía FastAPI) | 1.7.0 (fijada aparte) | 3 altos, 3 moderados, 1 bajo: DoS en formularios, límites ignorados, validación de `Host` | Alta | Ninguno (la app no usa `on_event` ni APIs retiradas en 1.0) |
| `fastapi` | 0.104.1 | 0.142.4 | Necesario para Starlette 1.x | — | Ninguno: las 166 rutas y el esquema OpenAPI son idénticos |
| `anyio` | 3.7.1 (vía FastAPI) | 4.x (la última que admite Starlette, ≥ 4.14.2) | 1 crítico, 1 moderado | Baja | Ninguno |
| `python-jose` | 3.3.0 | **retirada**, reemplazada por `PyJWT` 2.15.1 | 2 críticos (confusión de algoritmo; uno sin corrección) y 1 moderado; la librería está sin mantenimiento. También salen sus dependencias `ecdsa` (Minerva, sin corrección), `rsa` y `pyasn1` | Baja (HS256 con `algorithms=[...]` fijo), pero sin mantenimiento | `api/auth.py`: `import jwt` y `except InvalidTokenError`. Los tokens HS256 ya emitidos siguen siendo válidos |
| `pydantic` | 2.5.2 | 2.13.5 | Requerido por FastAPI 0.142 | — | Ninguno |
| `pydantic-settings` | 2.1.0 | 2.15.0 | Compatibilidad con pydantic 2.13 | — | Ninguno |
| `httpx` | 0.25.2 | 0.28.1 | Starlette 1.x exige ≥ 0.27 | — | Ninguno (la app usa `AsyncClient(timeout)`, `get`/`post`) |
| `python-dotenv` | 1.0.0 | 1.2.4 | 1 moderado (`set_key` sigue enlaces simbólicos) | Nula (solo se lee `.env`) | Ninguno |

Sin cambios porque no tienen avisos: `sqlalchemy` 2.0.23, `passlib[bcrypt]`
1.7.4, `bcrypt` 4.0.1, `psycopg2-binary` 2.9.9 y `cryptography` 50.0.2.

Solo para pruebas (`backend/requirements-dev.txt`) se agrega `httpx2` 2.13.0,
el cliente que usa `TestClient` desde Starlette 1.x.

**Diferencia de comportamiento con PyJWT:** una `SECRET_KEY` vacía ya no
firma tokens (`python-jose` lo permitía, lo que equivalía a no tener firma):
el inicio de sesión responde 500. Al arrancar, el servidor escribe en el log
`[SEGURIDAD] ERROR` si falta la clave o `[SEGURIDAD] AVISO` si tiene menos de
32 bytes, sin mostrarla nunca. En Vercel, `SECRET_KEY` debe existir y tener al
menos 32 caracteres. Si se cambia, las sesiones abiertas se cierran.

**Verificación:**

- Suite completa con las versiones nuevas: 121 pruebas aprobadas. Incluye dos
  pruebas nuevas:
  - tokens sin firma (`alg=none`), con otro algoritmo (HS512), sin `sub` o con
    `sub` no textual → 401;
  - un PDF que supera los límites de pypdf → 422.
- Un token emitido con `python-jose` se valida correctamente con PyJWT.
- Las 166 rutas de la API son las mismas antes y después.
- CI: `pip-audit -r ../api/requirements.txt` bloqueante en el job *Backend*.

### Cómo auditar Python

En el entorno con Python 3.12 (ver `docs/PRUEBAS.md`):

```bash
cd backend
uv pip install pip-audit==2.10.1
pip-audit -r ../api/requirements.txt
```

La CI ejecuta lo mismo en cada push: si aparece un aviso nuevo, el job
*Backend* falla y muestra el paquete, el aviso y la versión que lo corrige.
