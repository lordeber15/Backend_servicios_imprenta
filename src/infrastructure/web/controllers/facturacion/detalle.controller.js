const Detalle = require("../../../database/models/facturacion/detalles");
const Producto = require("../../../database/models/facturacion/producto");

const getDetalle = async (req, res, next) => {
  try {
    const detalles = await Detalle.findAll();
    res.json(detalles);
  } catch (error) {
    return next(error);
  }
};

const createDetalle = async (req, res, next) => {
  try {
    const detalleData = req.body;
    const newDetalle = await Detalle.create({
      ...detalleData,
    });

    // Decrementar stock si el detalle está vinculado a un producto (no servicio)
    if (detalleData.producto_id) {
      await Producto.decrement("stock", {
        by: detalleData.cantidad,
        where: { id: detalleData.producto_id, es_servicio: false },
      });
    }

    res.json(newDetalle);
  } catch (error) {
    return next(error);
  }
};

const deleteDetalle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const detalle = await Detalle.findByPk(id);

    if (!detalle) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await detalle.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateDetalle = async (req, res, next) => {
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
    return next(error);
  }
};

module.exports = {
  getDetalle,
  createDetalle,
  deleteDetalle,
  updateDetalle,
};
