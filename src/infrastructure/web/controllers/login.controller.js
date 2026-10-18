const SequelizeUserRepository = require("../../database/repositories/SequelizeUserRepository");
const CreateUserUseCase = require("../../../application/use_cases/auth/CreateUser");
const DeleteUserUseCase = require("../../../application/use_cases/auth/DeleteUser");
const UpdateUserUseCase = require("../../../application/use_cases/auth/UpdateUser");
const { Login } = require("../../database/models/login");
const { ValidationError, ConflictError } = require("../../utils/errors");
const { crearUsuarioSchema, actualizarUsuarioSchema } = require("../../../application/validation/usuario.schema");
const { mensajeError } = require("../../../application/validation/emision.schema");
const { registrar } = require("../../../application/services/auditoria.service");
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
 * Crear nuevo usuario
 */
const createLogin = async (req, res, next) => {
  try {
    const parsed = crearUsuarioSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(mensajeError(parsed.error));
    const useCase = new CreateUserUseCase(userRepository);
    const newUser = await useCase.execute(parsed.data);
    const datos = { id: newUser.id, usuario: newUser.usuario, cargo: newUser.cargo };
    registrar(req, "usuario_creado", { entidad: "logins", entidad_id: newUser.id, despues: datos });
    res.json(datos);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") return next(new ConflictError("Ya existe un usuario con ese nombre"));
    return next(error);
  }
};

/**
 * Eliminar usuario (baja lógica: desactiva y cierra sus sesiones)
 */
const deleteLogin = async (req, res, next) => {
  try {
    if (Number(req.params.id) === Number(req.user.id)) {
      throw new ConflictError("No puede desactivar su propio usuario");
    }
    const useCase = new DeleteUserUseCase(userRepository);
    const { message, user } = await useCase.execute(req.params.id);
    registrar(req, "usuario_desactivado", { entidad: "logins", entidad_id: user.id, antes: { activo: true }, despues: { activo: false } });
    res.json({ message });
  } catch (error) {
    return next(error);
  }
};

/**
 * Actualizar usuario
 */
const updateLogin = async (req, res, next) => {
  try {
    const parsed = actualizarUsuarioSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(mensajeError(parsed.error));
    const useCase = new UpdateUserUseCase(userRepository);
    const { user, antes, sesionesRevocadas } = await useCase.execute(req.params.id, parsed.data);
    const despues = { usuario: user.usuario, cargo: user.cargo, activo: user.activo };
    registrar(req, "usuario_actualizado", {
      entidad: "logins",
      entidad_id: user.id,
      antes,
      despues: { ...despues, password_cambiada: Boolean(parsed.data.password), sesiones_revocadas: sesionesRevocadas },
    });
    res.json({ id: user.id, ...despues });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") return next(new ConflictError("Ya existe un usuario con ese nombre"));
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

module.exports = { getLogin, createLogin, deleteLogin, updateLogin, uploadImage };
