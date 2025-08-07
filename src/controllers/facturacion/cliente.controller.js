const { Cliente } = require("../../models/facturacion/cliente");

const getCliente = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    res.json(clientes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createCliente = async (req, res) => {
  try {
    const { tipo_documento_id, nrodoc, razon_social, direccion } = req.body;
    const newCliente = await Cliente.create({
      tipo_documento_id,
      nrodoc,
      razon_social,
      direccion,
    });
    res.json(newCliente);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const cliente = await Cliente.findByPk(id);

    if (!cliente) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    await cliente.destroy();

    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo_documento_id, nrodoc, razon_social, direccion } = req.body;

    const cliente = await Cliente.findByPk(id);

    if (!cliente) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }

    cliente.tipo_documento_id = tipo_documento_id;
    cliente.nrodoc = nrodoc;
    cliente.razon_social = razon_social;
    cliente.direccion = direccion;

    await cliente.save();

    res.json(cliente);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getCliente, createCliente, deleteCliente, updateCliente };
