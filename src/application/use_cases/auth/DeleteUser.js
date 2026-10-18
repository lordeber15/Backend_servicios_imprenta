const sequelize = require("../../../infrastructure/database/database");
const { Login } = require("../../../infrastructure/database/models/login");
const { revocarSesionesUsuario } = require("../../services/sesion.service");
const { exigirOtroAdmin } = require("./UpdateUser");
const { NotFoundError } = require("../../../infrastructure/utils/errors");

class DeleteUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /** Baja lógica: desactiva al usuario y cierra todas sus sesiones. */
  async execute(id) {
    return sequelize.transaction(async (transaction) => {
      const user = await Login.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user) throw new NotFoundError("Usuario no encontrado");
      if (user.cargo === "Administrador" && user.activo) await exigirOtroAdmin(user, transaction);
      await user.update({ activo: false }, { transaction });
      await revocarSesionesUsuario(user.id, "usuario_desactivado", transaction);
      return { message: "Usuario desactivado correctamente (Baja lógica)", user };
    });
  }
}

module.exports = DeleteUser;
