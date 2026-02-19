const { Servicios } = require("../../database/models/servicios");
const { Op } = require("sequelize");

class ServicioRepository {
  /**
   * Obtener servicios paginados con filtros
   * @param {number} offset 
   * @param {number} limit 
   * @param {Object} filters - Filtros (nombre, estado)
   * @returns {Promise<{rows: Array, count: number}>}
   */
  async findAll(offset, limit, filters = {}) {
    const where = {};
    
    if (filters.nombre) {
      where.nombre = { [Op.iLike]: `%${filters.nombre}%` };
    }
    
    if (filters.estado && filters.estado !== "Todos") {
        // "Todos" is frontend concept, backend should receive specific status or handle all if null/undefined
        // But if frontend sends "Todos", we should ignore it here or handle it in service/controller
        // Assuming controller handles "Todos" -> undefined
        where.estado = filters.estado;
    }

    return await Servicios.findAndCountAll({
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Buscar servicio por ID
   * @param {number} id 
   * @returns {Promise<Object|null>} Servicio encontrado
   */
  async findById(id) {
    return await Servicios.findByPk(id);
  }

  /**
   * Crear nuevo servicio
   * @param {Object} data 
   * @returns {Promise<Object>} Servicio creado
   */
  async create(data) {
    return await Servicios.create(data);
  }

  /**
   * Actualizar servicio existente
   * @param {Object} servicio - Instancia de Sequelize del servicio
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Servicio actualizado
   */
  async update(servicio, data) {
    return await servicio.update(data);
  }

  /**
   * Eliminar servicio
   * @param {Object} servicio - Instancia de Sequelize del servicio
   * @returns {Promise<void>}
   */
  async delete(servicio) {
    return await servicio.destroy();
  }
}

module.exports = new ServicioRepository();
