const { rateLimit } = require("express-rate-limit");

/**
 * LÍMITES DE PETICIONES
 *
 * Store en memoria a propósito: hay una sola instancia de backend, así que basta
 * y evita acoplar el login a la disponibilidad de Redis.
 *
 * Las claves por IP usan el keyGenerator por defecto, que agrupa IPv6 por
 * subred /56 (un atacante no puede rotar direcciones dentro de su bloque).
 * Requiere `trust proxy` bien configurado en app.js para ver la IP real.
 */

/**
 * Login por USUARIO: protege la cuenta atacada (fuerza bruta contra una cuenta).
 * skipSuccessfulRequests: los logins correctos no consumen cuota.
 */
const loginPorUsuario = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
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
 * Login por IP: frena el "password spraying" (una contraseña común probada
 * contra muchas cuentas, que el límite por usuario no ve). Holgado porque
 * varios operarios comparten la IP pública de la imprenta.
 */
const loginPorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiados intentos fallidos desde esta red. Espera 15 minutos." },
});

/**
 * Cambio de la contraseña propia: limita adivinar la contraseña ACTUAL con
 * una sesión robada. Clave por usuario autenticado (va después de authenticate).
 */
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `pw:${req.user?.id}`,
  message: { message: "Demasiados intentos. Espera 15 minutos." },
});

/** Refresh/logout: el uso normal es ~4 por hora por pestaña. */
const sesionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes de sesión. Espera un momento." },
});

/** Límite general de la API por IP (contra scraping o un script desbocado). */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 1000),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/health"),
  message: { message: "Demasiadas solicitudes. Espera un momento." },
});

/**
 * Límite para la consulta a RENIEC.
 *
 * Cada consulta gasta la API key de DECOLECTA de la empresa. Este límite acota
 * el abuso si una cuenta se ve comprometida o un script itera DNIs. Por IP con
 * ventana corta; los aciertos también cuentan porque el coste está en cada llamada.
 */
const reniecLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas consultas RENIEC. Espera un momento." },
});

// authLimiter se mantiene como alias de ambos límites de login.
const authLimiter = [loginPorIp, loginPorUsuario];

module.exports = { authLimiter, loginPorIp, loginPorUsuario, passwordLimiter, sesionLimiter, apiLimiter, reniecLimiter };
