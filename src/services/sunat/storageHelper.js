/**
 * AYUDANTE DE ALMACENAMIENTO (STORAGE)
 * 
 * Provee funciones de utilidad para organizar y acceder a los archivos generados
 * (XML firmados, CDRs de respuesta y PDFs de representación impresa).
 * 
 * @module services/sunat/storageHelper
 */
const fs = require("fs");
const path = require("path");

function getBasePath() {
  const base = process.env.SUNAT_STORAGE_PATH || "./storage";
  return path.isAbsolute(base)
    ? base
    : path.join(process.cwd(), base);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getXmlPath(nombreArchivo) {
  return path.join(getBasePath(), "xml", nombreArchivo + ".xml");
}

function getPdfPath(nombreArchivo) {
  return path.join(getBasePath(), "pdf", nombreArchivo + ".pdf");
}

function getCdrPath(nombreArchivo) {
  return path.join(getBasePath(), "cdr", "R-" + nombreArchivo + ".zip");
}

function saveXml(nombreArchivo, xmlContent) {
  const dir = path.join(getBasePath(), "xml");
  ensureDir(dir);
  fs.writeFileSync(getXmlPath(nombreArchivo), xmlContent, "utf8");
}

function saveCdr(nombreArchivo, cdrBase64) {
  const dir = path.join(getBasePath(), "cdr");
  ensureDir(dir);
  const buffer = Buffer.from(cdrBase64, "base64");
  fs.writeFileSync(getCdrPath(nombreArchivo), buffer);
}

function readXml(nombreArchivo) {
  return fs.readFileSync(getXmlPath(nombreArchivo), "utf8");
}

function existsXml(nombreArchivo) {
  return fs.existsSync(getXmlPath(nombreArchivo));
}

function existsPdf(nombreArchivo) {
  return fs.existsSync(getPdfPath(nombreArchivo));
}

module.exports = {
  getXmlPath,
  getPdfPath,
  getCdrPath,
  saveXml,
  saveCdr,
  readXml,
  existsXml,
  existsPdf,
};
