const Cuota = require("../../../database/models/facturacion/cuota");

const getCuota = async (req, res, next) => {
  try {
    const cuotas = await Cuota.findAll();
    res.json(cuotas);
  } catch (error) {
    return next(error);
  }
};

const createCuota = async (req, res, next) => {
  try {
    const cuotaData = req.body;
    const newCuota = await Cuota.create({
      ...cuotaData,
    });
    res.json(newCuota);
  } catch (error) {
    return next(error);
  }
};

const deleteCuota = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cuota = await Cuota.findByPk(id);

    if (!cuota) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await cuota.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateCuota = async (req, res, next) => {
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
    return next(error);
  }
};

module.exports = {
  getCuota,
  createCuota,
  deleteCuota,
  updateCuota,
};
