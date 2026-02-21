/**
 * CONTROLADOR DE SERVICIOS/TRABAJOS
 * 
 * Este controlador maneja toda la lógica de gestión de servicios/trabajos.
 * Delega la lógica de negocio al servicio correspondiente.
 */

const servicioService = require("../../../application/services/servicio.service");

/**
 * Obtener todos los servicios (paginado y filtrado)
 * 
 * Ruta: GET /servicios?page=1&limit=10&nombre=juan&estado=Pendiente
 */
const getServicios = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { nombre, estado } = req.query;
    
    // Handle "Todos" case from frontend just in case, though frontend should probably handle it
    const filters = {
        nombre,
        estado: estado === "Todos" ? undefined : estado
    };

    const result = await servicioService.getServicios(page, limit, filters);
    res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Crear nuevo servicio
 * 
 * Ruta: POST /servicios
 */
const createServicios = async (req, res) => {
  try {
    const newServicio = await servicioService.createServicio(req.body);
    res.json(newServicio);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Eliminar servicio
 * 
 * Ruta: DELETE /servicios/:id
 */
const deleteServicios = async (req, res) => {
  try {
    const result = await servicioService.deleteServicio(req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message === "Servicio no encontrado") {
        return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Actualizar servicio
 * 
 * Ruta: PUT /servicios/:id
 */
const updateServicios = async (req, res) => {
  try {
    const updatedServicio = await servicioService.updateServicio(req.params.id, req.body);
    res.json(updatedServicio);
  } catch (error) {
    if (error.message === "Servicio no encontrado") {
        return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getServicios,
  createServicios,
  deleteServicios,
  updateServicios,
};
