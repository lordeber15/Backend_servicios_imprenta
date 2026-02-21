const bcrypt = require("bcryptjs");

class UpdateUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(id, { usuario, password, confirmPassword, cargo, activo }) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    if (usuario) user.usuario = usuario;
    if (password) {
      if (password !== confirmPassword) {
        throw new Error("Las contraseñas no coinciden");
      }
      user.password = await bcrypt.hash(password, 10);
    }
    if (cargo) user.cargo = cargo;
    if (activo !== undefined) user.activo = activo;

    await this.userRepository.save(user);
    return user;
  }
}

module.exports = UpdateUser;
