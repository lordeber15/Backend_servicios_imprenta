const Tabla_parametrica = require("../../../database/models/facturacion/tablaparametrica");

const getTabla_parametrica = async (req, res) => {
  try {
    const tabla_parametricas = await Tabla_parametrica.findAll();
    res.json(tabla_parametricas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createTabla_parametrica = async (req, res) => {
  try {
    const tabla_parametricaData = req.body;
    const newTabla_parametrica = await Tabla_parametrica.create({
      ...tabla_parametricaData,
    });
    res.json(newTabla_parametrica);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteTabla_parametrica = async (req, res) => {
  try {
    const { id } = req.params;
    const tabla_parametrica = await Tabla_parametrica.findByPk(id);

    if (!tabla_parametrica) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tabla_parametrica.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateTabla_parametrica = async (req, res) => {
  try {
    const { id } = req.params;
    const tabla_parametricaData = req.body;

    const tabla_parametricaToUpdate = await Tabla_parametrica.findByPk(id);

    if (!tabla_parametricaToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tabla_parametricaToUpdate.update({
      ...tabla_parametricaData,
    });

    res.json(tabla_parametricaToUpdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTabla_parametrica,
  createTabla_parametrica,
  deleteTabla_parametrica,
  updateTabla_parametrica,
};
