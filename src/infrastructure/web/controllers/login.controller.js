const SequelizeUserRepository = require("../../database/repositories/SequelizeUserRepository");
const LoginUserUseCase = require("../../../application/use_cases/auth/LoginUser");
const GetAllUsersUseCase = require("../../../application/use_cases/auth/GetAllUsers");
const CreateUserUseCase = require("../../../application/use_cases/auth/CreateUser");
const DeleteUserUseCase = require("../../../application/use_cases/auth/DeleteUser");
const UpdateUserUseCase = require("../../../application/use_cases/auth/UpdateUser");
const path = require("path");

const userRepository = new SequelizeUserRepository();

/**
 * Obtener todos los usuarios
 */
const getLogin = async (_req, res) => {
  try {
    const useCase = new GetAllUsersUseCase(userRepository);
    const users = await useCase.execute();
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      usuario: u.usuario,
      cargo: u.cargo,
      image_url: u.image_url
    }));
    res.json(sanitizedUsers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Autenticar usuario (Login)
 */
const authLogin = async (req, res) => {
  try {
    const useCase = new LoginUserUseCase(userRepository);
    const result = await useCase.execute(req.body);
    res.json(result);
  } catch (error) {
    const status = error.message.includes("incorrectos") ? 401 : 400;
    return res.status(status).json({ message: error.message });
  }
};

/**
 * Crear nuevo usuario
 */
const createLogin = async (req, res) => {
  try {
    const useCase = new CreateUserUseCase(userRepository);
    const newUser = await useCase.execute(req.body);
    res.json({ id: newUser.id, usuario: newUser.usuario, cargo: newUser.cargo });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Eliminar usuario
 */
const deleteLogin = async (req, res) => {
  try {
    const useCase = new DeleteUserUseCase(userRepository);
    const result = await useCase.execute(req.params.id);
    res.json(result);
  } catch (error) {
    const status = error.message.includes("encontrado") ? 404 : 500;
    return res.status(status).json({ message: error.message });
  }
};

/**
 * Actualizar usuario
 */
const updateLogin = async (req, res) => {
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
    const status = error.message.includes("encontrado") ? 404 : 400;
    return res.status(status).json({ message: error.message });
  }
};

/**
 * Subir foto de perfil
 */
const uploadImage = async (req, res) => {
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
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLogin, authLogin, createLogin, deleteLogin, updateLogin, uploadImage };
