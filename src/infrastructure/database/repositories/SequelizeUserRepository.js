const { Login } = require("../models/login");
const IUserRepository = require("../../../domain/interfaces/IUserRepository");
const User = require("../../../domain/entities/User");

class SequelizeUserRepository extends IUserRepository {
  async findByUsuario(usuario) {
    const user = await Login.findOne({ where: { usuario } });
    return user ? this._toEntity(user) : null;
  }

  async findById(id) {
    const user = await Login.findByPk(id);
    return user ? this._toEntity(user) : null;
  }

  async save(userEntity) {
    const user = await Login.findByPk(userEntity.id);
    if (user) {
      await user.update({
        usuario: userEntity.usuario,
        password: userEntity.password,
        cargo: userEntity.cargo,
        image_url: userEntity.image_url,
        activo: userEntity.activo
      });
      return this._toEntity(user);
    }
    const newUser = await Login.create(userEntity);
    return this._toEntity(newUser);
  }

  async findAll() {
    const users = await Login.findAll({ where: { activo: true } });
    return users.map(user => this._toEntity(user));
  }

  _toEntity(model) {
    return new User({
      id: model.id,
      usuario: model.usuario,
      password: model.password,
      cargo: model.cargo,
      image_url: model.image_url,
      activo: model.activo
    });
  }
}

module.exports = SequelizeUserRepository;
