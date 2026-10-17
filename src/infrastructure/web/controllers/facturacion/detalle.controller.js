const Detalle = require("../../../database/models/facturacion/detalles");
const { NotFoundError, ValidationError } = require("../../../utils/errors");
const { cargarEditable } = require("./comprobante.controller");
const { calcularLinea, calcularTotales } = require("../../../../application/services/calculoComprobante");

// Los detalles se crean junto con su comprobante en POST /comprobante/emision.
// Aquí solo se consultan, y se corrigen o eliminan mientras el comprobante
// siga en GENERADO (nunca después de firmado o enviado a SUNAT).

const getDetalle = async (req, res, next) => {
  try {
    const where = req.query.comprobante_id ? { comprobante_id: req.query.comprobante_id } : {};
    res.json(await Detalle.findAll({ where, order: [["comprobante_id", "ASC"], ["item", "ASC"]] }));
  } catch (error) {
    return next(error);
  }
};

async function cargarDetalleEditable(id) {
  const detalle = await Detalle.findByPk(id);
  if (!detalle) throw new NotFoundError("Detalle no encontrado");
  const comprobante = await cargarEditable(detalle.comprobante_id); // 409 si ya no es editable
  return { detalle, comprobante };
}

/** La cabecera debe cuadrar con sus líneas: el XML se arma con los totales de cabecera. */
async function recalcularCabecera(comprobante) {
  const lineas = await Detalle.findAll({ where: { comprobante_id: comprobante.id }, order: [["item", "ASC"]] });
  await comprobante.update(calcularTotales(lineas));
}

const deleteDetalle = async (req, res, next) => {
  try {
    const { detalle, comprobante } = await cargarDetalleEditable(req.params.id);
    const restantes = await Detalle.count({ where: { comprobante_id: comprobante.id } });
    if (restantes <= 1) throw new ValidationError("El comprobante debe tener al menos un ítem");
    await detalle.destroy();
    await recalcularCabecera(comprobante);
    res.json({ message: "Detalle eliminado" });
  } catch (error) {
    return next(error);
  }
};

/** Solo descripción, unidad, cantidad y precio; los montos se recalculan en el servidor. */
const updateDetalle = async (req, res, next) => {
  try {
    const { detalle, comprobante } = await cargarDetalleEditable(req.params.id);
    const { descripcion, unidad_id, cantidad, precio_unitario } = req.body || {};
    const cambios = {};
    if (descripcion !== undefined) cambios.descripcion = String(descripcion).slice(0, 500);
    if (unidad_id !== undefined) cambios.unidad_id = String(unidad_id).slice(0, 10);
    if (cantidad !== undefined || precio_unitario !== undefined) {
      const q = Number(cantidad ?? detalle.cantidad);
      const p = Number(precio_unitario ?? detalle.precio_unitario);
      if (!(q > 0) || !(p > 0)) throw new ValidationError("cantidad y precio_unitario deben ser mayores a 0");
      Object.assign(cambios, calcularLinea({ cantidad: q, precio_unitario: p }));
    }
    await detalle.update(cambios);
    await recalcularCabecera(comprobante);
    res.json(detalle);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDetalle, deleteDetalle, updateDetalle };
