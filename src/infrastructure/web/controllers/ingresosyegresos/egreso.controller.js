const { Egreso } = require("../../../database/models/Ingresosyegresos/egresos");
const { cajaAbiertaId, exigirCajaNoCerrada } = require("../../../../application/services/caja.service");

const getEgresos = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    if (page && limit) {
      const offset = (page - 1) * limit;
      const { count, rows } = await Egreso.findAndCountAll({
        order: [["fecha", "DESC"]],
        limit,
        offset,
      });
      return res.json({ data: rows, total: count, page, limit });
    }

    const egresos = await Egreso.findAll({ order: [["fecha", "DESC"]] });
    res.json(egresos);
  } catch (error) {
    return next(error);
  }
};

const createEgresos = async (req, res, next) => {
  try {
    const { monto, descripcion, fecha, metodo } = req.body;
    // Si hay caja abierta, el movimiento entra en su cierre (ingreso suma, egreso resta).
    const newEgresos = await Egreso.create({
      monto,
      descripcion,
      fecha,
      metodo,
      caja_id: await cajaAbiertaId(),
    });
    res.json(newEgresos);
  } catch (error) {
    return next(error);
  }
};
const deleteEgresos = async (req, res, next) => {
  try {
    const { id } = req.params;

    const egreso = await Egreso.findByPk(id);

    if (!egreso) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    await exigirCajaNoCerrada(egreso.caja_id);


    await egreso.destroy();

    res.json({ message: "elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};
const updateEgresos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { monto, descripcion, fecha, metodo } = req.body;

    const egresoupdate = await Egreso.findByPk(id);

    if (!egresoupdate) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    egresoupdate.monto = monto;
    egresoupdate.descripcion = descripcion;
    egresoupdate.fecha = fecha;
    egresoupdate.metodo = metodo;

    await exigirCajaNoCerrada(egresoupdate.caja_id);


    await egresoupdate.save();

    res.json(egresoupdate);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getEgresos, createEgresos, deleteEgresos, updateEgresos };
