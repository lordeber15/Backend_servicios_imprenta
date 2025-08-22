const Tipo_comprobante = require("../../models/facturacion/tipocomprobante");

const getTipo_comprobante = async (req, res) => {
  try {
    const tipo_comprobantes = await Tipo_comprobante.findAll();
    res.json(tipo_comprobantes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createTipo_comprobante = async (req, res) => {
  try {
    const tipo_comprobanteData = req.body;
    const newTipo_comprobante = await Tipo_comprobante.create({
      ...tipo_comprobanteData,
    });
    res.json(newTipo_comprobante);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteTipo_comprobante = async (req, res) => {
  try {
    const { id } = req.params;
    const tipo_comprobante = await Tipo_comprobante.findByPk(id);

    if (!tipo_comprobante) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tipo_comprobante.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateTipo_comprobante = async (req, res) => {
  try {
    const { id } = req.params;
    const tipo_comprobanteData = req.body;

    const tipo_comprobanteToUpdate = await Tipo_comprobante.findByPk(id);

    if (!tipo_comprobanteToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tipo_comprobanteToUpdate.update({
      ...tipo_comprobanteData,
    });

    res.json(tipo_comprobanteToUpdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTipo_comprobante,
  createTipo_comprobante,
  deleteTipo_comprobante,
  updateTipo_comprobante,
};
