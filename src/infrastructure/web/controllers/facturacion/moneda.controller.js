const Moneda = require("../../../database/models/facturacion/moneda");
const Tipo_afectacion = require("../../../database/models/facturacion/tipoafectacion");

/**
 * Obtener listado de monedas (PEN, USD)
 * @route GET /api/moneda
 */
const getMoneda = async (req, res, next) => {
  try {
    const monedas = await Moneda.findAll();
    res.json(monedas);
  } catch (error) {
    return next(error);
  }
};

/**
 * Obtener listado de tipos de afectación del IGV (Catálogo 07 SUNAT)
 * @route GET /api/tipo_afectacion
 */
const getTipo_afectacion = async (req, res, next) => {
  try {
    const tipo_afectacions = await Tipo_afectacion.findAll();
    res.json(tipo_afectacions);
  } catch (error) {
    return next(error);
  }
};

/**
 * Crear un nuevo tipo de afectación
 * @route POST /api/tipo_afectacion
 */
const createTipo_afectacion = async (req, res, next) => {
  try {
    const tipoAfectacionData = req.body;
    const newTipoAfectacion = await Tipo_afectacion.create({
      ...tipoAfectacionData,
    });
    res.json(newTipoAfectacion);
  } catch (error) {
    return next(error);
  }
};

/**
 * Registrar una nueva moneda
 * @route POST /api/moneda
 */
const createMoneda = async (req, res, next) => {
  try {
    const monedaData = req.body;
    const newMoneda = await Moneda.create({
      ...monedaData,
    });
    res.json(newMoneda);
  } catch (error) {
    return next(error);
  }
};

const deleteMoneda = async (req, res, next) => {
  try {
    const { id } = req.params;
    const moneda = await Moneda.findByPk(id);

    if (!moneda) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await moneda.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateMoneda = async (req, res, next) => {
  try {
    const { id } = req.params;
    const monedaData = req.body;

    const monedaToUpdate = await Moneda.findByPk(id);

    if (!monedaToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await monedaToUpdate.update({
      ...monedaData,
    });

    res.json(monedaToUpdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMoneda,
  createMoneda,
  deleteMoneda,
  updateMoneda,
};
