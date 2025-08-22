const Detalle = require("../../models/facturacion/detalles");

const getDetalle = async (req, res) => {
  try {
    const detalles = await Detalle.findAll();
    res.json(detalles);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createDetalle = async (req, res) => {
  try {
    const detalleData = req.body;
    const newDetalle = await Detalle.create({
      ...detalleData,
    });
    res.json(newDetalle);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const detalle = await Detalle.findByPk(id);

    if (!detalle) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await detalle.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const detalleData = req.body;

    const detalleToUpdate = await Detalle.findByPk(id);

    if (!detalleToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await detalleToUpdate.update({
      ...detalleData,
    });

    res.json(detalleToUpdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDetalle,
  createDetalle,
  deleteDetalle,
  updateDetalle,
};
