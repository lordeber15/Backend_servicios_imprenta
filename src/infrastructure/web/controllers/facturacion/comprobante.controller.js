const { UniqueConstraintError } = require("sequelize");
const { registrar } = require("../../../../application/services/auditoria.service");
const Comprobante = require("../../../database/models/facturacion/comprobante");
const { emisionSchema, mensajeError } = require("../../../../application/validation/emision.schema");
const emisionService = require("../../../../application/services/emision.service");
const { ValidationError, NotFoundError, ConflictError } = require("../../../utils/errors");

// Solo un comprobante que aún no se firmó ni envió puede editarse o borrarse.
// Uno emitido (aceptado o no) se corrige con nota de crédito o comunicación de baja.
const ESTADO_EDITABLE = "GENERADO";
// Campos de cabecera editables en GENERADO. Nunca numeración, montos ni estado SUNAT.
const CAMPOS_EDITABLES = ["forma_pago", "fecha_vencimiento", "metodo_pago", "descripcion_nota"];

/**
 * Listado de comprobantes (sin el CDR ni campos pesados).
 * @route GET /comprobante
 */
const getComprobante = async (_req, res, next) => {
  try {
    const comprobantes = await Comprobante.findAll({
      attributes: { exclude: ["cdr_xml"] },
      order: [["id", "DESC"]],
    });
    res.json(comprobantes);
  } catch (error) {
    return next(error);
  }
};

/**
 * Emisión completa en una transacción: el servidor asigna el número y calcula los montos.
 * @route POST /comprobante/emision
 */
const emitirComprobanteCompleto = async (req, res, next) => {
  try {
    const parsed = emisionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(mensajeError(parsed.error));

    const { comprobante: c, firmado, error_firma, job_id } = await emisionService.emitir(parsed.data);
    registrar(req, c.tipo_comprobante_id === "07" ? "nota_credito_emitida" : "comprobante_emitido", {
      entidad: "Comprobante",
      entidad_id: c.id,
      despues: {
        numero: `${c.serie}-${c.correlativo}`, tipo: c.tipo_comprobante_id, total: c.total,
        metodo_pago: c.metodo_pago, forma_pago: c.forma_pago, comprobante_ref_id: c.comprobante_ref_id, caja_id: c.caja_id,
      },
    });

    return res.status(201).json({
      comprobante_id: c.id,
      tipo_comprobante_id: c.tipo_comprobante_id,
      serie: c.serie,
      correlativo: c.correlativo,
      numero: `${c.serie}-${String(c.correlativo).padStart(8, "0")}`,
      op_gravadas: c.op_gravadas,
      igv: c.igv,
      total: c.total,
      estado_sunat: c.estado_sunat,
      firmado,
      job_id: job_id ?? null,
      advertencia: error_firma ?? null,
      estado_url: `/comprobante/${c.id}/estado`,
    });
  } catch (error) {
    // Respaldo del índice único: no debería ocurrir con el bloqueo de la serie.
    if (error instanceof UniqueConstraintError) {
      return next(new ConflictError("El número de comprobante ya existe. Reintente la emisión."));
    }
    return next(error);
  }
};

async function cargarEditable(id) {
  const comprobante = await Comprobante.findByPk(id);
  if (!comprobante) throw new NotFoundError("Comprobante no encontrado");
  if (comprobante.estado_sunat !== ESTADO_EDITABLE) {
    throw new ConflictError(
      `El comprobante ${comprobante.serie}-${comprobante.correlativo} está en estado ${comprobante.estado_sunat} ` +
      "y no puede modificarse. Use una nota de crédito o una comunicación de baja."
    );
  }
  return comprobante;
}

/** @route DELETE /comprobante/:id  (solo Administrador, solo GENERADO) */
const deleteComprobante = async (req, res, next) => {
  try {
    const comprobante = await cargarEditable(req.params.id);
    await comprobante.destroy();
    registrar(req, "comprobante_eliminado", { entidad: "Comprobante", entidad_id: comprobante.id, antes: comprobante });
    res.json({ message: "Comprobante eliminado" });
  } catch (error) {
    return next(error);
  }
};

/** @route PUT /comprobante/:id  (solo Administrador, solo GENERADO, campos permitidos) */
const updateComprobante = async (req, res, next) => {
  try {
    const comprobante = await cargarEditable(req.params.id);
    const cambios = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    );
    if (!Object.keys(cambios).length) {
      throw new ValidationError(`Solo se pueden editar: ${CAMPOS_EDITABLES.join(", ")}`);
    }
    const antes = Object.fromEntries(Object.keys(cambios).map((k) => [k, comprobante[k]]));
    await comprobante.update(cambios);
    registrar(req, "comprobante_editado", { entidad: "Comprobante", entidad_id: comprobante.id, antes, despues: cambios });
    res.json(comprobante);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getComprobante,
  emitirComprobanteCompleto,
  deleteComprobante,
  updateComprobante,
  cargarEditable,
};
