"use strict";
/**
 * BITÁCORA DE AUDITORÍA
 *
 * registrar(req, accion, { entidad, entidad_id, antes, despues, usuario, transaction })
 *
 * - Con transaction: el registro es parte de la operación (si falla, falla todo).
 * - Sin transaction: "mejor esfuerzo"; un fallo de la bitácora se registra en
 *   el log pero no tumba la operación ya hecha (p. ej. un login correcto).
 *
 * Nunca se guardan contraseñas, hashes ni tokens: `limpiar` los elimina de
 * antes/despues por nombre de campo.
 */
const AuditLog = require("../../infrastructure/database/models/auth/auditLog");

const CAMPOS_SECRETOS = /pass|token|secret|hash|clave|certificado|client_secret/i;

function limpiar(obj) {
  if (obj == null) return null;
  const plano = typeof obj.toJSON === "function" ? obj.toJSON() : obj;
  if (typeof plano !== "object") return plano;
  return JSON.parse(JSON.stringify(plano, (k, v) => (k && CAMPOS_SECRETOS.test(k) ? undefined : v)));
}

const recortar = (s, n) => (s == null ? null : String(s).slice(0, n));

async function registrar(req, accion, datos = {}) {
  const { entidad, entidad_id, antes, despues, usuario, transaction } = datos;
  const actor = usuario || req?.user || null;
  const fila = {
    usuario_id: actor?.id ?? null,
    usuario: recortar(actor?.usuario, 255),
    accion: recortar(accion, 60),
    entidad: recortar(entidad, 60),
    entidad_id: recortar(entidad_id, 60),
    antes: limpiar(antes),
    despues: limpiar(despues),
    ip: recortar(req?.ip, 64),
    user_agent: recortar(req?.get?.("user-agent"), 255),
  };
  if (transaction) return AuditLog.create(fila, { transaction });
  try {
    return await AuditLog.create(fila);
  } catch (err) {
    console.error(`[Auditoria] no se pudo registrar "${accion}":`, err.message);
    return null;
  }
}

module.exports = { registrar, limpiar };
