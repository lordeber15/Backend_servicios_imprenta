/**
 * LISTA BLANCA DE CAMPOS (contra mass assignment en los CRUD de catálogos)
 *
 * Los controladores de catálogos hacen Model.create({ ...req.body }). Este
 * middleware rechaza con 400 cualquier campo que no sea una columna del
 * modelo o que esté protegido (id, timestamps y los que se indiquen), así
 * que nadie puede fijar columnas que la pantalla no expone. El tipo y el
 * largo los valida después Sequelize (SequelizeValidationError → 400).
 *
 * @param {import('sequelize').ModelStatic} Model
 * @param {{ excluir?: string[] }} [opciones]  campos que no se aceptan del cliente
 */
const { ValidationError } = require("../../utils/errors");

const SIEMPRE = ["createdAt", "updatedAt", "created_at", "updated_at"];

function soloCampos(Model, { excluir = [] } = {}) {
  return (req, _res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return next(new ValidationError("Se esperaba un objeto JSON"));
    }
    const columnas = new Set(Object.keys(Model.rawAttributes));
    // id: en creación se acepta solo si la PK no es autoincremental (catálogos SUNAT con código propio).
    const pkAuto = Model.rawAttributes.id?.autoIncrement;
    const prohibidos = new Set([...SIEMPRE, ...excluir, ...(pkAuto || req.method !== "POST" ? ["id"] : [])]);
    const invalidos = Object.keys(body).filter((k) => !columnas.has(k) || prohibidos.has(k));
    if (invalidos.length) return next(new ValidationError(`Campos no permitidos: ${invalidos.join(", ")}`));
    return next();
  };
}

module.exports = soloCampos;
