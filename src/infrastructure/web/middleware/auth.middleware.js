const NodeCache = require("node-cache");
const { UnauthorizedError } = require("../../utils/errors");
const { Login } = require("../../database/models/login");

/**
 * Verifica el access token del header Authorization y expone el usuario en req.user.
 * Delega la respuesta de error en el manejador global de app.js.
 *
 * Además de la firma (algoritmo fijado a HS256 en sesion.service), comprueba
 * contra la BD que el usuario siga activo y que su token_version coincida con
 * la del token: desactivar al usuario o cambiarle la contraseña/cargo corta su
 * acceso. Ese estado se cachea AUTH_CACHE_SEG (30 s): es la demora máxima con
 * la que otro proceso se entera; en este proceso se invalida al instante
 * (olvidarUsuario).
 *
 * El cargo de req.user sale de la BD, no del token.
 */
const cache = new NodeCache({ stdTTL: Number(process.env.AUTH_CACHE_SEG || 30), useClones: false });

async function estadoUsuario(id) {
  const clave = String(id);
  let estado = cache.get(clave);
  if (estado === undefined) {
    const u = await Login.findByPk(id, { attributes: ["id", "usuario", "cargo", "activo", "token_version"] });
    estado = u ? { id: u.id, usuario: u.usuario, cargo: u.cargo, activo: u.activo, tv: u.token_version } : null;
    cache.set(clave, estado);
  }
  return estado;
}

const authenticate = async (req, _res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return next(new UnauthorizedError());
  }

  // Requerido aquí y no arriba: sesion.service también requiere este módulo.
  const { verificarAccessToken } = require("../../../application/services/sesion.service");
  let payload;
  try {
    payload = verificarAccessToken(auth.slice(7));
  } catch {
    return next(new UnauthorizedError("Token inválido o expirado"));
  }

  try {
    const u = await estadoUsuario(payload.id);
    if (!u || !u.activo || u.tv !== payload.tv) {
      return next(new UnauthorizedError("La sesión ya no es válida"));
    }
    req.user = { id: u.id, usuario: u.usuario, cargo: u.cargo, jti: payload.jti };
    return next();
  } catch (err) {
    return next(err);
  }
};

/** Descarta el estado cacheado de un usuario (tras cambiarle credenciales/estado). */
authenticate.olvidarUsuario = (id) => cache.del(String(id));

module.exports = authenticate;
module.exports.olvidarUsuario = authenticate.olvidarUsuario;
