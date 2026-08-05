const rateLimit = require("express-rate-limit");

/**
 * Límite de intentos para el login.
 *
 * Al centralizar la API detrás de la autenticación, /auth/login pasa a ser la
 * única puerta de entrada y por tanto el blanco más valioso para fuerza bruta.
 *
 * CLAVE POR USUARIO, NO POR IP (decisión deliberada):
 * Este es un POS donde varios operarios comparten la misma IP pública (NAT), y
 * en producción el backend está detrás de un proxy TLS, así que req.ip puede
 * ser la del proxy y no la real. Limitar por IP haría que un operario que
 * olvida su contraseña bloquee a toda la imprenta.
 * Contando por nombre de usuario, el límite recae sobre la cuenta atacada —que
 * es justo lo que protege de la fuerza bruta— sin daño colateral entre compañeros.
 *
 * skipSuccessfulRequests: los logins correctos no consumen cuota, así que el
 * uso normal nunca llega al límite.
 *
 * Store en memoria a propósito: hay una sola instancia de backend, así que basta
 * y evita acoplar el login a la disponibilidad de Redis.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const usuario = req.body?.usuario;
    // Sin usuario en el body no hay nada que autenticar: se agrupa aparte
    // para que esas peticiones malformadas no consuman la cuota de nadie.
    return usuario ? `user:${String(usuario).trim().toLowerCase()}` : "sin-usuario";
  },
  message: { message: "Demasiados intentos fallidos. Espera 15 minutos." },
});

/**
 * Límite para la consulta a RENIEC.
 *
 * El endpoint ya exige token (Fase 1), pero cada consulta gasta la API key de
 * DECOLECTA de la empresa. Este límite acota el abuso si una cuenta se ve
 * comprometida o un script itera DNIs. Por IP con ventana corta; los aciertos
 * también cuentan (a diferencia del login) porque el coste está en cada llamada.
 */
const reniecLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas consultas RENIEC. Espera un momento." },
});

module.exports = { authLimiter, reniecLimiter };
