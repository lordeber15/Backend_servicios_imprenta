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
- `POST /auth/login`: por usuario 10 fallos/15 min **y** por IP 30 fallos/15 min (contra password spraying); no cuenta los aciertos → `authLimiter`.
- `PUT /auth/password`: 5 fallos/15 min por usuario autenticado → `passwordLimiter`.
- `POST /auth/refresh` y `/auth/logout`: 30/min por IP → `sesionLimiter`.
- Toda la API: 1000/min por IP (`API_RATE_LIMIT`) → `apiLimiter`.
- `GET /api/reniec/:dni`: por IP, 20/min, cuenta todo (cada llamada gasta la API key de DECOLECTA) → `reniecLimiter`.
- Los límites por IP dependen de `trust proxy` (`TRUST_PROXY`, por defecto solo redes locales/privadas): detrás del proxy TLS, sin él todos compartirían la IP del proxy.

## Fase 5 (plan de mejoras) — sesión

- **Access token** JWT HS256 de 15 min, solo en memoria del navegador (nunca en localStorage). `verify` fija el algoritmo (`alg: none` u otro secreto → 401).
- **Refresh token** de 32 bytes en cookie `imprenta_rt`: `HttpOnly`, `Secure` (producción), `SameSite=Strict`, `Path=/auth`. En la tabla `RefreshTokens` solo se guarda su SHA-256.
- **Rotación**: cada `/auth/refresh` revoca el token usado y emite otro de la misma familia. Si vuelve a llegar un token *rotado*, se revoca la familia entera y se registra `refresh_reutilizado` en la bitácora (robo de cookie). Un token revocado por logout o cambio de credenciales solo da 401.
- **Duración**: 7 días sin uso; 30 días máximo desde el login aunque se use a diario.
- **CSRF**: `/auth/refresh` y `/auth/logout` exigen un `Origin` de `ALLOWED_ORIGINS` además de `SameSite=Strict`. El resto de la API usa el header `Authorization`, que un sitio ajeno no puede enviar.
- **Revocación inmediata**: `logins.token_version` viaja en el token; `authenticate` lo compara con la BD (caché de 30 s) y verifica `activo`. Cambiar contraseña, cargo o desactivar sube la versión y revoca los refresh. El cargo de `req.user` sale de la BD, no del token.
- **Contraseñas**: bcrypt cost 12 (los hashes viejos se rehacen al iniciar sesión), mínimo 10 caracteres, máximo 72 bytes, sin el nombre de usuario ni contraseñas comunes. El login compara contra un hash ficticio si el usuario no existe (sin enumeración por tiempo) y responde el mismo 401 genérico.
- **Usuarios**: nombre único sin distinguir mayúsculas (índice `logins_usuario_unico`); no se puede quitar el último Administrador activo ni desactivarse a uno mismo. Cada usuario cambia su propia contraseña con `PUT /auth/password` (exige la actual).
- **Bitácora** `AuditLog` (migración 0005): login ok/fallido, logout, refresh reutilizado, usuarios, contraseña, emisión, notas de crédito, reenvío, bajas, edición/borrado de comprobantes, caja, emisor y series. Nunca guarda contraseñas, hashes ni tokens. Con `scripts/roles-bd.sql` el rol de la app no puede modificarla ni borrarla.
- **JWT_SECRET**: el backend no arranca en producción con menos de 32 caracteres.

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

## Fase 6 (plan de mejoras) — autorización y validación

- **Matriz central** `web/middleware/permisos.js`, montada tras `authGlobal`: cada ruta autenticada declara qué cargos la usan. **Denegar por defecto**: una ruta sin regla responde 403. `tests/integracion/permisos.prueba.js` recorre el router de Express y falla si una ruta no tiene regla (o una regla no tiene ruta), y verifica que todas las rutas solo-admin den 403 a un Usuario.
- **Formatos en el servidor**: las escrituras de un Usuario exigen el formato de la pantalla (ticket, boleta, factura, notacredito, guiarem, guiatransp, ingresos, cotizacion). Antes solo ocultaban menús. Asignar formatos es solo de admin (antes cualquiera podía asignárselos).
- **Credenciales SUNAT cifradas** (migración 0006): clave SOL y client_secret salen de `Emisor` a `EmisorCredenciales`, cifradas con AES-256-GCM (`DATA_ENCRYPTION_KEY`, con AAD por emisor y campo). Ningún modelo asocia esa tabla y la API nunca devuelve los secretos (`tiene_clave_sol` / `tiene_client_secret`). Antes `GET /emisor` se los entregaba a cualquier usuario. Solo `sunatClient`/`sunatRestClient` los descifran, en el momento de autenticarse. El log de depuración SOAP enmascara la contraseña.
- **Subidas** (`subidaImagen.js`): en memoria, tipo por magic bytes (JPG/PNG/WEBP), nombre aleatorio; el nombre original nunca toca el disco.
- **Mass assignment**: `soloCampos(Model)` en los CRUD de catálogos (sin id, timestamps ni el correlativo de la serie) y en servicios; zod en clientes, emisor, guías y formatos. Se eliminaron las escrituras crudas de `envio_resumen`, `envio_resumen_detalle` y `cuota`.
- **Guías**: `POST /guia/emision` guarda cabecera e ítems en una transacción (antes 3 peticiones sueltas).
- `AUTH_ENFORCE=false` se ignora en producción. API y worker no arrancan en producción sin `DATA_ENCRYPTION_KEY`.
