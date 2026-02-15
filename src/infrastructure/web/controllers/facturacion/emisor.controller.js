const Emisor = require("../../../database/models/facturacion/emisor");

const getEmisor = async (req, res) => {
  try {
    const emisors = await Emisor.findAll();
    res.json(emisors);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createEmisor = async (req, res) => {
  try {
    const emisorData = req.body;
    const newEmisor = await Emisor.create({
      ...emisorData,
    });
    res.json(newEmisor);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteEmisor = async (req, res) => {
  try {
    const { id } = req.params;
    const emisor = await Emisor.findByPk(id);

    if (!emisor) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await emisor.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateEmisor = async (req, res) => {
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
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEmisor,
  createEmisor,
  deleteEmisor,
  updateEmisor,
};
