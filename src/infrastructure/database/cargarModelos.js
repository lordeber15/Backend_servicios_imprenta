/**
 * Carga todos los modelos Sequelize y sus asociaciones sin arrancar la app
 * (sin Express, Redis ni Swagger). Lo usa el generador del baseline.
 */
const fs = require("fs");
const path = require("path");

const DIR_MODELOS = path.join(__dirname, "models");

function archivosJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return archivosJs(ruta);
    return e.name.endsWith(".js") ? [ruta] : [];
  });
}

function cargarModelos() {
  // Orden alfabético estable; asociation.js requiere los modelos que relaciona.
  for (const archivo of archivosJs(DIR_MODELOS).sort()) require(archivo);
}

module.exports = cargarModelos;
