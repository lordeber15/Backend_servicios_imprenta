"use strict";
/**
 * Hash de contraseñas con bcrypt (cost 12).
 *
 * verificar() compara siempre contra un hash, aunque el usuario no exista
 * (HASH_FICTICIO): así el tiempo de respuesta no revela qué usuarios existen.
 */
const bcrypt = require("bcryptjs");

const COST = 12;
let HASH_FICTICIO = null;

const hashear = (plano) => bcrypt.hash(plano, COST);

async function verificar(plano, hash) {
  HASH_FICTICIO ??= await bcrypt.hash("contraseña-inexistente-para-igualar-tiempos", COST);
  const ok = await bcrypt.compare(plano, hash || HASH_FICTICIO);
  return Boolean(hash) && ok;
}

/** true si el hash se generó con un cost menor al actual (se rehace al iniciar sesión). */
const necesitaRehash = (hash) => {
  try { return bcrypt.getRounds(hash) < COST; } catch { return true; }
};

module.exports = { hashear, verificar, necesitaRehash, COST };
