/**
 * Orígenes de navegador permitidos (ALLOWED_ORIGINS, separados por coma).
 * Los usa CORS y la verificación de Origin de /auth/refresh y /auth/logout.
 *
 * Ejemplo .env:
 * ALLOWED_ORIGINS=http://localhost:5173,https://impalexander.store,https://www.impalexander.store
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) || ["http://localhost:5173"];

const origenPermitido = (origin) => Boolean(origin) && allowedOrigins.includes(origin);

module.exports = { allowedOrigins, origenPermitido };
