const servicioRepository = require("../../infrastructure/repositories/servicio.repository");

class ServicioService {
  /**
   * Obtener servicios paginados
   * @param {number} page 
   * @param {number} limit 
   * @param {Object} filters 
   * @returns {Promise<Object>}
   */
  async getServicios(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const { count, rows } = await servicioRepository.findAll(offset, limit, filters);

    return {
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemsPerPage: limit,
      data: rows
    };
  }

  /**
   * Crear nuevo servicio
   * @param {Object} data 
   * @returns {Promise<Object>} Servicio creado
   */
  async createServicio(data) {
    // Aquí se pueden agregar validaciones de negocio adicionales
    return await servicioRepository.create(data);
  }

  /**
   * Eliminar servicio
   * @param {number} id 
   * @returns {Promise<Object>} Mensaje de resultado
   */
  async deleteServicio(id) {
    const servicio = await servicioRepository.findById(id);

    if (!servicio) {
      throw new Error("Servicio no encontrado");
    }

    await servicioRepository.delete(servicio);
    return { message: "Servicio eliminado correctamente" };
  }

  /**
   * Actualizar servicio
   * @param {number} id 
   * @param {Object} data 
   * @returns {Promise<Object>} Servicio actualizado
   */
  async updateServicio(id, data) {
    const servicio = await servicioRepository.findById(id);

    if (!servicio) {
      throw new Error("Servicio no encontrado");
    }
    
    // Asignar nuevos valores solo si vienen en data
    const updatedValues = {
        nombre: data.nombre || servicio.nombre,
        cantidad: data.cantidad || servicio.cantidad,
        descripcion: data.descripcion || servicio.descripcion,
        estado: data.estado || servicio.estado,
        total: data.total || servicio.total,
        acuenta: data.acuenta || servicio.acuenta
    };

    return await servicioRepository.update(servicio, updatedValues);
  }

  /**
   * Obtener estadísticas de servicios (conteos por estado)
   * @returns {Promise<Object>}
   */
  async getStats() {
    const counts = await servicioRepository.countByStatus();
    const stats = {
      total: 0,
      Pendiente: 0,
      "Diseño": 0,
      "Impresión": 0,
      Terminado: 0,
      Entregado: 0,
    };
    counts.forEach(({ estado, count }) => {
      stats[estado] = parseInt(count, 10);
      stats.total += parseInt(count, 10);
    });
    return stats;
  }
}

module.exports = new ServicioService();
