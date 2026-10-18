const sequelize = require("../../../database/database");
const Emisor = require("../../../database/models/facturacion/emisor");
const credenciales = require("../../../../application/services/credenciales.service");
const { registrar } = require("../../../../application/services/auditoria.service");
const { crearEmisorSchema, actualizarEmisorSchema } = require("../../../../application/validation/emisor.schema");
const { mensajeError } = require("../../../../application/validation/emision.schema");
const { ValidationError, NotFoundError } = require("../../../utils/errors");

const SECRETOS = credenciales.CAMPOS_SECRETOS;

/** Separa los secretos (van cifrados a EmisorCredenciales) del resto de campos. */
function separar(datos) {
  const publicos = { ...datos };
  const secretos = {};
  for (const k of SECRETOS) {
    if (k in publicos) secretos[k] = publicos[k];
    delete publicos[k];
  }
  return { publicos, secretos };
}

/** Emisor para el cliente: sin secretos, con indicadores de si están configurados. */
async function conIndicadores(emisores) {
  const lista = [].concat(emisores);
  const estados = await credenciales.estados(lista.map((e) => e.id));
  const r = lista.map((e) => ({ ...e.toJSON(), ...estados[e.id] }));
  return Array.isArray(emisores) ? r : r[0];
}

const getEmisor = async (_req, res, next) => {
  try {
    res.json(await conIndicadores(await Emisor.findAll()));
  } catch (error) {
    return next(error);
  }
};

const createEmisor = async (req, res, next) => {
  try {
    const parsed = crearEmisorSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(mensajeError(parsed.error));
    const { publicos, secretos } = separar(parsed.data);

    const emisor = await sequelize.transaction(async (transaction) => {
      const e = await Emisor.create(publicos, { transaction });
      await credenciales.guardar(e.id, secretos, transaction);
      return e;
    });
    registrar(req, "emisor_creado", {
      entidad: "Emisor",
      entidad_id: emisor.id,
      despues: { ...publicos, secretos_configurados: SECRETOS.filter((k) => secretos[k]) },
    });
    res.json(await conIndicadores(emisor));
  } catch (error) {
    return next(error);
  }
};

const deleteEmisor = async (req, res, next) => {
  try {
    const emisor = await Emisor.findByPk(req.params.id);
    if (!emisor) throw new NotFoundError("Elemento no encontrado");
    await emisor.destroy(); // las credenciales se borran en cascada
    registrar(req, "emisor_eliminado", { entidad: "Emisor", entidad_id: emisor.id, antes: emisor });
    res.json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const updateEmisor = async (req, res, next) => {
  try {
    const parsed = actualizarEmisorSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(mensajeError(parsed.error));
    const { publicos, secretos } = separar(parsed.data);

    const emisor = await Emisor.findByPk(req.params.id);
    if (!emisor) throw new NotFoundError("Elemento no encontrado");
    const antes = emisor.toJSON();

    const secretosCambiados = await sequelize.transaction(async (transaction) => {
      await emisor.update(publicos, { transaction });
      return credenciales.guardar(emisor.id, secretos, transaction);
    });
    registrar(req, "emisor_actualizado", {
      entidad: "Emisor",
      entidad_id: emisor.id,
      antes,
      despues: { ...emisor.toJSON(), secretos_cambiados: secretosCambiados ? SECRETOS.filter((k) => secretos[k]) : [] },
    });
    res.json(await conIndicadores(emisor));
  } catch (error) {
    return next(error);
  }
};

/** PUT /emisor/:id/logo — tras subirImagen (req.imagen). */
const updateLogo = async (req, res, next) => {
  try {
    const emisor = await Emisor.findByPk(req.params.id);
    if (!emisor) throw new NotFoundError("Emisor no encontrado");
    const antes = emisor.logo_url;
    await emisor.update({ logo_url: req.imagen.url });
    registrar(req, "emisor_logo", { entidad: "Emisor", entidad_id: emisor.id, antes: { logo_url: antes }, despues: { logo_url: emisor.logo_url } });
    res.json({ message: "Logo actualizado", logo_url: emisor.logo_url });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getEmisor, createEmisor, deleteEmisor, updateEmisor, updateLogo };
