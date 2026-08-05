const Tipo_afectacion = require("../../../database/models/facturacion/tipoafectacion");

const getTipo_afectacion = async (req, res, next) => {
  try {
    const tipo_afectacions = await Tipo_afectacion.findAll();
    res.json(tipo_afectacions);
  } catch (error) {
    return next(error);
  }
};

const createTipo_afectacion = async (req, res, next) => {
  try {
    const tipo_afectacionData = req.body;
    const newTipo_afectacion = await Tipo_afectacion.create({
      ...tipo_afectacionData,
    });
    res.json(newTipo_afectacion);
  } catch (error) {
    return next(error);
  }
};

const deleteTipo_afectacion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tipo_afectacion = await Tipo_afectacion.findByPk(id);

    if (!tipo_afectacion) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tipo_afectacion.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateTipo_afectacion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tipo_afectacionData = req.body;

    const tipo_afectacionToUpdate = await Tipo_afectacion.findByPk(id);

    if (!tipo_afectacionToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tipo_afectacionToUpdate.update({
      ...tipo_afectacionData,
    });

    res.json(tipo_afectacionToUpdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getTipo_afectacion,
  createTipo_afectacion,
  deleteTipo_afectacion,
  updateTipo_afectacion,
};
