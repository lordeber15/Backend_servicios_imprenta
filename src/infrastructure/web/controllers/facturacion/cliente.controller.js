const Cliente = require("../../../database/models/facturacion/cliente");
const axios = require("axios");

/**
 * Busca un cliente por nro de documento.
 * 1. Primero busca en la BD local.
 * 2. Si no lo encuentra, consulta la API de DeColecta (RENIEC para DNI, SUNAT para RUC).
 *
 * @route GET /cliente/buscar/:nrodoc
 */
const buscarCliente = async (req, res) => {
  const { nrodoc } = req.params;

  if (!nrodoc || !/^\d+$/.test(nrodoc)) {
    return res.status(400).json({ message: "Número de documento inválido" });
  }

  try {
    // 1. Buscar en BD
    const clienteDB = await Cliente.findOne({ where: { nrodoc } });
    if (clienteDB) {
      return res.json({
        source: "db",
        id: clienteDB.id,
        tipo_documento_id: clienteDB.tipo_documento_id,
        nrodoc: clienteDB.nrodoc,
        razon_social: clienteDB.razon_social,
        direccion: clienteDB.direccion || "",
      });
    }

    // 2. No está en BD → consultar API externa
    const apiKey = process.env.DECOLECTA_API_KEY;
    if (!apiKey) {
      return res.status(404).json({ message: "Cliente no encontrado y API no configurada" });
    }

    const headers = { Authorization: `Bearer ${apiKey}` };

    if (nrodoc.length === 8) {
      // DNI → RENIEC
      const { data } = await axios.get(
        `https://api.decolecta.com/v1/reniec/dni?numero=${nrodoc}`,
        { headers }
      );

      const nombre = data.full_name ||
        [data.first_name, data.first_last_name, data.second_last_name]
          .filter(Boolean)
          .join(" ");

      return res.json({
        source: "api",
        tipo_documento_id: "1",
        nrodoc,
        razon_social: nombre || "",
        direccion: data.direccion || "",
      });
    }

    if (nrodoc.length === 11) {
      // RUC → SUNAT
      const { data } = await axios.get(
        `https://api.decolecta.com/v1/sunat/ruc?numero=${nrodoc}`,
        { headers }
      );

      return res.json({
        source: "api",
        tipo_documento_id: "6",
        nrodoc,
        razon_social: data.razon_social || "",
        direccion: data.direccion || "",
      });
    }

    return res.status(404).json({ message: "Documento no encontrado. Use 8 dígitos (DNI) o 11 dígitos (RUC)." });
  } catch (error) {
    console.error("Error en buscarCliente:", error.response?.data || error.message);
    return res.status(404).json({ message: "No se encontró información para este documento" });
  }
};

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


module.exports = { getCliente, createCliente, deleteCliente, updateCliente, buscarCliente };
