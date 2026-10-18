"use strict";
/**
 * EMISIÓN DE COMPROBANTES (factura 01, boleta 03, nota de crédito 07)
 *
 * Reemplaza la secuencia que hacía el navegador (crear cliente → cabecera →
 * N detalles → /emitir, sin transacción y con el número elegido por el
 * cliente). Ahora, en UNA transacción:
 *   1. Valida reglas de negocio (serie, emisor, referencia de la NC, montos).
 *   2. Busca o crea el cliente.
 *   3. Reserva el correlativo con SELECT ... FOR UPDATE sobre la serie y la
 *      avanza: dos emisiones simultáneas nunca obtienen el mismo número
 *      (el índice único comprobante_numeracion_unica lo garantiza además en BD).
 *   4. Recalcula montos en el servidor (calculoComprobante).
 *   5. Crea cabecera, detalles, cuota (crédito) y descuenta stock; queda
 *      vinculado a la caja abierta (sin caja abierta no se emite).
 * Tras el COMMIT firma el XML y lo encola para SUNAT. Si la firma falla, el
 * comprobante queda en GENERADO con su número y se reintenta con /reenviar.
 */
const { Op } = require("sequelize");
const sequelize = require("../../infrastructure/database/database");
const Comprobante = require("../../infrastructure/database/models/facturacion/comprobante");
const Detalle = require("../../infrastructure/database/models/facturacion/detalles");
const Cliente = require("../../infrastructure/database/models/facturacion/cliente");
const Serie = require("../../infrastructure/database/models/facturacion/serie");
const Emisor = require("../../infrastructure/database/models/facturacion/emisor");
const Cuota = require("../../infrastructure/database/models/facturacion/cuota");
const Producto = require("../../infrastructure/database/models/facturacion/producto");
require("../../infrastructure/database/models/facturacion/asociation");

const { calcularLinea, calcularTotales, IGV_PORCENTAJE } = require("./calculoComprobante");
const { INCLUDE_XML, generarYFirmarXml } = require("./firmaComprobante");
const { encolarEnvio } = require("../../infrastructure/queues/sunatQueue");
const { exigirCajaAbierta } = require("./caja.service");
const { hoyLocal } = require("../../infrastructure/utils/fecha");
const { ValidationError, NotFoundError, ConflictError } = require("../../infrastructure/utils/errors");

// SUNAT exige identificar al comprador en boletas por encima de este monto.
const BOLETA_MONTO_SIN_DOC = 700;
// Mismo plazo que aplica el worker (FUERA_PLAZO): no tiene sentido crear algo que no se podrá enviar.
const { vencido, plazoDias } = require("../plazosSunat");
const ESTADOS_REF_VALIDOS = ["ACEPTADO", "OBSERVADO"];
const ESTADOS_NO_CUENTAN = ["RECHAZADO", "FUERA_PLAZO", "ANULADO"];

function validarFecha(fecha, tipo, serie) {
  const hoy = hoyLocal();
  if (fecha > hoy) throw new ValidationError("La fecha de emisión no puede ser futura");
  if (vencido(fecha, tipo, serie, hoy)) {
    throw new ValidationError(`La fecha de emisión supera el plazo de envío a SUNAT (${plazoDias(tipo, serie)} días)`);
  }
}

async function resolverCliente(datos, transaction) {
  if (!datos || datos.tipo_documento_id === "0" || !datos.nrodoc) return null;

  const existente = await Cliente.findOne({
    where: { tipo_documento_id: datos.tipo_documento_id, nrodoc: datos.nrodoc },
    order: [["id", "ASC"]],
    transaction,
  });
  if (existente) return existente;

  return Cliente.create({
    tipo_documento_id: datos.tipo_documento_id,
    nrodoc: datos.nrodoc,
    razon_social: datos.razon_social || datos.nrodoc,
    direccion: datos.direccion || null,
  }, { transaction });
}

/** Valida la NC contra su comprobante de referencia (bloqueado para evitar NC concurrentes). */
async function validarNota(d, serie, totalNota, transaction) {
  const ref = await Comprobante.findByPk(d.nota.comprobante_ref_id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!ref) throw new NotFoundError("Comprobante de referencia no encontrado");
  if (ref.emisor_id !== d.emisor_id) throw new ValidationError("La referencia pertenece a otro emisor");
  if (!["01", "03"].includes(ref.tipo_comprobante_id)) {
    throw new ValidationError("Solo se pueden emitir notas de crédito sobre facturas o boletas");
  }
  if (!ESTADOS_REF_VALIDOS.includes(ref.estado_sunat)) {
    throw new ConflictError(`El comprobante de referencia no está aceptado por SUNAT (estado: ${ref.estado_sunat})`);
  }
  // SUNAT: la serie de la NC empieza con la misma letra que la del comprobante (F/B).
  if (serie.serie[0] !== ref.serie[0]) {
    throw new ValidationError(`Una nota sobre ${ref.serie} debe usar una serie que empiece con "${ref.serie[0]}"`);
  }

  const acumulado = await Comprobante.sum("total", {
    where: {
      comprobante_ref_id: ref.id,
      tipo_comprobante_id: "07",
      estado_sunat: { [Op.notIn]: ESTADOS_NO_CUENTAN },
    },
    transaction,
  });
  const disponible = Number(ref.total) - Number(acumulado || 0);
  if (totalNota > disponible + 0.001) {
    throw new ValidationError(
      `El total de la nota (${totalNota.toFixed(2)}) supera el saldo del comprobante (${disponible.toFixed(2)})`
    );
  }
  return ref;
}

/**
 * @param {object} d  Solicitud ya validada por emisionSchema
 * @returns {Promise<{comprobante: object, firmado: boolean, error_firma?: string, job_id?: string}>}
 */
async function emitir(d) {
  const fecha = d.fecha_emision || hoyLocal();

  const lineas = d.items.map(calcularLinea);
  const totales = calcularTotales(lineas);

  if (d.tipo_comprobante_id === "03" && totales.total > BOLETA_MONTO_SIN_DOC &&
      (!d.cliente || d.cliente.tipo_documento_id === "0" || !d.cliente.nrodoc)) {
    throw new ValidationError(`Boletas mayores a S/ ${BOLETA_MONTO_SIN_DOC} requieren documento del cliente`);
  }

  const id = await sequelize.transaction(async (transaction) => {
    // Toda venta o nota de crédito se registra en la caja abierta (409 si no hay).
    const caja = await exigirCajaAbierta(transaction);

    const emisor = await Emisor.findByPk(d.emisor_id, { transaction });
    if (!emisor) throw new NotFoundError("Emisor no encontrado");

    // Bloqueo de la fila de la serie: serializa las emisiones de la misma serie.
    const serie = await Serie.findByPk(d.serie_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!serie) throw new NotFoundError("Serie no encontrada");
    if (serie.tipo_comprobante_id !== d.tipo_comprobante_id) {
      throw new ValidationError(`La serie ${serie.serie} no corresponde al tipo de comprobante ${d.tipo_comprobante_id}`);
    }
    // El plazo depende del tipo y de la serie (una NC sobre boleta usa serie B…).
    validarFecha(fecha, d.tipo_comprobante_id, serie.serie);

    let clienteId = null;
    let ref = null;
    if (d.tipo_comprobante_id === "07") {
      ref = await validarNota(d, serie, totales.total, transaction);
      clienteId = ref.cliente_id; // SUNAT: mismo receptor que el comprobante original
    } else {
      clienteId = (await resolverCliente(d.cliente, transaction))?.id ?? null;
    }

    const correlativo = serie.correlativo || 1;
    await serie.update({ correlativo: correlativo + 1 }, { transaction });

    const comprobante = await Comprobante.create({
      emisor_id: emisor.id,
      tipo_comprobante_id: d.tipo_comprobante_id,
      serie_id: serie.id,
      serie: serie.serie,
      correlativo,
      fecha_emision: fecha,
      fecha_vencimiento: d.forma_pago === "Crédito" ? d.fecha_vencimiento : null,
      moneda_id: "PEN",
      ...totales,
      cliente_id: clienteId,
      forma_pago: d.forma_pago,
      metodo_pago: d.metodo_pago,
      caja_id: caja.id,
      estado_sunat: "GENERADO",
      tipo_nota_id: ref ? d.nota.tipo_nota_id : null,
      descripcion_nota: ref ? d.nota.descripcion_nota : null,
      comprobante_ref_id: ref ? ref.id : null,
    }, { transaction });

    await Detalle.bulkCreate(lineas.map((l, i) => ({
      comprobante_id: comprobante.id,
      item: i + 1,
      descripcion: d.items[i].descripcion,
      unidad_id: d.items[i].unidad_id,
      producto_id: d.items[i].producto_id || null,
      ...l,
      porcentaje_igv: IGV_PORCENTAJE,
    })), { transaction });

    if (d.forma_pago === "Crédito") {
      await Cuota.create({
        comprobante_id: comprobante.id,
        numero: "001",
        importe: totales.total,
        fecha_vencimiento: d.fecha_vencimiento,
        estado: "P",
      }, { transaction });
    }

    // Stock: una venta descuenta; una NC no lo devuelve automáticamente
    // (la devolución física se registra aparte).
    if (d.tipo_comprobante_id !== "07") {
      for (const it of d.items.filter((x) => x.producto_id)) {
        await Producto.decrement("stock", {
          by: it.cantidad,
          where: { id: it.producto_id, es_servicio: false },
          transaction,
        });
      }
    }

    return comprobante.id;
  });

  // ── Fuera de la transacción: firma y cola SUNAT ──────────────────────────
  const comprobante = await Comprobante.findByPk(id, { include: INCLUDE_XML });
  try {
    const nombreXml = await generarYFirmarXml(comprobante);
    const job = await encolarEnvio(id, nombreXml);
    return { comprobante, firmado: true, job_id: job.id };
  } catch (err) {
    console.error(`[Emision] Comprobante ${id} creado pero no firmado/encolado:`, err.message);
    return { comprobante, firmado: false, error_firma: "No se pudo firmar o encolar el comprobante. Reintente con Reenviar." };
  }
}

module.exports = { emitir, BOLETA_MONTO_SIN_DOC };
