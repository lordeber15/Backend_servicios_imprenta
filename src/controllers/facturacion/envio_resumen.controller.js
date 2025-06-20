const { Envio_resumen } = require("../../models/facturacion/envioresumen");

const getEnvio_resumen = async (req, res) => {
  try {
    const envio_resumens = await Envio_resumen.findAll();
    res.json(envio_resumens);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createEnvio_resumen = async (req, res) => {
  try {
    const envio_resumenData = req.body;
    const newEnvio_resumen = await Envio_resumen.create({
      ...envio_resumenData,
    });
    res.json(newEnvio_resumen);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteEnvio_resumen = async (req, res) => {
  try {
    const { id } = req.params;
    const envio_resumen = await Envio_resumen.findByPk(id);

    if (!envio_resumen) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await envio_resumen.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateEnvio_resumen = async (req, res) => {
  try {
    const { id } = req.params;
    const envio_resumenData = req.body;

    const envio_resumenToUpdate = await Envio_resumen.findByPk(id);

    if (!envio_resumenToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await envio_resumenToUpdate.update({
      ...envio_resumenData,
    });

    res.json(envio_resumenToUpdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEnvio_resumen,
  createEnvio_resumen,
  deleteEnvio_resumen,
  updateEnvio_resumen,
};
