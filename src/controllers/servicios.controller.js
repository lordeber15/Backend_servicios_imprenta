const { Servicios } = require("../models/servicios");

const getServicios = async (req, res) => {
  try {
    const getServicios = await Servicios.findAll();
    res.json(getServicios);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createServicios = async (req, res) => {
  try {
    const { nombre, cantidad, descripcion, estado, total, acuenta } = req.body;
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
const deleteServicios = async (req, res) => {
  try {
    const { id } = req.params;

    const servicios = await Servicios.findByPk(id);

    if (!servicios) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    await servicios.destroy();

    res.json({ message: "Servicio eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
const updateServicios = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cantidad, descripcion, estado, total, acuenta } = req.body;

    const servicios = await Servicios.findByPk(id);

    if (!servicios) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    servicios.nombre = nombre;
    servicios.cantidad = cantidad;
    servicios.descripcion = descripcion;
    servicios.estado = estado;
    servicios.total = total;
    servicios.acuenta = acuenta;

    await servicios.save();

    res.json(servicios);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getServicios,
  createServicios,
  deleteServicios,
  updateServicios,
};
