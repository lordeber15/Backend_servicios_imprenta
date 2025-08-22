const Envio_resumen_detalle = require("../../models/facturacion/envioresumendetalle");

const getEnvio_resumen_detalle = async (req, res) => {
  try {
    const envio_resumen_detalles = await Envio_resumen_detalle.findAll();
    res.json(envio_resumen_detalles);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createEnvio_resumen_detalle = async (req, res) => {
  try {
    const envio_resumen_detalleData = req.body;
    const newEnvio_resumen_detalle = await Envio_resumen_detalle.create({
      ...envio_resumen_detalleData,
    });
    res.json(newEnvio_resumen_detalle);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteEnvio_resumen_detalle = async (req, res) => {
  try {
    const { id } = req.params;
    const envio_resumen_detalle = await Envio_resumen_detalle.findByPk(id);

    if (!envio_resumen_detalle) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await envio_resumen_detalle.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateEnvio_resumen_detalle = async (req, res) => {
  try {
    const { id } = req.params;
    const envio_resumen_detalleData = req.body;

    const envio_resumen_detalleToUpdate = await Envio_resumen_detalle.findByPk(
      id
    );

    if (!envio_resumen_detalleToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await envio_resumen_detalleToUpdate.update({
      ...envio_resumen_detalleData,
    });

    res.json(envio_resumen_detalleToUpdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEnvio_resumen_detalle,
  createEnvio_resumen_detalle,
  deleteEnvio_resumen_detalle,
  updateEnvio_resumen_detalle,
};
