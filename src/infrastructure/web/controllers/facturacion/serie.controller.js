const Serie = require("../../../database/models/facturacion/serie");

const getSerie = async (req, res, next) => {
  try {
    const series = await Serie.findAll();
    res.json(series);
  } catch (error) {
    return next(error);
  }
};

const createSerie = async (req, res, next) => {
  try {
    const serieData = req.body;
    const newSerie = await Serie.create({
      ...serieData,
    });
    res.json(newSerie);
  } catch (error) {
    return next(error);
  }
};

const deleteSerie = async (req, res, next) => {
  try {
    const { id } = req.params;
    const serie = await Serie.findByPk(id);

    if (!serie) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await serie.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateSerie = async (req, res, next) => {
  try {
    const { id } = req.params;
    const serieData = req.body;

    const serieToUpdate = await Serie.findByPk(id);

    if (!serieToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await serieToUpdate.update({
      ...serieData,
    });

    res.json(serieToUpdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSerie,
  createSerie,
  deleteSerie,
  updateSerie,
};
