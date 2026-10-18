"use strict";
/**
 * CREDENCIALES SUNAT DEL EMISOR (clave SOL, client_secret)
 *
 * Único punto que lee o escribe los secretos. Se guardan cifrados
 * (utils/cifrado.js) en "EmisorCredenciales" y solo se descifran en el
 * instante de autenticarse ante SUNAT (sunatClient / sunatRestClient).
 * La API nunca los devuelve: solo informa si están configurados.
 */
const EmisorCredencial = require("../../infrastructure/database/models/facturacion/emisorCredencial");
const { cifrar, descifrar } = require("../../infrastructure/utils/cifrado");

const CAMPOS = { clave_sol: "clave_sol_cifrada", client_secret: "client_secret_cifrado" };
const contexto = (emisorId, campo) => `emisor:${emisorId}:${campo}`;

/** @returns {Promise<{clave_sol: string|null, client_secret: string|null}>} en claro */
async function obtener(emisorId) {
  const fila = await EmisorCredencial.findByPk(emisorId);
  const r = {};
  for (const [campo, columna] of Object.entries(CAMPOS)) {
    r[campo] = fila?.[columna] ? descifrar(fila[columna], contexto(emisorId, campo)) : null;
  }
  return r;
}

/**
 * Guarda los secretos indicados. undefined o "" = no cambiar; null = borrar.
 * @param {number} emisorId
 * @param {{clave_sol?: string|null, client_secret?: string|null}} datos
 */
async function guardar(emisorId, datos, transaction) {
  const cambios = {};
  for (const [campo, columna] of Object.entries(CAMPOS)) {
    const v = datos[campo];
    if (v === undefined || v === "") continue;
    cambios[columna] = v === null ? null : cifrar(v, contexto(emisorId, campo));
  }
  if (!Object.keys(cambios).length) return false;
  const [fila] = await EmisorCredencial.findOrCreate({ where: { emisor_id: emisorId }, defaults: {}, transaction });
  await fila.update({ ...cambios, updated_at: new Date() }, { transaction });
  return true;
}

/** { [emisorId]: { tiene_clave_sol, tiene_client_secret } } para mostrar en la UI. */
async function estados(emisorIds) {
  const filas = await EmisorCredencial.findAll({ where: { emisor_id: emisorIds } });
  const r = Object.fromEntries(emisorIds.map((id) => [id, { tiene_clave_sol: false, tiene_client_secret: false }]));
  for (const f of filas) {
    r[f.emisor_id] = { tiene_clave_sol: Boolean(f.clave_sol_cifrada), tiene_client_secret: Boolean(f.client_secret_cifrado) };
  }
  return r;
}

module.exports = { obtener, guardar, estados, CAMPOS_SECRETOS: Object.keys(CAMPOS) };
