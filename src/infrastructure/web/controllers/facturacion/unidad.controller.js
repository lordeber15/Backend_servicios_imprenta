const Unidad = require("../../../database/models/facturacion/unidad");

/**
 * Obtener todas las unidades de medida
 * @route GET /api/unidad
 */
const getUnidad = async (req, res, next) => {
  try {
    const unidads = await Unidad.findAll();
    res.json(unidads);
  } catch (error) {
    return next(error);
  }
};

/**
 * Crear una nueva unidad de medida
 * @route POST /api/unidad
 */
const createUnidad = async (req, res, next) => {
  try {
    const unidadData = req.body;
    const newUnidad = await Unidad.create({
      ...unidadData,
    });
    res.json(newUnidad);
  } catch (error) {
    return next(error);
  }
};

const deleteUnidad = async (req, res, next) => {
  try {
    const { id } = req.params;
    const unidad = await Unidad.findByPk(id);

    if (!unidad) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await unidad.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateUnidad = async (req, res, next) => {
  try {
    const { id } = req.params;
    const unidadData = req.body;

    const unidadToUpdate = await Unidad.findByPk(id);

    if (!unidadToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await unidadToUpdate.update({
      ...unidadData,
    });

    res.json(unidadToUpdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getUnidad,
  createUnidad,
  deleteUnidad,
  updateUnidad,
};
