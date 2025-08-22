const Moneda = require("../../models/facturacion/moneda");

const getMoneda = async (req, res) => {
  try {
    const monedas = await Moneda.findAll();
    res.json(monedas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createMoneda = async (req, res) => {
  try {
    const monedaData = req.body;
    const newMoneda = await Moneda.create({
      ...monedaData,
    });
    res.json(newMoneda);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteMoneda = async (req, res) => {
  try {
    const { id } = req.params;
    const moneda = await Moneda.findByPk(id);

    if (!moneda) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await moneda.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateMoneda = async (req, res) => {
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
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMoneda,
  createMoneda,
  deleteMoneda,
  updateMoneda,
};
