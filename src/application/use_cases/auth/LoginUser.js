const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Login } = require("../../../infrastructure/database/models/login");

class LoginUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute({ usuario, password }) {
    if (!usuario || !password) {
      throw new Error("Usuario y contraseña son requeridos");
    }

    const user = await this.userRepository.findByUsuario(usuario);
    if (!user) {
      throw new Error("Usuario o contraseña incorrectos");
    }

    if (!user.activo) {
      throw new Error("Tu cuenta ha sido desactivada. Contacta al administrador.");
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      throw new Error("Usuario o contraseña incorrectos");
    }

    // Obtener formatos asignados al usuario
    const userWithFormatos = await Login.findByPk(user.id, {
      include: [{ association: "formatos", attributes: ["key"] }],
    });
    const formatos = (userWithFormatos?.formatos || []).map((f) => f.key);

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, cargo: user.cargo, image_url: user.image_url, formatos },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return {
      token,
      id: user.id,
      usuario: user.usuario,
      cargo: user.cargo,
      image_url: user.image_url,
      formatos
    };
  }
}

module.exports = LoginUser;
