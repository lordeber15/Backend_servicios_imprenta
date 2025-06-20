const { Comprobante } = require("../../models/facturacion/comprobante");

const getComprobante = async (req, res) => {
  try {
    const comprobantes = await Comprobante.findAll();
    res.json(comprobantes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

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
