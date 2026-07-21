const { UnauthorizedError, ForbiddenError } = require("../../utils/errors");

/**
 * Restringe una ruta a los cargos indicados. Requiere que authenticate
 * se haya ejecutado antes (necesita req.user.cargo, que viaja en el JWT).
 *
 * Uso:
 *   router.post("/login", authorize("Administrador"), createLogin);
 *
 * @param {...string} rolesPermitidos  Cargos con acceso ("Administrador", "Usuario")
 */
const authorize = (...rolesPermitidos) => (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!rolesPermitidos.includes(req.user.cargo)) return next(new ForbiddenError());
  return next();
};

/**
 * Permite la operación si el usuario actúa sobre su propio registro
 * o si es Administrador. Para casos como cambiar la foto de perfil,
 * donde un usuario normal debe poder modificar la suya pero no la de otro.
 *
 * @param {string} paramId  Nombre del parámetro de ruta con el id del dueño
 */
const authorizeSelfOrAdmin = (paramId = "id") => (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  const esPropio = Number(req.user.id) === Number(req.params[paramId]);
  if (esPropio || req.user.cargo === "Administrador") return next();
  return next(new ForbiddenError());
};

module.exports = authorize;
module.exports.authorize = authorize;
module.exports.authorizeSelfOrAdmin = authorizeSelfOrAdmin;
