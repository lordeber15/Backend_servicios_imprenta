const Cuota = require("../../../database/models/facturacion/cuota");

const getCuota = async (req, res) => {
  try {
    const cuotas = await Cuota.findAll();
    res.json(cuotas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createCuota = async (req, res) => {
  try {
    const cuotaData = req.body;
    const newCuota = await Cuota.create({
      ...cuotaData,
    });
    res.json(newCuota);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteCuota = async (req, res) => {
  try {
    const { id } = req.params;
    const cuota = await Cuota.findByPk(id);

    if (!cuota) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await cuota.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateCuota = async (req, res) => {
  try {
    const { id } = req.params;
    const cuotaData = req.body;

    const cuotaToUpdate = await Cuota.findByPk(id);

    if (!cuotaToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await cuotaToUpdate.update({
      ...cuotaData,
    });

    res.json(cuotaToUpdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCuota,
  createCuota,
  deleteCuota,
  updateCuota,
};
