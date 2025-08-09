const { Egreso } = require("../../models/Ingresosyegresos/egresos");

const getEgresos = async (req, res) => {
  try {
    const getEgresos = await Egreso.findAll();
    res.json(getEgresos);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createEgresos = async (req, res) => {
  try {
    const { monto, descripcion, fecha } = req.body;
    const newEgresos = await Egreso.create({
      monto,
      descripcion,
      fecha,
    });
    res.json(newEgresos);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
const deleteEgresos = async (req, res) => {
  try {
    const { id } = req.params;

    const egreso = await Egreso.findByPk(id);

    if (!egreso) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    await egreso.destroy();

    res.json({ message: "elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
const updateEgresos = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, descripcion, fecha } = req.body;

    const egresoupdate = await Egreso.findByPk(id);

    if (!egresoupdate) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    egresoupdate.monto = monto;
    egresoupdate.descripcion = descripcion;
    egresoupdate.fecha = fecha;

    await egresoupdate.save();

    res.json(egresoupdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getEgresos, createEgresos, deleteEgresos, updateEgresos };
