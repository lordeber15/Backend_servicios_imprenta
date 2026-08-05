const Emisor = require("../../../database/models/facturacion/emisor");

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

    await emisorToUpdate.update({
      ...emisorData,
    });

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
