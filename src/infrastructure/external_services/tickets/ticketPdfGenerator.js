const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Logo fallback (se carga una sola vez al iniciar)
let defaultLogoBase64 = "";
try {
  const logoPath = path.resolve(__dirname, "../../../../ordenServicio/src/assets/ALEXANDER.webp");
  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath);
    defaultLogoBase64 = `data:image/webp;base64,${buf.toString("base64")}`;
  }
} catch (_) { /* logo no disponible */ }

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

// ─── Template 80mm (térmica) ─────────────────────────────────────────────────

function build80mmHtml(ticket, detalles, emisor) {
  const logo = getLogoBase64(emisor);
  const nombre = escHtml(emisor?.nombre_comercial || emisor?.razon_social || "IMPRENTA ALEXANDER");
  const ruc = escHtml(emisor?.ruc || "20608582011");
  const desc = escHtml(emisor?.descripcion || "");
  const dir = escHtml(emisor?.direccion || "");
  const tel = escHtml(emisor?.telefono || "");

  const filas = detalles
    .map((d) => `
      <div class="item">
        <div class="item-desc">${escHtml(d.descripcion)}${d._unidad ? ` (${escHtml(d._unidad)})` : ""}</div>
        <div class="item-row">
          <span></span>
          <span class="right">${d.cantidad}</span>
          <span class="right">S/ ${parseFloat(d.subtotal).toFixed(2)}</span>
        </div>
      </div>`)
    .join("");

  const total = parseFloat(ticket.precioTotal || 0);
  const opGravada = total / 1.18;
  const igv = total - opGravada;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Courier New", monospace; font-size: 11px; width: 72mm; padding: 3mm 2mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .sep { text-align: center; color: #888; margin: 2px 0; }
  .item-row { display: flex; justify-content: space-between; }
  .item-desc { word-break: break-word; }
  .right { text-align: right; }
  .total-row { display: flex; justify-content: space-between; }
  .total-row.big { font-weight: bold; font-size: 13px; }
  .footer { font-size: 10px; text-align: center; margin-top: 4px; }
</style>
</head>
<body>
  ${logo ? `<div class="center" style="margin-bottom:4px"><img src="${logo}" alt="Logo" style="height:40px"></div>` : ""}
  <div class="center bold" style="font-size:13px">${nombre}</div>
  ${desc ? `<div class="center" style="font-size:10px">${desc}</div>` : ""}
  <div class="center">RUC: ${ruc}</div>
  ${dir ? `<div class="center">${dir}</div>` : ""}
  ${tel ? `<div class="center">Tel: ${tel}</div>` : ""}
  <div class="sep">─────────────────────────────────</div>
  <div class="center bold">TICKET N° ${String(ticket.id).padStart(6, "0")}</div>
  <div>Fecha: ${formatFecha(ticket.fechaEmision)}</div>
  <div class="sep">─────────────────────────────────</div>
  <div>Cliente: ${escHtml(ticket.cliente || "Sin nombre")}</div>
  ${ticket.tipoDocumento && ticket.tipoDocumento !== "Sin Documento" && ticket.numeroDocumento ? `<div>${escHtml(ticket.tipoDocumento)}: ${escHtml(ticket.numeroDocumento)}</div>` : ""}
  ${ticket.direccion ? `<div>Dir: ${escHtml(ticket.direccion)}</div>` : ""}
  <div class="sep">─────────────────────────────────</div>
  <div class="item-row bold">
    <span style="width:50%">Descripción</span>
    <span style="width:15%;text-align:right">Cant</span>
    <span style="width:35%;text-align:right">Total</span>
  </div>
  <div class="sep">─────────────────────────────────</div>
  ${filas}
  <div class="sep">─────────────────────────────────</div>
  <div class="total-row"><span>Op. Gravada:</span><span>S/ ${opGravada.toFixed(2)}</span></div>
  <div class="total-row"><span>IGV (18%):</span><span>S/ ${igv.toFixed(2)}</span></div>
  <div class="total-row big"><span>TOTAL:</span><span>S/ ${total.toFixed(2)}</span></div>
  <div class="sep">─────────────────────────────────</div>
  <div class="footer">¡Gracias por su preferencia!</div>
  <div class="footer">Conserve este comprobante</div>
</body>
</html>`;
}

// ─── Template A5 (profesional) ───────────────────────────────────────────────

function buildA5Html(ticket, detalles, emisor) {
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
        <td style="padding:4px 6px;text-align:center;font-size:10px;text-transform:uppercase">${escHtml(d._unidad || "—")}</td>
        <td style="padding:4px 6px;text-align:center">${d.cantidad}</td>
        <td style="padding:4px 6px;text-align:right">S/ ${parseFloat(d.precioUnitario).toFixed(2)}</td>
        <td style="padding:4px 6px;text-align:right">S/ ${parseFloat(d.subtotal).toFixed(2)}</td>
      </tr>`)
    .join("");

  const total = parseFloat(ticket.precioTotal || 0);
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
    ${logo ? `<img src="${logo}" alt="Logo" style="height:48px">` : "<div></div>"}
    <div style="text-align:center">
      <div style="font-weight:bold;font-size:14px">${nombre}</div>
      ${desc ? `<div style="font-size:10px;color:#555">${desc}</div>` : ""}
      <div>RUC: ${ruc}</div>
      ${dir ? `<div>${dir}</div>` : ""}
      ${tel ? `<div>Tel: ${tel}</div>` : ""}
    </div>
    <div style="border:2px solid #0369a1;padding:8px;text-align:center;min-width:100px">
      <div style="font-weight:bold">TICKET</div>
      <div style="font-weight:bold;font-size:13px">N° ${String(ticket.id).padStart(6, "0")}</div>
      <div>Fecha:</div>
      <div>${formatFecha(ticket.fechaEmision)}</div>
    </div>
  </div>

  <div style="background:#f0f9ff;padding:6px 8px;margin-bottom:8px;border-radius:4px">
    <div><strong>Cliente:</strong> ${escHtml(ticket.cliente || "Sin nombre")}</div>
    ${ticket.tipoDocumento && ticket.tipoDocumento !== "Sin Documento" && ticket.numeroDocumento ? `<div><strong>${escHtml(ticket.tipoDocumento)}:</strong> ${escHtml(ticket.numeroDocumento)}</div>` : ""}
    ${ticket.direccion ? `<div><strong>Dirección:</strong> ${escHtml(ticket.direccion)}</div>` : ""}
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

// ─── Generador principal ─────────────────────────────────────────────────────

async function generarTicketPdf(ticket, detalles, format, emisor) {
  const html = format === "a5"
    ? buildA5Html(ticket, detalles, emisor)
    : build80mmHtml(ticket, detalles, emisor);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    let pdfOptions;
    if (format === "a5") {
      pdfOptions = {
        format: "A5",
        printBackground: true,
        margin: { top: "12mm", right: "15mm", bottom: "12mm", left: "15mm" },
      };
    } else {
      pdfOptions = {
        width: "72mm",
        printBackground: true,
        margin: { top: "3mm", right: "0mm", bottom: "3mm", left: "0mm" },
      };
    }

    return Buffer.from(await page.pdf(pdfOptions));
  } finally {
    await browser.close();
  }
}

module.exports = { generarTicketPdf };
