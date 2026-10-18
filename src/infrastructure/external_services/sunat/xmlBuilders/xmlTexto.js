"use strict";
/**
 * TEXTO SEGURO DENTRO DEL XML UBL (antes de firmar)
 *
 * Descripciones, razones sociales, direcciones, placas… los escribe el
 * usuario. Interpolados tal cual, un "]]>" cierra el CDATA y un "<" abre un
 * elemento: el XML queda inválido (SUNAT lo rechaza) o, peor, se inyectan
 * elementos dentro del documento que luego se firma.
 */

/** Escapa para contenido de elemento o atributo. */
function esc(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Bloque CDATA que no se puede cerrar desde el contenido: cada "]]>" se parte
 * en dos secciones CDATA ("]]" + ">"), que es la forma estándar de incluirlo.
 * También elimina los caracteres de control que XML 1.0 prohíbe.
 */
function cdata(valor) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  // eslint-disable-next-line no-control-regex
  const limpio = texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return `<![CDATA[${limpio.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

module.exports = { esc, cdata };
