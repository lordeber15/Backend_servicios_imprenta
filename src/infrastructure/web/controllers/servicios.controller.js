/**
 * CONTROLADOR DE SERVICIOS/TRABAJOS
 * 
 * Este controlador maneja toda la lógica de gestión de servicios/trabajos.
 * Los servicios representan las órdenes de trabajo de la imprenta.
 * 
 * Funcionalidades:
 * - Listar todos los servicios
 * - Crear nuevo servicio
 * - Actualizar servicio existente
 * - Eliminar servicio
 * 
 * Campos del servicio:
 * - nombre: Nombre del cliente
 * - cantidad: Cantidad de productos a imprimir
 * - descripcion: Descripción del trabajo
 * - estado: Estado del trabajo (Pendiente, Diseño, Impresión, Terminado, Entregado)
 * - total: Monto total del trabajo
 * - acuenta: Monto pagado a cuenta
 */

const { Servicios } = require("../../database/models/servicios");

/**
 * Obtener todos los servicios
 * 
 * Retorna la lista completa de servicios/trabajos registrados.
 * 
 * Ruta: GET /servicios
 * Autenticación: Requerida (JWT)
 * 
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @returns {Array} Lista de servicios
 * 
 * Respuesta exitosa (200):
 * [
 *   {
 *     id: 1,
 *     nombre: "Juan Pérez",
 *     cantidad: 100,
 *     descripcion: "Tarjetas de presentación",
 *     estado: "Pendiente",
 *     total: 150.00,
 *     acuenta: 50.00,
 *     createdAt: "2024-01-15T10:30:00Z",
 *     updatedAt: "2024-01-15T10:30:00Z"
 *   }
 * ]
 */
const getServicios = async (req, res) => {
  try {
    // Buscar todos los servicios en la base de datos
    const getServicios = await Servicios.findAll();
    res.json(getServicios);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Crear nuevo servicio
 * 
 * Registra un nuevo servicio/trabajo en el sistema.
 * 
 * Ruta: POST /servicios
 * Autenticación: Requerida (JWT)
 * 
 * @param {Object} req - Request
 * @param {string} req.body.nombre - Nombre del cliente
 * @param {number} req.body.cantidad - Cantidad de productos
 * @param {string} req.body.descripcion - Descripción del trabajo
 * @param {string} req.body.estado - Estado (Pendiente, Diseño, Impresión, Terminado, Entregado)
 * @param {number} req.body.total - Monto total
 * @param {number} req.body.acuenta - Monto a cuenta
 * @param {Object} res - Response
 * @returns {Object} Servicio creado
 * 
 * Respuesta exitosa (200):
 * {
 *   id: 5,
 *   nombre: "María López",
 *   cantidad: 500,
 *   descripcion: "Volantes publicitarios",
 *   estado: "Pendiente",
 *   total: 300.00,
 *   acuenta: 100.00
 * }
 */
const createServicios = async (req, res) => {
  try {
    const { nombre, cantidad, descripcion, estado, total, acuenta } = req.body;
    
    // Crear nuevo servicio con los datos del body
    const newServicios = await Servicios.create({
      nombre,
      cantidad,
      descripcion,
      estado,
      total,
      acuenta,
    });
    
    res.json(newServicios);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
/**
 * Eliminar servicio
 * 
 * Elimina un servicio/trabajo del sistema.
 * 
 * Ruta: DELETE /servicios/:id
 * Autenticación: Requerida (JWT)
 * 
 * @param {Object} req - Request
 * @param {string} req.params.id - ID del servicio a eliminar
 * @param {Object} res - Response
 * @returns {Object} Mensaje de confirmación
 * 
 * Respuesta exitosa (200):
 * { message: "Servicio eliminado correctamente" }
 * 
 * Errores:
 * - 404: Servicio no encontrado
 * - 500: Error del servidor
 */
const deleteServicios = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar servicio por ID
    const servicios = await Servicios.findByPk(id);

    if (!servicios) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    // Eliminar servicio de la base de datos
    await servicios.destroy();

    res.json({ message: "Servicio eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
/**
 * Actualizar servicio
 * 
 * Actualiza los datos de un servicio/trabajo existente.
 * 
 * Ruta: PUT /servicios/:id
 * Autenticación: Requerida (JWT)
 * 
 * @param {Object} req - Request
 * @param {string} req.params.id - ID del servicio a actualizar
 * @param {string} [req.body.nombre] - Nuevo nombre del cliente
 * @param {number} [req.body.cantidad] - Nueva cantidad
 * @param {string} [req.body.descripcion] - Nueva descripción
 * @param {string} [req.body.estado] - Nuevo estado
 * @param {number} [req.body.total] - Nuevo total
 * @param {number} [req.body.acuenta] - Nuevo monto a cuenta
 * @param {Object} res - Response
 * @returns {Object} Servicio actualizado
 * 
 * Respuesta exitosa (200):
 * {
 *   id: 1,
 *   nombre: "Juan Pérez",
 *   cantidad: 100,
 *   descripcion: "Tarjetas de presentación",
 *   estado: "Terminado",
 *   total: 150.00,
 *   acuenta: 150.00
 * }
 * 
 * Errores:
 * - 404: Servicio no encontrado
 * - 500: Error del servidor
 */
const updateServicios = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cantidad, descripcion, estado, total, acuenta } = req.body;

    // Buscar servicio por ID
    const servicios = await Servicios.findByPk(id);

    if (!servicios) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    // Actualizar todos los campos
    servicios.nombre = nombre;
    servicios.cantidad = cantidad;
    servicios.descripcion = descripcion;
    servicios.estado = estado;
    servicios.total = total;
    servicios.acuenta = acuenta;

    // Guardar cambios en la base de datos
    await servicios.save();

    res.json(servicios);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Exportar todas las funciones del controlador
module.exports = {
  getServicios,
  createServicios,
  deleteServicios,
  updateServicios,
};
