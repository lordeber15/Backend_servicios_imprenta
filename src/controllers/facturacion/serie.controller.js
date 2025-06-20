const { Serie } = require("../../models/facturacion/serie");

const getSerie = async (req, res) => {
  try {
    const series = await Serie.findAll();
    res.json(series);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

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

const deleteSerie = async (req, res) => {
  try {
    const { id } = req.params;
    const serie = await Serie.findByPk(id);

    if (!serie) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await serie.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateSerie = async (req, res) => {
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
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSerie,
  createSerie,
  deleteSerie,
  updateSerie,
};
