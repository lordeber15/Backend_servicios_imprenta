const { Formato } = require("../../database/models/formatos");
const { UsuarioFormato } = require("../../database/models/usuario_formatos");
const { Login } = require("../../database/models/login");

// Listar todos los formatos del catálogo
const getFormatos = async (_req, res) => {
  try {
    const formatos = await Formato.findAll({ order: [["id", "ASC"]] });
    res.json(formatos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener formatos asignados a un usuario (retorna array de keys)
const getUsuarioFormatos = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Login.findByPk(id, {
      include: [{ association: "formatos", attributes: ["id", "key", "nombre"] }],
    });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    const formatoKeys = user.formatos.map((f) => f.key);
    res.json(formatoKeys);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Actualizar formatos de un usuario (recibe array de keys, reemplaza existentes)
const updateUsuarioFormatos = async (req, res) => {
  try {
    const { id } = req.params;
    const { formatos } = req.body; // Array de keys: ["ticket", "boleta"]

    const user = await Login.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    // Buscar IDs de los formatos por sus keys
    const formatoRecords = await Formato.findAll({
      where: { key: formatos },
    });

    // Eliminar asignaciones actuales y crear las nuevas
    await UsuarioFormato.destroy({ where: { usuario_id: id } });
    if (formatoRecords.length > 0) {
      await UsuarioFormato.bulkCreate(
        formatoRecords.map((f) => ({ usuario_id: id, formato_id: f.id }))
      );
    }

    res.json({ message: "Formatos actualizados", formatos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getFormatos, getUsuarioFormatos, updateUsuarioFormatos };
