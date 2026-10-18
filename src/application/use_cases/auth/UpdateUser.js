const sequelize = require("../../../infrastructure/database/database");
const { Login } = require("../../../infrastructure/database/models/login");
const { hashear } = require("../../services/password.service");
const { revocarSesionesUsuario } = require("../../services/sesion.service");
const { NotFoundError, ConflictError } = require("../../../infrastructure/utils/errors");

/**
 * Impide quedarse sin administradores: desactivar o degradar al último
 * Administrador activo dejaría el sistema sin nadie que pueda abrir la caja
 * ni gestionar usuarios. (Bloqueo FOR UPDATE: dos degradaciones simultáneas
 * no pueden pasar el chequeo a la vez.)
 */
async function exigirOtroAdmin(user, transaction) {
  const admins = await Login.findAll({
    where: { cargo: "Administrador", activo: true },
    attributes: ["id"],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!admins.some((a) => a.id !== user.id)) {
    throw new ConflictError("No se puede quitar el último Administrador activo");
  }
}

class UpdateUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * @param {number} id
   * @param {object} datos ya validados con actualizarUsuarioSchema
   * @returns {Promise<{user: Login, antes: object, sesionesRevocadas: boolean}>}
   */
  async execute(id, { usuario, password, cargo, activo }) {
    return sequelize.transaction(async (transaction) => {
      const user = await Login.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user) throw new NotFoundError("Usuario no encontrado");
      const antes = { usuario: user.usuario, cargo: user.cargo, activo: user.activo };

      const pierdeAdmin = user.cargo === "Administrador" && user.activo &&
        ((cargo && cargo !== "Administrador") || activo === false);
      if (pierdeAdmin) await exigirOtroAdmin(user, transaction);

      const cambios = {};
      if (usuario && usuario !== user.usuario) cambios.usuario = usuario;
      if (password) cambios.password = await hashear(password);
      if (cargo && cargo !== user.cargo) cambios.cargo = cargo;
      if (activo !== undefined && activo !== user.activo) cambios.activo = activo;
      await user.update(cambios, { transaction });

      // Contraseña, cargo o estado nuevos: las sesiones abiertas se cierran.
      const sesionesRevocadas = Boolean(cambios.password || cambios.cargo || cambios.activo !== undefined);
      if (sesionesRevocadas) await revocarSesionesUsuario(user.id, "credenciales_cambiadas", transaction);

      return { user, antes, sesionesRevocadas };
    });
  }
}

module.exports = UpdateUser;
module.exports.exigirOtroAdmin = exigirOtroAdmin;
