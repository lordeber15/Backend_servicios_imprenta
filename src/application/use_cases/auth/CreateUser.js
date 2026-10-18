const { hashear } = require("../../services/password.service");

class CreateUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /** @param {object} datos ya validados con crearUsuarioSchema */
  async execute({ usuario, password, cargo }) {
    return await this.userRepository.save({
      usuario,
      password: await hashear(password),
      cargo,
      activo: true
    });
  }
}

module.exports = CreateUser;
