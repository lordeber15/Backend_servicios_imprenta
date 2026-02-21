const Comprobante = require("../../../database/models/facturacion/comprobante");
const Moneda = require("../../../database/models/facturacion/moneda"); // Assuming Moneda model is needed for new functions

/**
 * Obtener listado de comprobantes
 * @route GET /api/comprobante
 */
const getComprobante = async (req, res) => {
  try {
    const comprobantes = await Comprobante.findAll();
    res.json(comprobantes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Obtener listado de series configuradas (Ej: F001, B001)
 * @route GET /api/serie
 */
const getSerie = async (req, res) => {
  try {
    const series = await Serie.findAll();
    res.json(series);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Crear una nueva serie de facturación
 * @route POST /api/serie
 */
const createSerie = async (req, res) => {
  try {
    const serieData = req.body;
    const newSerie = await Serie.create({
      ...serieData,
    });
    res.json(newSerie);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Registrar un nuevo comprobante (Solo cabecera)
 * @route POST /api/comprobante
 */
const createComprobante = async (req, res) => {
  try {
    const comprobanteData = req.body;
    const newComprobante = await Comprobante.create({
      ...comprobanteData,
    });
    res.json(newComprobante);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteComprobante = async (req, res) => {
  try {
    const { id } = req.params;
    const comprobante = await Comprobante.findByPk(id);

    if (!comprobante) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await comprobante.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateComprobante = async (req, res) => {
  try {
    const { id } = req.params;
    const comprobanteData = req.body;

    const comprobanteToUpdate = await Comprobante.findByPk(id);

    if (!comprobanteToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await comprobanteToUpdate.update({
      ...comprobanteData,
    });

    res.json(comprobanteToUpdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getComprobante,
  createComprobante,
  deleteComprobante,
  updateComprobante,
};
