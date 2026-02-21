const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Logo fallback (se carga una sola vez al iniciar)
let defaultLogoBase64 = "";
try {
  const logoPath = path.resolve(__dirname, "../../../../../ordenServicio/src/assets/ALEXANDER.webp");
  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath);
    defaultLogoBase64 = `data:image/webp;base64,${buf.toString("base64")}`;
    console.log("✅ Logo cotización cargado correctamente");
  }
} catch (_) { /* logo no disponible */
  console.log("⚠️ Logo no encontrado en:", path.resolve(__dirname, "../../../../../ordenServicio/src/assets/ALEXANDER.webp"));
}

function getLogoBase64(emisor) {
  if (emisor?.logo_url) {
    try {
      const logoPath = path.resolve(__dirname, "../..", emisor.logo_url.replace(/^\//, ""));
      if (fs.existsSync(logoPath)) {
        const ext = path.extname(logoPath).slice(1) || "png";
        const buf = fs.readFileSync(logoPath);
        return `data:image/${ext};base64,${buf.toString("base64")}`;
      }
    } catch (_) { /* fallback */ }
  }
  return defaultLogoBase64;
}

function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatFecha(fecha) {
  if (!fecha) return "";
  return new Date(fecha).toLocaleDateString("es-PE");
}

// ─── Template A5 ────────────────────────────────────────────────────────────

function buildA5Html(cotizacion, detalles, emisor) {
  const logo = getLogoBase64(emisor);
  const nombre = escHtml(emisor?.nombre_comercial || emisor?.razon_social || "IMPRENTA ALEXANDER");
  const ruc = escHtml(emisor?.ruc || "20608582011");
  const desc = escHtml(emisor?.descripcion || "");
  const dir = escHtml(emisor?.direccion || "");
  const tel = escHtml(emisor?.telefono || "");

  const filas = detalles
    .map((d, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f0f9ff"}">
        <td style="padding:4px 6px">${i + 1}</td>
        <td style="padding:4px 6px">${escHtml(d.descripcion)}</td>
        <td style="padding:4px 6px;text-align:center;font-size:10px;text-transform:uppercase">${escHtml(d.unidad || "UND")}</td>
        <td style="padding:4px 6px;text-align:center">${d.cantidad}</td>
        <td style="padding:4px 6px;text-align:right">S/ ${parseFloat(d.precioUnitario).toFixed(2)}</td>
        <td style="padding:4px 6px;text-align:right">S/ ${parseFloat(d.cantidad * d.precioUnitario).toFixed(2)}</td>
      </tr>`)
    .join("");

  const total = parseFloat(cotizacion.precioTotal || 0);
  const opGravada = total / 1.18;
  const igv = total - opGravada;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0c4a6e; color: white; padding: 4px 6px; font-size: 10px; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0369a1;padding-bottom:8px;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px">
      ${logo ? `<img src="${logo}" alt="Logo" style="height:48px">` : ""}
      <div>
        <div style="font-weight:bold;font-size:14px">${nombre}</div>
        ${desc ? `<div style="font-size:10px;color:#555">${desc}</div>` : ""}
        ${dir ? `<div style="font-size:10px">${dir}</div>` : ""}
        ${tel ? `<div style="font-size:10px">Tel: ${tel}</div>` : ""}
      </div>
    </div>
    <div style="border:2px solid #0369a1;padding:8px;text-align:center;min-width:100px">
      <div style="font-weight:bold;font-size:11px">RUC: ${ruc}</div>
      <div style="font-weight:bold;color:#0369a1;margin-top:2px">COTIZACIÓN</div>
      <div style="font-weight:bold;font-size:13px">N° ${String(cotizacion.id).padStart(6, "0")}</div>
      <div>Fecha:</div>
      <div>${formatFecha(cotizacion.fechaEmision)}</div>
    </div>
  </div>

  <div style="background:#f0f9ff;padding:6px 8px;margin-bottom:8px;border-radius:4px">
    <div><strong>Cliente:</strong> ${escHtml(cotizacion.cliente || "Sin nombre")}</div>
    ${cotizacion.tipoDocumento && cotizacion.tipoDocumento !== "Sin Documento" && cotizacion.numeroDocumento ? `<div><strong>${escHtml(cotizacion.tipoDocumento)}:</strong> ${escHtml(cotizacion.numeroDocumento)}</div>` : ""}
    ${cotizacion.direccion ? `<div><strong>Dirección:</strong> ${escHtml(cotizacion.direccion)}</div>` : ""}
  </div>

  <table style="margin-bottom:8px">
    <thead>
      <tr>
        <th style="width:5%;text-align:left">#</th>
        <th style="text-align:left">Descripción</th>
        <th style="width:12%;text-align:center">Unidad</th>
        <th style="width:8%;text-align:center">Cant.</th>
        <th style="width:15%;text-align:right">P.Unit.</th>
        <th style="width:15%;text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end">
    <table style="min-width:200px;width:auto">
      <tr><td style="padding:3px 8px">Op. Gravada:</td><td style="padding:3px 8px;text-align:right">S/ ${opGravada.toFixed(2)}</td></tr>
      <tr><td style="padding:3px 8px">IGV (18%):</td><td style="padding:3px 8px;text-align:right">S/ ${igv.toFixed(2)}</td></tr>
      <tr style="background:#0c4a6e;color:white;font-weight:bold">
        <td style="padding:4px 8px">TOTAL:</td>
        <td style="padding:4px 8px;text-align:right">S/ ${total.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  <div style="margin-top:24px;display:flex;justify-content:space-around;text-align:center">
    <div><div style="border-top:1px solid black;padding-top:4px;width:120px">Recibí conforme</div></div>
    <div><div style="border-top:1px solid black;padding-top:4px;width:120px">Firma Autorizada</div></div>
  </div>
</body>
</html>`;
}

// ─── Template A4 ────────────────────────────────────────────────────────────

function buildA4Html(cotizacion, detalles, emisor) {
  const logo = getLogoBase64(emisor);
  const nombre = escHtml(emisor?.nombre_comercial || emisor?.razon_social || "IMPRENTA ALEXANDER");
  const ruc = escHtml(emisor?.ruc || "20608582011");
  const desc = escHtml(emisor?.descripcion || "");
  const dir = escHtml(emisor?.direccion || "");
  const tel = escHtml(emisor?.telefono || "");

  const filas = detalles
    .map((d, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f0f9ff"}">
        <td style="padding:6px 10px">${i + 1}</td>
        <td style="padding:6px 10px">${escHtml(d.descripcion)}</td>
        <td style="padding:6px 10px;text-align:center;font-size:11px;text-transform:uppercase">${escHtml(d.unidad || "UND")}</td>
        <td style="padding:6px 10px;text-align:center">${d.cantidad}</td>
        <td style="padding:6px 10px;text-align:right">S/ ${parseFloat(d.precioUnitario).toFixed(2)}</td>
        <td style="padding:6px 10px;text-align:right">S/ ${parseFloat(d.cantidad * d.precioUnitario).toFixed(2)}</td>
      </tr>`)
    .join("");

  const total = parseFloat(cotizacion.precioTotal || 0);
  const opGravada = total / 1.18;
  const igv = total - opGravada;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0c4a6e; color: white; padding: 6px 10px; font-size: 11px; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0369a1;padding-bottom:12px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:12px">
      ${logo ? `<img src="${logo}" alt="Logo" style="height:60px">` : ""}
      <div>
        <div style="font-weight:bold;font-size:18px">${nombre}</div>
        ${desc ? `<div style="font-size:11px;color:#555">${desc}</div>` : ""}
        ${dir ? `<div style="font-size:11px">${dir}</div>` : ""}
        ${tel ? `<div style="font-size:11px">Tel: ${tel}</div>` : ""}
      </div>
    </div>
    <div style="border:2px solid #0369a1;padding:12px 16px;text-align:center;min-width:140px;border-radius:4px">
      <div style="font-weight:bold;font-size:12px">RUC: ${ruc}</div>
      <div style="font-weight:bold;font-size:14px;color:#0369a1;margin-top:4px">COTIZACIÓN</div>
      <div style="font-weight:bold;font-size:16px">N° ${String(cotizacion.id).padStart(6, "0")}</div>
      <div style="margin-top:4px">Fecha:</div>
      <div>${formatFecha(cotizacion.fechaEmision)}</div>
    </div>
  </div>

  <div style="background:#f0f9ff;padding:10px 14px;margin-bottom:14px;border-radius:6px;border:1px solid #bae6fd">
    <div style="margin-bottom:2px"><strong>Cliente:</strong> ${escHtml(cotizacion.cliente || "Sin nombre")}</div>
    ${cotizacion.tipoDocumento && cotizacion.tipoDocumento !== "Sin Documento" && cotizacion.numeroDocumento ? `<div style="margin-bottom:2px"><strong>${escHtml(cotizacion.tipoDocumento)}:</strong> ${escHtml(cotizacion.numeroDocumento)}</div>` : ""}
    ${cotizacion.direccion ? `<div><strong>Dirección:</strong> ${escHtml(cotizacion.direccion)}</div>` : ""}
  </div>

  <table style="margin-bottom:14px">
    <thead>
      <tr>
        <th style="width:5%;text-align:left">#</th>
        <th style="text-align:left">Descripción</th>
        <th style="width:10%;text-align:center">Unidad</th>
        <th style="width:8%;text-align:center">Cant.</th>
        <th style="width:12%;text-align:right">P.Unit.</th>
        <th style="width:12%;text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end">
    <table style="min-width:240px;width:auto">
      <tr><td style="padding:4px 10px">Op. Gravada:</td><td style="padding:4px 10px;text-align:right">S/ ${opGravada.toFixed(2)}</td></tr>
      <tr><td style="padding:4px 10px">IGV (18%):</td><td style="padding:4px 10px;text-align:right">S/ ${igv.toFixed(2)}</td></tr>
      <tr style="background:#0c4a6e;color:white;font-weight:bold;font-size:14px">
        <td style="padding:6px 10px">TOTAL:</td>
        <td style="padding:6px 10px;text-align:right">S/ ${total.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  <div style="margin-top:40px;display:flex;justify-content:space-around;text-align:center">
    <div><div style="border-top:1px solid black;padding-top:6px;width:160px;font-size:11px">Recibí conforme</div></div>
    <div><div style="border-top:1px solid black;padding-top:6px;width:160px;font-size:11px">Firma Autorizada</div></div>
  </div>
</body>
</html>`;
}

// ─── Generador principal ─────────────────────────────────────────────────────

async function generarCotizacionPdf(cotizacion, detalles, format, emisor) {
  const html = format === "a4"
    ? buildA4Html(cotizacion, detalles, emisor)
    : buildA5Html(cotizacion, detalles, emisor);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfOptions = format === "a4"
      ? { format: "A4", printBackground: true, margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" } }
      : { format: "A5", printBackground: true, margin: { top: "12mm", right: "15mm", bottom: "12mm", left: "15mm" } };

    return Buffer.from(await page.pdf(pdfOptions));
  } finally {
    await browser.close();
  }
}

module.exports = { generarCotizacionPdf };
