const Tipo_documento = require("../../../database/models/facturacion/tipodocumento");

const getTipo_documento = async (req, res, next) => {
  try {
    const tipo_documentos = await Tipo_documento.findAll();
    res.json(tipo_documentos);
  } catch (error) {
    return next(error);
  }
};

const createTipo_documento = async (req, res, next) => {
  try {
    const tipo_documentoData = req.body;
    const newTipo_documento = await Tipo_documento.create({
      ...tipo_documentoData,
    });
    res.json(newTipo_documento);
  } catch (error) {
    return next(error);
  }
};

const deleteTipo_documento = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tipo_documento = await Tipo_documento.findByPk(id);

    if (!tipo_documento) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tipo_documento.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateTipo_documento = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tipo_documentoData = req.body;

    const tipo_documentoToUpdate = await Tipo_documento.findByPk(id);

    if (!tipo_documentoToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await tipo_documentoToUpdate.update({
      ...tipo_documentoData,
    });

    res.json(tipo_documentoToUpdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getTipo_documento,
  createTipo_documento,
  deleteTipo_documento,
  updateTipo_documento,
};
