const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../../utils/errors");

/**
 * Verifica el JWT del header Authorization y expone el payload en req.user.
 * Delega la respuesta de error en el manejador global de app.js.
 */
const authenticate = (req, _res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return next(new UnauthorizedError());
  }
  try {
    req.user = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    return next();
  } catch {
    return next(new UnauthorizedError("Token inválido o expirado"));
  }
};

module.exports = authenticate;
