const { Login } = require("../../../infrastructure/database/models/login");
const { verificar, hashear, necesitaRehash } = require("../../services/password.service");

/** Error de login con código HTTP y el motivo real (solo para la bitácora). */
class LoginError extends Error {
  constructor(message, statusCode, motivo) {
    super(message);
    this.statusCode = statusCode;
    this.motivo = motivo;
  }
}

class LoginUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * @returns {Promise<Login>} el usuario autenticado (modelo Sequelize)
   * @throws {LoginError}
   */
  async execute({ usuario, password }) {
    // Búsqueda sin distinguir mayúsculas (el índice único es sobre lower(usuario)).
    const user = await Login.findOne({
      where: Login.sequelize.where(Login.sequelize.fn("lower", Login.sequelize.col("usuario")), usuario.trim().toLowerCase()),
    });

    // Se verifica siempre (con un hash ficticio si no existe) para no revelar por tiempo qué usuarios existen.
    const passwordValid = await verificar(password, user?.password);
    if (!user || !passwordValid) {
      throw new LoginError("Usuario o contraseña incorrectos", 401, user ? "password_incorrecta" : "usuario_inexistente");
    }
    // Solo se informa la desactivación a quien ya demostró conocer la contraseña.
    if (!user.activo) {
      throw new LoginError("Tu cuenta ha sido desactivada. Contacta al administrador.", 403, "cuenta_desactivada");
    }

    if (necesitaRehash(user.password)) {
      await user.update({ password: await hashear(password) });
    }
    return user;
  }
}

module.exports = LoginUser;
module.exports.LoginError = LoginError;
