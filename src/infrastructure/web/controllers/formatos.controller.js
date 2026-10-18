const { Formato } = require("../../database/models/formatos");
const { UsuarioFormato } = require("../../database/models/usuario_formatos");
const { Login } = require("../../database/models/login");
const sequelize = require("../../database/database");
const { olvidarUsuario } = require("../middleware/auth.middleware");
const { registrar } = require("../../../application/services/auditoria.service");
const { ValidationError, NotFoundError } = require("../../utils/errors");

// Listar todos los formatos del catálogo
const getFormatos = async (_req, res, next) => {
  try {
    const formatos = await Formato.findAll({ order: [["id", "ASC"]] });
    res.json(formatos);
  } catch (error) {
    next(error);
  }
};

// Obtener formatos asignados a un usuario (retorna array de keys)
const getUsuarioFormatos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await Login.findByPk(id, {
      include: [{ association: "formatos", attributes: ["id", "key", "nombre"] }],
    });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    const formatoKeys = user.formatos.map((f) => f.key);
    res.json(formatoKeys);
  } catch (error) {
    next(error);
  }
};

// Actualizar formatos de un usuario (recibe array de keys, reemplaza existentes). Solo admin.
const updateUsuarioFormatos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { formatos } = req.body || {};
    if (!Array.isArray(formatos) || formatos.some((f) => typeof f !== "string") || formatos.length > 50) {
      throw new ValidationError("formatos debe ser una lista de claves");
    }

    const resultado = await sequelize.transaction(async (transaction) => {
      const user = await Login.findByPk(id, {
        transaction,
        include: [{ association: "formatos", attributes: ["key"] }],
      });
      if (!user) throw new NotFoundError("Usuario no encontrado");
      const antes = user.formatos.map((f) => f.key);

      const formatoRecords = await Formato.findAll({ where: { key: formatos }, transaction });
      const desconocidos = formatos.filter((k) => !formatoRecords.some((f) => f.key === k));
      if (desconocidos.length) throw new ValidationError(`Formatos desconocidos: ${desconocidos.join(", ")}`);

      await UsuarioFormato.destroy({ where: { usuario_id: id }, transaction });
      if (formatoRecords.length > 0) {
        await UsuarioFormato.bulkCreate(
          formatoRecords.map((f) => ({ usuario_id: id, formato_id: f.id })),
          { transaction }
        );
      }
      transaction.afterCommit(() => olvidarUsuario(id)); // el permiso cambia ya, no en 30 s
      return { antes, despues: formatoRecords.map((f) => f.key) };
    });

    registrar(req, "usuario_formatos", { entidad: "logins", entidad_id: id, antes: { formatos: resultado.antes }, despues: { formatos: resultado.despues } });
    res.json({ message: "Formatos actualizados", formatos: resultado.despues });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFormatos, getUsuarioFormatos, updateUsuarioFormatos };
