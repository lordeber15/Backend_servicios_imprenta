const { Ingresos } = require("../../../database/models/Ingresosyegresos/ingresos");

const getIngreso = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    if (page && limit) {
      const offset = (page - 1) * limit;
      const { count, rows } = await Ingresos.findAndCountAll({
        order: [["fecha", "DESC"]],
        limit,
        offset,
      });
      return res.json({ data: rows, total: count, page, limit });
    }

    const ingresos = await Ingresos.findAll({ order: [["fecha", "DESC"]] });
    res.json(ingresos);
  } catch (error) {
    return next(error);
  }
};

const createIngreso = async (req, res, next) => {
  try {
    const { monto, descripcion, fecha, metodo } = req.body;
    const newIngreso = await Ingresos.create({
      monto,
      descripcion,
      fecha,
      metodo,
    });
    res.json(newIngreso);
  } catch (error) {
    return next(error);
  }
};
const deleteIngreso = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ingreso = await Ingresos.findByPk(id);

    if (!ingreso) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    await ingreso.destroy();

    res.json({ message: "elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};
const updateIngreso = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { monto, descripcion, fecha, metodo } = req.body;

    const ingresoupdate = await Ingresos.findByPk(id);

    if (!ingresoupdate) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    ingresoupdate.monto = monto;
    ingresoupdate.descripcion = descripcion;
    ingresoupdate.fecha = fecha;
    ingresoupdate.metodo = metodo;

    await ingresoupdate.save();

    res.json(ingresoupdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getIngreso, createIngreso, deleteIngreso, updateIngreso };
