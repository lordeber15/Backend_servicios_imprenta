const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

    // Hash comparison
    let passwordValid = await bcrypt.compare(password, user.password);

    // Legacy migration (as seen in the original controller)
    if (!passwordValid && password === user.password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
      await this.userRepository.save(user);
      passwordValid = true;
    }

    if (!passwordValid) {
      throw new Error("Usuario o contraseña incorrectos");
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, cargo: user.cargo, image_url: user.image_url },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return {
      token,
      id: user.id,
      usuario: user.usuario,
      cargo: user.cargo,
      image_url: user.image_url
    };
  }
}

module.exports = LoginUser;
