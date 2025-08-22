const Producto = require("../../models/facturacion/producto");

const getProducto = async (req, res) => {
  try {
    const productos = await Producto.findAll();
    res.json(productos);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createProducto = async (req, res) => {
  try {
    const productoData = req.body;
    const newProducto = await Producto.create({
      ...productoData,
    });
    res.json(newProducto);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await producto.destroy();
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateProducto = async (req, res) => {
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
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducto,
  createProducto,
  deleteProducto,
  updateProducto,
};
