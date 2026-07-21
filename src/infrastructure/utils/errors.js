/**
 * CLASES DE ERROR DE LA APLICACIÓN
 *
 * Permiten que los middlewares y controllers lancen errores con un código HTTP
 * asociado y delegen la respuesta en el manejador global de errores de app.js,
 * en lugar de construir la respuesta en cada sitio.
 *
 * Uso:
 *   const { UnauthorizedError } = require("../../utils/errors");
 *   return next(new UnauthorizedError());
 */

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — La petición trae datos inválidos. */
class ValidationError extends AppError {
  constructor(message = "Datos inválidos") {
    super(message, 400);
  }
}

/** 401 — Falta el token o no es válido. */
class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401);
  }
}

/** 403 — Autenticado, pero sin permisos para esta operación. */
class ForbiddenError extends AppError {
  constructor(message = "No tienes permisos para esta operación") {
    super(message, 403);
  }
}

/** 404 — El recurso no existe. */
class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
};
