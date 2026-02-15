class User {
  constructor({ id, usuario, password, cargo, image_url, activo }) {
    this.id = id;
    this.usuario = usuario;
    this.password = password;
    this.cargo = cargo;
    this.image_url = image_url;
    this.activo = activo;
  }

  isPasswordValid(plainPassword) {
    // This logic might be moved to a service if it depends on bcrypt
    // But conceptually, the entity can define how to validate
  }
}

module.exports = User;
