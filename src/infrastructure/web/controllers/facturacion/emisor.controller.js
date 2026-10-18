const Emisor = require("../../../database/models/facturacion/emisor");
const { registrar } = require("../../../../application/services/auditoria.service");

const getEmisor = async (req, res, next) => {
  try {
    const emisors = await Emisor.findAll();
    res.json(emisors);
  } catch (error) {
    return next(error);
  }
};

const createEmisor = async (req, res, next) => {
  try {
    const emisorData = req.body;
    const newEmisor = await Emisor.create({
      ...emisorData,
    });
    registrar(req, "emisor_creado", { entidad: "Emisor", entidad_id: newEmisor.id, despues: newEmisor });
    res.json(newEmisor);
  } catch (error) {
    return next(error);
  }
};

const deleteEmisor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const emisor = await Emisor.findByPk(id);

    if (!emisor) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await emisor.destroy();
    registrar(req, "emisor_eliminado", { entidad: "Emisor", entidad_id: emisor.id, antes: emisor });
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateEmisor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const emisorData = req.body;

    const emisorToUpdate = await Emisor.findByPk(id);

    if (!emisorToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    const antes = emisorToUpdate.toJSON();
    await emisorToUpdate.update({
      ...emisorData,
    });

    registrar(req, "emisor_actualizado", { entidad: "Emisor", entidad_id: emisorToUpdate.id, antes, despues: emisorToUpdate });
    res.json(emisorToUpdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getEmisor,
  createEmisor,
  deleteEmisor,
  updateEmisor,
};
