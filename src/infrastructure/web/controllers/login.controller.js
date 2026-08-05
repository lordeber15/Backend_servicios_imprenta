const SequelizeUserRepository = require("../../database/repositories/SequelizeUserRepository");
const LoginUserUseCase = require("../../../application/use_cases/auth/LoginUser");
const CreateUserUseCase = require("../../../application/use_cases/auth/CreateUser");
const DeleteUserUseCase = require("../../../application/use_cases/auth/DeleteUser");
const UpdateUserUseCase = require("../../../application/use_cases/auth/UpdateUser");
const { Login } = require("../../database/models/login");
const { NotFoundError } = require("../../utils/errors");
const path = require("path");

const userRepository = new SequelizeUserRepository();

/**
 * Obtener todos los usuarios
 */
const getLogin = async (_req, res, next) => {
  try {
    const usersWithFormatos = await Login.findAll({
      where: { activo: true },
      include: [{ association: "formatos", attributes: ["key"] }],
      attributes: ["id", "usuario", "cargo", "image_url"],
    });
    const sanitizedUsers = usersWithFormatos.map(u => ({
      id: u.id,
      usuario: u.usuario,
      cargo: u.cargo,
      image_url: u.image_url,
      formatos: (u.formatos || []).map(f => f.key),
    }));
    res.json(sanitizedUsers);
  } catch (error) {
    return next(error);
  }
};

/**
 * Autenticar usuario (Login)
 */
const authLogin = async (req, res, next) => {
  try {
    const useCase = new LoginUserUseCase(userRepository);
    const result = await useCase.execute(req.body);
    res.json(result);
  } catch (error) {
    // Mensajes controlados del caso de uso: seguros de mostrar al cliente.
    // Cualquier otro error (BD, bcrypt) se delega al handler global (500 genérico).
    const msg = error.message || "";
    if (msg.includes("incorrectos")) return res.status(401).json({ message: msg });
    if (msg.includes("desactivada")) return res.status(403).json({ message: msg });
    if (msg.includes("requeridos"))  return res.status(400).json({ message: msg });
    return next(error);
  }
};

/**
 * Crear nuevo usuario
 */
const createLogin = async (req, res, next) => {
  try {
    const useCase = new CreateUserUseCase(userRepository);
    const newUser = await useCase.execute(req.body);
    res.json({ id: newUser.id, usuario: newUser.usuario, cargo: newUser.cargo });
  } catch (error) {
    return next(error);
  }
};

/**
 * Eliminar usuario
 */
const deleteLogin = async (req, res, next) => {
  try {
    const useCase = new DeleteUserUseCase(userRepository);
    const result = await useCase.execute(req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message.includes("encontrado")) return next(new NotFoundError(error.message));
    return next(error);
  }
};

/**
 * Actualizar usuario
 */
const updateLogin = async (req, res, next) => {
  try {
    const useCase = new UpdateUserUseCase(userRepository);
    const updatedUser = await useCase.execute(req.params.id, req.body);
    res.json({
      id: updatedUser.id,
      usuario: updatedUser.usuario,
      cargo: updatedUser.cargo,
      activo: updatedUser.activo
    });
  } catch (error) {
    if (error.message.includes("encontrado")) return next(new NotFoundError(error.message));
    return next(error);
  }
};

/**
 * Subir foto de perfil
 */
const uploadImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userRepository.findById(id);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No se ha subido ninguna imagen" });
    }

    user.image_url = `/uploads/${req.file.filename}`;
    await userRepository.save(user);

    res.json({
      message: "Imagen actualizada",
      image_url: user.image_url
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getLogin, authLogin, createLogin, deleteLogin, updateLogin, uploadImage };
