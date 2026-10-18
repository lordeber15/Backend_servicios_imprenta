/**
 * Valida req.body con un esquema zod y lo reemplaza por el resultado limpio.
 * @param {import('zod').ZodType} schema
 */
const { ValidationError } = require("../../utils/errors");
const { mensajeError } = require("../../../application/validation/emision.schema");

const validar = (schema) => (req, _res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(new ValidationError(mensajeError(r.error)));
  req.body = r.data;
  return next();
};

module.exports = validar;
