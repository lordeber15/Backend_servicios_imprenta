const Cliente = require("../../models/facturacion/cliente");

/**
 * Obtener listado de clientes
 * @route GET /api/cliente
 */
/**
 * Obtiene el listado completo de todos los clientes registrados.
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res - Array de objetos de clientes.
 */
const getCliente = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    res.json(clientes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Registra un nuevo cliente en el padrón.
 * 
 * @param {import('express').Request} req - Body: { tipo_documento_id, nrodoc, razon_social, direccion }
 * @param {import('express').Response} res - El cliente creado.
 */
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

/**
 * Elimina un cliente de la base de datos por su ID.
 * 
 * @param {import('express').Request} req - Params: { id }
 * @param {import('express').Response} res - Mensaje de confirmación.
 */
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

/**
 * Actualiza la información de un cliente existente.
 * 
 * @param {import('express').Request} req - Params: { id }; Body: { tipo_documento_id, nrodoc, razon_social, direccion }
 * @param {import('express').Response} res - El cliente actualizado.
 */
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
