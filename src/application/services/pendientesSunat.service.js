"use strict";
/**
 * RESUMEN DE LO QUE FALTA RESOLVER CON SUNAT (dashboard y /sunat/pendientes)
 *
 * - pendientes: comprobantes aún no aceptados ni rechazados, con los días que
 *   les quedan de plazo (0 = vence hoy).
 * - rechazados: RECHAZADO de los últimos 30 días (corregir y reenviar o anular).
 * - fuera_plazo: perdidos por plazo en los últimos 30 días.
 * - bajas, guías, worker (latido), última pasada del vigilante y certificado.
 */
const { Op } = require("sequelize");
const Comprobante = require("../../infrastructure/database/models/facturacion/comprobante");
const ComunicacionBaja = require("../../infrastructure/database/models/facturacion/comunicacionbaja");
const GuiaRemision = require("../../infrastructure/database/models/facturacion/guiaremision");
const redis = require("../../infrastructure/config/redis");
const { diasRestantes, fechaLimite, sumarDias } = require("../plazosSunat");
const { estadoCertificado } = require("./certificado.service");
const { hoyLocal } = require("../../infrastructure/utils/fecha");

const NO_RESUELTOS = ["GENERADO", "FIRMADO", "ENVIANDO", "ERROR_RED", "SIN_CDR"];
const CLAVE_LATIDO = "imprenta:worker:latido";
const CLAVE_RESULTADO = "imprenta:vigilante:ultimo";

/** Redis con tope de tiempo (la conexión de BullMQ reintenta sin fin si Redis cae). */
const conTimeout = (promesa, ms = 1500) =>
  Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function estadoWorker() {
  try {
    const [latido, ultimo] = await conTimeout(Promise.all([redis.get(CLAVE_LATIDO), redis.get(CLAVE_RESULTADO)]));
    const hace = latido ? Math.round((Date.now() - Number(latido)) / 1000) : null;
    const v = ultimo ? JSON.parse(ultimo) : null;
    return {
      worker: { activo: hace !== null && hace < 120, ultimo_latido_seg: hace },
      vigilante: v && {
        ultima_revision: v.fin, reencolados: v.reencolados.length, fuera_plazo: v.fuera_plazo.length,
        sin_reintento: v.sin_reintento, errores: v.errores.length,
      },
    };
  } catch {
    return { worker: { activo: false, ultimo_latido_seg: null, error: "Redis no responde" }, vigilante: null };
  }
}

async function pendientesSunat() {
  const hoy = hoyLocal();
  const hace30 = sumarDias(hoy, -30);
  const atr = ["id", "tipo_comprobante_id", "serie", "correlativo", "fecha_emision", "estado_sunat", "total", "mensaje_sunat"];

  const [pendientes, rechazados, fueraPlazo, bajas, guias, w] = await Promise.all([
    Comprobante.findAll({ where: { estado_sunat: NO_RESUELTOS }, attributes: atr, order: [["fecha_emision", "ASC"], ["id", "ASC"]], limit: 200 }),
    Comprobante.findAll({ where: { estado_sunat: "RECHAZADO", fecha_emision: { [Op.gte]: hace30 } }, attributes: atr, order: [["id", "DESC"]], limit: 50 }),
    Comprobante.count({ where: { estado_sunat: "FUERA_PLAZO", fecha_emision: { [Op.gte]: hace30 } } }),
    ComunicacionBaja.count({ where: { estado_ticket: ["PE", "ER"] } }),
    GuiaRemision.findAll({ where: { estado_sunat: ["EN", "RR", "PE"], fecha_emision: { [Op.gte]: hace30 } }, attributes: ["estado_sunat"], raw: true }),
    estadoWorker(),
  ]);

  const item = (c) => ({
    id: c.id,
    numero: `${c.serie}-${String(c.correlativo).padStart(8, "0")}`,
    tipo: c.tipo_comprobante_id,
    estado: c.estado_sunat,
    total: Number(c.total),
    fecha_emision: new Date(c.fecha_emision).toISOString().slice(0, 10),
    fecha_limite: fechaLimite(c.fecha_emision, c.tipo_comprobante_id, c.serie),
    dias_restantes: diasRestantes(c.fecha_emision, c.tipo_comprobante_id, c.serie, hoy),
    mensaje: c.mensaje_sunat ? String(c.mensaje_sunat).slice(0, 200) : null,
  });
  const lista = pendientes.map(item);
  const porEstado = {};
  for (const p of lista) porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;

  return {
    fecha: hoy,
    pendientes: { total: lista.length, por_estado: porEstado, vencen_hoy: lista.filter((p) => p.dias_restantes <= 0).length, items: lista.slice(0, 50) },
    rechazados: { total: rechazados.length, items: rechazados.map(item).slice(0, 20) },
    fuera_plazo_30_dias: fueraPlazo,
    bajas_pendientes: bajas,
    guias: {
      en_proceso: guias.filter((g) => g.estado_sunat === "EN").length,
      rechazadas: guias.filter((g) => g.estado_sunat === "RR").length,
      sin_enviar: guias.filter((g) => g.estado_sunat === "PE").length,
    },
    ...w,
    certificado: estadoCertificado(),
  };
}

module.exports = { pendientesSunat, estadoWorker, conTimeout };
