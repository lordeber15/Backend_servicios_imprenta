# Notas de seguridad

Registro de decisiones de seguridad del backend. Complementa el informe de auditoría (`../INFORME_SEGURIDAD.md`) y la doc de Fase 0 (`../FASE_0_LIMPIEZA_REPO.md`).

## Estado por fases
- **Fase 0 (limpieza del repo):** documentada, pendiente de ejecución.
- **Fase 1 (autenticación):** ✅ hecha. Autenticación global con lista blanca (`authGlobal.middleware.js`), autorización por rol (`authorize.middleware.js`), rate limit en login, validación de DNI, descargas de XML autenticadas en el frontend.
- **Fase 2 (endurecimiento):** ✅ hecha. Ver abajo.

## Fase 2 — decisiones

### Esquema de BD por entorno
`main.js` usa `sync({ alter: true })` solo fuera de producción. En producción `sync()` sin alter (crea tablas que falten, nunca altera/elimina columnas). Requiere `NODE_ENV=production` (definido en `docker-compose.yml`, por defecto production). Los cambios de esquema en prod se gestionan con los SQL de `migrations/`.

### Swagger
`/api-docs` solo se monta si `NODE_ENV !== "production"`. En producción no existe.

### Manejo de errores
Todos los controllers delegan los errores en el manejador global (`app.js`) vía `next(error)`. El handler oculta el detalle de los 5xx (`"Error interno del servidor"`) y solo muestra el mensaje en los 4xx controlados (clases de `utils/errors.js`). Esto eliminó ~127 respuestas que filtraban `error.message`/`stack`/SQL al cliente.

### CORS y peticiones sin Origin
`app.js` permite peticiones sin cabecera `Origin` (health checks, curl, server-to-server). **No es un agujero de acceso:** desde la Fase 1 toda ruta de negocio exige token JWT, así que CORS ya no es la barrera de autenticación, solo controla qué orígenes de navegador pueden leer respuestas. Se mantiene por compatibilidad con sondas de salud y clientes no-navegador.

### Rate limiting
- `POST /auth/login`: por usuario, 10 intentos/15 min, no cuenta los aciertos (`rateLimit.middleware.js` → `authLimiter`).
- `GET /api/reniec/:dni`: por IP, 20/min, cuenta todo (cada llamada gasta la API key de DECOLECTA) → `reniecLimiter`.

## Vulnerabilidades de dependencias

### Corregidas (actualizaciones sin breaking, verificadas)
| Paquete | Versión | Motivo |
|---|---|---|
| `@xmldom/xmldom` | 0.8.11 → 0.8.13 | XML injection (CDATA/DocumentType/PI/comment) + DoS por recursión. Parseo del CDR de SUNAT. |
| `adm-zip` | 0.5.16 → 0.6.0 | Prototype pollution + OOM. Solo `extractEntryTo()` cambió (no se usa). |
| `axios` | 1.13.5 → 1.18.1 | SSRF + prototype pollution (back y front). |
| `node-forge` | 1.3.3 → 1.4.0 | basicConstraints bypass, Ed25519, DoS. Firma del certificado SUNAT. |
| `multer` | 2.0.2 → 2.2.0 | DoS por cleanup incompleto / recursión. Subida de imágenes. |
| `sequelize` | 6.37.7 → 6.37.8 | Parche. |

### NO perseguidas (no alcanzables) — cadena de Puppeteer
`npm audit` reporta 1 crítica (`basic-ftp`) y varias high (`ws`, `tar-fs`) que cuelgan **exclusivamente** de la cadena de descarga de navegador de Puppeteer:
`puppeteer → @puppeteer/browsers → proxy-agent → get-uri → basic-ftp`

El `Dockerfile` usa `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` + Chromium del sistema (`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`), por lo que **ese código nunca se ejecuta**. No hay superficie de ataque real. Se corregirán cuando Puppeteer publique una versión con la cadena actualizada; no justifican un cambio breaking hoy.

### Transitivas sin fix no-breaking
`body-parser`, `path-to-regexp` (de `express` 4.x; `express` 5 sería un major breaking), `lodash`/`uuid` (de `sequelize`), `underscore` (de `pg-hstore`), `ip-address` (de `express-rate-limit`). Mayormente DoS de severidad moderada en dependencias profundas, sin parche dentro del major actual. Revisar cuando se actualicen los paquetes raíz.

### Frontend
Quedan alertas en dependencias de build (vite/esbuild/rollup) que **no se envían al navegador** (solo se usan al compilar). Sin riesgo en runtime.
