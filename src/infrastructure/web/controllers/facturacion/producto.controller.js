const Producto = require("../../../database/models/facturacion/producto");

/**
 * Obtener todos los productos
 * @route GET /api/productos
 */
const getProducto = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    if (page && limit) {
      const offset = (page - 1) * limit;
      const { count, rows } = await Producto.findAndCountAll({
        order: [["id", "DESC"]],
        limit,
        offset,
      });
      return res.json({ data: rows, total: count, page, limit });
    }

    const productos = await Producto.findAll({ order: [["id", "DESC"]] });
    res.json(productos);
  } catch (error) {
    return next(error);
  }
};

/**
 * Crear un nuevo producto
 * @route POST /api/productos
 */
const createProducto = async (req, res, next) => {
  try {
    const productoData = req.body;
    const newProducto = await Producto.create({
      ...productoData,
    });
    res.json(newProducto);
  } catch (error) {
    return next(error);
  }
};

/**
 * Eliminar un producto por ID
 * @route DELETE /api/productos/:id
 */
const deleteProducto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await producto.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

/**
 * Actualizar un producto existente
 * @route PUT /api/productos/:id
 */
const updateProducto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const productoData = req.body;

    const productoToUpdate = await Producto.findByPk(id);

    if (!productoToUpdate) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await productoToUpdate.update({
      ...productoData,
    });

    res.json(productoToUpdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProducto,
  createProducto,
  deleteProducto,
  updateProducto,
};
