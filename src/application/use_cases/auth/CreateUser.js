const bcrypt = require("bcryptjs");

class CreateUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute({ usuario, password, cargo }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return await this.userRepository.save({
      usuario,
      password: hashedPassword,
      cargo,
      activo: true
    });
  }
}

module.exports = CreateUser;
