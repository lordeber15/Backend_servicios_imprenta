class DeleteUser {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    user.activo = false;
    await this.userRepository.save(user);
    return { message: "Usuario desactivado correctamente (Baja lógica)" };
  }
}

module.exports = DeleteUser;
