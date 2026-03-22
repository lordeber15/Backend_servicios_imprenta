/**
 * GENERADOR DE PDF (REPRESENTACIÓN IMPRESA)
 *
 * Este módulo utiliza Puppeteer para convertir una plantilla HTML dinámica en un
 * archivo PDF profesional que sirve como representación impresa del comprobante.
 *
 * @module services/sunat/pdfGenerator
 */

const { getBrowser } = require("../browserPool");
const fs = require("fs");
const path = require("path");

// Logo fallback (se carga una sola vez al iniciar)
let defaultLogoBase64 = "";
try {
  // __dirname está en: src/infrastructure/external_services/sunat/
  // Subir 4 niveles para llegar a la raíz del proyecto backend
  const projectRoot = path.resolve(__dirname, "../../../..");
  const logoPath = path.join(projectRoot, "ordenServicio", "src", "assets", "ALEXANDER.webp");

  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath);
    defaultLogoBase64 = `data:image/webp;base64,${buf.toString("base64")}`;
  } else {
    console.warn(`Logo fallback no encontrado en: ${logoPath}`);
  }
} catch (error) {
  console.error("Error cargando logo fallback:", error);
}

function getLogoBase64(emisor) {
  if (emisor?.logo_url) {
    try {
      // __dirname está en: src/infrastructure/external_services/sunat/
      // Subir 3 niveles para llegar a src/
      const projectRoot = path.resolve(__dirname, "../../..");

      // emisor.logo_url viene como "/uploads/empresa/logo.png"
      const relativePath = emisor.logo_url.replace(/^\//, "");

      // Combinar: src/uploads/empresa/logo.png
      const logoPath = path.join(projectRoot, relativePath);

      if (fs.existsSync(logoPath)) {
        const ext = path.extname(logoPath).slice(1) || "png";
        const buf = fs.readFileSync(logoPath);
        return `data:image/${ext};base64,${buf.toString("base64")}`;
      } else {
        console.warn(`Logo no encontrado en: ${logoPath}`);
      }
    } catch (error) {
      console.error("Error cargando logo del emisor:", error);
    }
  }
  return defaultLogoBase64; // Retornar logo fallback en lugar de cadena vacía
}

/**
 * Genera la representación impresa (PDF) del comprobante electrónico.
 *
 * @param {object} comprobante  Instancia de Comprobante con includes cargados
 * @param {string} qrBase64    Data URL del QR generado por qrGenerator
 * @param {string} format      "a4" | "a5" | "ticket" (default: "a4")
 * @returns {Promise<Buffer>}  Buffer del PDF generado
 */
async function generarPdf(comprobante, qrBase64, format = "a4") {
  let html;
  if (format === "ticket") {
    html = buildTicketHtml(comprobante, qrBase64);
  } else if (format === "a5") {
    html = buildA5Html(comprobante, qrBase64);
  } else {
    html = buildHtml(comprobante, qrBase64);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    let pdfOptions;
    if (format === "ticket") {
      pdfOptions = {
        width: "72mm",
        printBackground: true,
        margin: { top: "3mm", right: "0mm", bottom: "3mm", left: "0mm" },
      };
    } else if (format === "a5") {
      pdfOptions = {
        format: "A5",
        printBackground: true,
        margin: { top: "12mm", right: "15mm", bottom: "12mm", left: "15mm" },
      };
    } else {
      pdfOptions = {
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      };
    }

    return Buffer.from(await page.pdf(pdfOptions));
  } finally {
    await page.close();
  }
}

function buildHtml(c, qrBase64) {
  const emisor = c.Emisor || {};
  const cliente = c.Cliente || {};
  const detalles = c.Detalles || [];
  const logo = getLogoBase64(emisor);
  const tipo = c.TipoComprobante
    ? c.TipoComprobante.descripcion
    : tipoDescripcion(c.tipo_comprobante_id);
  const correlativoStr = String(c.correlativo).padStart(8, "0");
  const serieCorrelativo = `${c.serie}-${correlativoStr}`;

  const filas = detalles
    .map((d) => {
      const nombre = d.Producto ? d.Producto.nombre : "-";
      const unidad = d.Producto && d.Producto.Unidad ? d.Producto.Unidad.id : "NIU";
      return `<tr>
        <td style="text-align:center">${d.item}</td>
        <td style="text-align:center">${parseFloat(d.cantidad).toFixed(2)}</td>
        <td style="text-align:center">${unidad}</td>
        <td>${escHtml(nombre)}</td>
        <td style="text-align:right">${parseFloat(d.valor_unitario).toFixed(2)}</td>
        <td style="text-align:right">${parseFloat(d.valor_total).toFixed(2)}</td>
        <td style="text-align:right">${parseFloat(d.importe_total).toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  const moneda = c.moneda_id === "USD" ? "USD" : "PEN";
  const simbolo = moneda === "USD" ? "$" : "S/";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #222; }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #0369a1; padding-bottom: 8px; margin-bottom: 8px; }
  .header-left { display: flex; gap: 15px; align-items: flex-start; }
  .logo img { height: 60px; object-fit: contain; }
  .emisor-info h2 { font-size: 13px; color: #0369a1; }
  .doc-box { border: 2px solid #0369a1; padding: 8px 12px; text-align: center;
             min-width: 180px; }
  .doc-box h3 { font-size: 11px; text-transform: uppercase; }
  .doc-box p  { font-size: 13px; font-weight: bold; margin-top: 4px; }
  .cliente-section { background: #f0f9ff; border: 1px solid #bae6fd;
                     padding: 6px 8px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #0369a1; color: white; padding: 4px; font-size: 9px; }
  td { border: 1px solid #ddd; padding: 3px 5px; font-size: 9px; vertical-align: top; }
  .totales { display: flex; justify-content: flex-end; }
  .totales table { width: 260px; }
  .totales td { border: none; }
  .totales .total-row td { font-weight: bold; font-size: 11px;
                            border-top: 2px solid #0369a1; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end;
            margin-top: 12px; border-top: 1px solid #ccc; padding-top: 8px; }
  .qr-section { text-align: center; }
  .qr-section img { width: 90px; height: 90px; }
  .leyenda { font-size: 8px; color: #666; max-width: 300px; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logo ? `<div class="logo"><img src="${logo}" alt="Logo emisor"></div>` : ""}
      <div class="emisor-info">
        <h2>${escHtml(emisor.razon_social || "")}</h2>
        <p>RUC: <strong>${emisor.ruc || ""}</strong></p>
        <p>${escHtml(emisor.direccion || "")}</p>
        ${emisor.distrito ? `<p>${escHtml(emisor.distrito)} - ${escHtml(emisor.provincia)} - ${escHtml(emisor.departamento)}</p>` : ""}
      </div>
    </div>
    <div class="doc-box">
      <h3>${escHtml(tipo)}</h3>
      <p>${serieCorrelativo}</p>
    </div>
  </div>

  <div class="cliente-section">
    <p><strong>Cliente:</strong> ${escHtml(cliente.razon_social || "")}</p>
    <p><strong>Doc:</strong> ${tipoDocLabel(cliente.tipo_documento_id)}: ${cliente.nrodoc || ""}</p>
    ${cliente.direccion ? `<p><strong>Dirección:</strong> ${escHtml(cliente.direccion)}</p>` : ""}
    <p><strong>Fecha emisión:</strong> ${formatFecha(c.fecha_emision)} &nbsp;|&nbsp; <strong>Moneda:</strong> ${moneda} &nbsp;|&nbsp; <strong>Forma de pago:</strong> ${c.forma_pago || ""}</p>
    ${c.comprobanteRef ? `<p><strong>Doc. Referencia:</strong> ${c.comprobanteRef.serie}-${String(c.comprobanteRef.correlativo).padStart(8, '0')}</p>` : ""}
    ${c.descripcion_nota ? `<p><strong>Motivo:</strong> ${escHtml(c.descripcion_nota)}</p>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:4%">Item</th>
        <th style="width:8%">Cant.</th>
        <th style="width:6%">Unid.</th>
        <th>Descripción</th>
        <th style="width:12%">V. Unit. (${simbolo})</th>
        <th style="width:12%">V. Total (${simbolo})</th>
        <th style="width:12%">Imp. Total (${simbolo})</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <div class="totales">
    <table>
      <tr><td>Op. Gravadas:</td><td style="text-align:right">${simbolo} ${parseFloat(c.op_gravadas || 0).toFixed(2)}</td></tr>
      ${c.op_exoneradas > 0 ? `<tr><td>Op. Exoneradas:</td><td style="text-align:right">${simbolo} ${parseFloat(c.op_exoneradas).toFixed(2)}</td></tr>` : ""}
      ${c.op_inafectas > 0 ? `<tr><td>Op. Inafectas:</td><td style="text-align:right">${simbolo} ${parseFloat(c.op_inafectas).toFixed(2)}</td></tr>` : ""}
      <tr><td>IGV (18%):</td><td style="text-align:right">${simbolo} ${parseFloat(c.igv || 0).toFixed(2)}</td></tr>
      <tr class="total-row"><td>TOTAL A PAGAR:</td><td style="text-align:right">${simbolo} ${parseFloat(c.total || 0).toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="footer">
    <div class="leyenda">
      <p>Representación impresa de comprobante electrónico.</p>
      <p>Para consultar el estado del comprobante ingrese a: <strong>https://ww1.sunat.gob.pe/ol-it-wsconsvalidcpe/</strong></p>
      ${c.hash_cpe ? `<p>Hash CPE: ${c.hash_cpe}</p>` : ""}
      ${c.estado_sunat === "AC" ? `<p style="color:green;font-weight:bold;">ACEPTADO POR SUNAT</p>` : ""}
    </div>
    <div class="qr-section">
      ${qrBase64 ? `<img src="${qrBase64}" alt="QR SUNAT">` : ""}
      <p style="font-size:7px;margin-top:4px;">Escanee para verificar</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Template 80mm (térmica) — Comprobante SUNAT ─────────────────────────────

function buildTicketHtml(c, qrBase64) {
  const emisor = c.Emisor || {};
  const cliente = c.Cliente || {};
  const detalles = c.Detalles || [];
  const logo = getLogoBase64(emisor);
  const tipo = c.TipoComprobante ? c.TipoComprobante.descripcion : tipoDescripcion(c.tipo_comprobante_id);
  const correlativoStr = String(c.correlativo).padStart(8, "0");
  const serieCorrelativo = `${c.serie}-${correlativoStr}`;
  const moneda = c.moneda_id === "USD" ? "USD" : "PEN";
  const simbolo = moneda === "USD" ? "$" : "S/";

  const filas = detalles.map((d) => {
    const nombre = d.descripcion || (d.Producto ? d.Producto.nombre : "-");
    const unidadId = d.unidad_id || (d.Producto && d.Producto.Unidad ? d.Producto.Unidad.id : "NIU");
    const unidadNombre = d.Producto?.Unidad?.nombre || d.Producto?.Unidad?.descripcion;
    const precioUnitario = d.cantidad > 0 ? (d.importe_total / d.cantidad) : 0;
    
    // Si viene el nombre de la unidad lo usamos, sino fallback a "UNIDA" para "NIU" o el ID
    let displayUnidad = unidadNombre || (unidadId === "NIU" ? "UNIDA" : unidadId);
    displayUnidad = String(displayUnidad).toUpperCase();

    return `
      <div class="item" style="margin-bottom: 4px;">
        <div class="item-row" style="align-items: flex-start;">
          <span style="width:12%; text-align:center;">${parseFloat(d.cantidad).toFixed(2)}</span>
          <span style="width:16%; text-align:center; overflow:hidden;">${escHtml(displayUnidad)}</span>
          <span style="width:42%; word-break: break-word; text-align:left; padding-left: 2px; padding-right: 2px;">${escHtml(nombre)}</span>
          <span style="width:13%; text-align:right;">${parseFloat(precioUnitario).toFixed(2)}</span>
          <span style="width:17%; text-align:right;">${parseFloat(d.importe_total).toFixed(2)}</span>
        </div>
      </div>`;
  }).join("");

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
  .item-row { display: flex; width: 100%; align-items: flex-start; }
  .item-desc { word-break: break-word; }
  .right { text-align: right; }
  .total-row { display: flex; justify-content: space-between; }
  .total-row.big { font-weight: bold; font-size: 13px; }
  .footer { font-size: 9px; text-align: center; margin-top: 4px; }
</style>
</head>
<body>
  ${logo ? `<div class="center" style="margin-bottom:4px"><img src="${logo}" alt="Logo" style="height:40px"></div>` : ""}
  <div class="center bold" style="font-size:12px">${escHtml(emisor.razon_social || "")}</div>
  <div class="center">RUC: ${emisor.ruc || ""}</div>
  ${emisor.direccion ? `<div class="center" style="font-size:10px">${escHtml(emisor.direccion)}</div>` : ""}
  <div class="sep">-------------------------------------</div>
  <div class="center bold">${escHtml(tipo).toUpperCase()} ELECTRÓNICA</div>
  <div class="center bold" style="font-size:13px">${serieCorrelativo}</div>
  <div>Fecha: ${formatFecha(c.fecha_emision)}</div>
  <div class="sep">-------------------------------------</div>
  <div>RAZON SOCIAL: ${escHtml(cliente.razon_social || "CLIENTE VARIOS")}</div>
  ${cliente.nrodoc ? `<div>${tipoDocLabel(cliente.tipo_documento_id)}: ${cliente.nrodoc}</div>` : ""}
  ${cliente.direccion ? `<div style="font-size:10px">Dir: ${escHtml(cliente.direccion)}</div>` : ""}
  ${c.comprobanteRef ? `<div style="font-size:10px">Ref: ${c.comprobanteRef.serie}-${String(c.comprobanteRef.correlativo).padStart(8, '0')}</div>` : ""}
  ${c.descripcion_nota ? `<div style="font-size:10px">Motivo: ${escHtml(c.descripcion_nota)}</div>` : ""}
  <div class="sep">-------------------------------------</div>
  <div class="item-row bold" style="margin-bottom: 2px;">
    <span style="width:12%; text-align:center;">CANT.</span>
    <span style="width:16%; text-align:center;">U.M.</span>
    <span style="width:42%; text-align:left; padding-left: 2px;">DESCRIP</span>
    <span style="width:13%; text-align:right;">P.U.</span>
    <span style="width:17%; text-align:right;">IMPORTE</span>
  </div>
  <div class="sep">-------------------------------------</div>
  ${filas}
  <div class="sep">-------------------------------------</div>
  <div class="total-row"><span>Op. Gravada:</span><span>${simbolo} ${parseFloat(c.op_gravadas || 0).toFixed(2)}</span></div>
  ${c.op_exoneradas > 0 ? `<div class="total-row"><span>Op. Exonerada:</span><span>${simbolo} ${parseFloat(c.op_exoneradas).toFixed(2)}</span></div>` : ""}
  <div class="total-row"><span>IGV (18%):</span><span>${simbolo} ${parseFloat(c.igv || 0).toFixed(2)}</span></div>
  <div class="total-row big"><span>TOTAL:</span><span>${simbolo} ${parseFloat(c.total || 0).toFixed(2)}</span></div>
  <div class="sep">-------------------------------------</div>
  ${c.forma_pago ? `<div>Forma de Pago: ${c.forma_pago}</div>` : ""}
  ${qrBase64 ? `<div class="center" style="margin-top:4px"><img src="${qrBase64}" alt="QR" style="width:70px;height:70px"></div>` : ""}
  ${c.hash_cpe ? `<div class="footer">Hash: ${c.hash_cpe}</div>` : ""}
  <div class="footer">Representacion impresa del</div>
  <div class="footer">comprobante electronico</div>
  ${c.estado_sunat === "AC" ? `<div class="footer bold">ACEPTADO POR SUNAT</div>` : ""}
</body>
</html>`;
}

// ─── Template A5 (profesional) — Comprobante SUNAT ───────────────────────────

function buildA5Html(c, qrBase64) {
  const emisor = c.Emisor || {};
  const cliente = c.Cliente || {};
  const detalles = c.Detalles || [];
  const logo = getLogoBase64(emisor);
  const tipo = c.TipoComprobante ? c.TipoComprobante.descripcion : tipoDescripcion(c.tipo_comprobante_id);
  const correlativoStr = String(c.correlativo).padStart(8, "0");
  const serieCorrelativo = `${c.serie}-${correlativoStr}`;
  const moneda = c.moneda_id === "USD" ? "USD" : "PEN";
  const simbolo = moneda === "USD" ? "$" : "S/";

  const filas = detalles.map((d, i) => {
    const nombre = d.descripcion || (d.Producto ? d.Producto.nombre : "-");
    const unidad = d.unidad_id || (d.Producto && d.Producto.Unidad ? d.Producto.Unidad.id : "NIU");
    return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f0f9ff"}">
      <td style="padding:3px 5px;text-align:center;font-size:9px">${d.item || i + 1}</td>
      <td style="padding:3px 5px;font-size:9px">${escHtml(nombre)}</td>
      <td style="padding:3px 5px;text-align:center;font-size:9px">${escHtml(unidad)}</td>
      <td style="padding:3px 5px;text-align:center;font-size:9px">${parseFloat(d.cantidad).toFixed(2)}</td>
      <td style="padding:3px 5px;text-align:right;font-size:9px">${simbolo} ${parseFloat(d.valor_unitario).toFixed(2)}</td>
      <td style="padding:3px 5px;text-align:right;font-size:9px">${simbolo} ${parseFloat(d.importe_total).toFixed(2)}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #222; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0c4a6e; color: white; padding: 3px 5px; font-size: 8px; text-transform: uppercase; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0369a1;padding-bottom:6px;margin-bottom:6px">
    ${logo ? `<img src="${logo}" alt="Logo" style="height:40px">` : "<div></div>"}
    <div style="text-align:center">
      <div style="font-weight:bold;font-size:12px">${escHtml(emisor.razon_social || "")}</div>
      <div style="font-size:9px">RUC: ${emisor.ruc || ""}</div>
      ${emisor.direccion ? `<div style="font-size:8px">${escHtml(emisor.direccion)}</div>` : ""}
      ${emisor.distrito ? `<div style="font-size:8px">${escHtml(emisor.distrito)} - ${escHtml(emisor.provincia)} - ${escHtml(emisor.departamento)}</div>` : ""}
    </div>
    <div style="border:2px solid #0369a1;padding:6px 8px;text-align:center;min-width:130px">
      <div style="font-weight:bold;font-size:9px;text-transform:uppercase">${escHtml(tipo)}</div>
      <div style="font-weight:bold;font-size:12px;margin-top:2px">${serieCorrelativo}</div>
    </div>
  </div>

  <div style="background:#f0f9ff;padding:5px 7px;margin-bottom:6px;border-radius:3px;font-size:9px">
    <div><strong>Cliente:</strong> ${escHtml(cliente.razon_social || "CLIENTE VARIOS")}</div>
    ${cliente.nrodoc ? `<div><strong>${tipoDocLabel(cliente.tipo_documento_id)}:</strong> ${cliente.nrodoc}</div>` : ""}
    ${cliente.direccion ? `<div><strong>Direccion:</strong> ${escHtml(cliente.direccion)}</div>` : ""}
    <div><strong>Emision:</strong> ${formatFecha(c.fecha_emision)} &nbsp;|&nbsp; <strong>Moneda:</strong> ${moneda} &nbsp;|&nbsp; <strong>Pago:</strong> ${c.forma_pago || "Contado"}</div>
    ${c.comprobanteRef ? `<div><strong>Ref:</strong> ${c.comprobanteRef.serie}-${String(c.comprobanteRef.correlativo).padStart(8, '0')} &nbsp;|&nbsp; <strong>Motivo:</strong> ${escHtml(c.descripcion_nota || "")}</div>` : ""}
  </div>

  <table style="margin-bottom:6px">
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th style="text-align:left">Descripcion</th>
        <th style="width:10%">Unid.</th>
        <th style="width:8%">Cant.</th>
        <th style="width:14%;text-align:right">V.Unit.(${simbolo})</th>
        <th style="width:14%;text-align:right">Importe(${simbolo})</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <div style="display:flex;justify-content:space-between;align-items:flex-end">
    <div style="max-width:55%">
      ${qrBase64 ? `<img src="${qrBase64}" alt="QR" style="width:70px;height:70px">` : ""}
      ${c.hash_cpe ? `<div style="font-size:7px;color:#666;margin-top:2px">Hash: ${c.hash_cpe}</div>` : ""}
      <div style="font-size:7px;color:#666">Representacion impresa de comprobante electronico</div>
      ${c.estado_sunat === "AC" ? `<div style="font-size:8px;color:green;font-weight:bold">ACEPTADO POR SUNAT</div>` : ""}
    </div>
    <table style="min-width:180px;width:auto">
      <tr><td style="padding:2px 6px;font-size:9px">Op. Gravadas:</td><td style="padding:2px 6px;text-align:right;font-size:9px">${simbolo} ${parseFloat(c.op_gravadas || 0).toFixed(2)}</td></tr>
      ${c.op_exoneradas > 0 ? `<tr><td style="padding:2px 6px;font-size:9px">Op. Exoneradas:</td><td style="padding:2px 6px;text-align:right;font-size:9px">${simbolo} ${parseFloat(c.op_exoneradas).toFixed(2)}</td></tr>` : ""}
      <tr><td style="padding:2px 6px;font-size:9px">IGV (18%):</td><td style="padding:2px 6px;text-align:right;font-size:9px">${simbolo} ${parseFloat(c.igv || 0).toFixed(2)}</td></tr>
      <tr style="background:#0c4a6e;color:white;font-weight:bold">
        <td style="padding:3px 6px;font-size:10px">TOTAL:</td>
        <td style="padding:3px 6px;text-align:right;font-size:10px">${simbolo} ${parseFloat(c.total || 0).toFixed(2)}</td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFecha(fecha) {
  if (!fecha) return "";
  //return new Date(fecha).toLocaleDateString("es-PE");
  const d = new Date(fecha);
  return `${d.toLocaleDateString("es-PE")} ${d.toLocaleTimeString("es-PE", { hour12: false })}`;
}

function tipoDescripcion(id) {
  const map = {
    "01": "FACTURA ELECTRÓNICA",
    "03": "BOLETA DE VENTA ELECTRÓNICA",
    "07": "NOTA DE CRÉDITO ELECTRÓNICA",
    "08": "NOTA DE DÉBITO ELECTRÓNICA",
    "09": "GUÍA DE REMISIÓN REMITENTE",
    "31": "GUÍA DE REMISIÓN TRANSPORTISTA",
  };
  return map[id] || "COMPROBANTE ELECTRÓNICO";
}

function tipoDocLabel(id) {
  const map = {
    "1": "DNI",
    "4": "CE",
    "6": "RUC",
    "7": "Pasaporte",
    "A": "Cédula",
  };
  return map[id] || "Doc";
}

// ─── Template A5 — Guía de Remisión ──────────────────────────────────────────

function buildGuiaA5Html(g) {
  const emisor = g.Emisor || {};
  const dest = g.Destinatario || {};
  const detalles = g.DetalleGuia || [];
  const logo = getLogoBase64(emisor);
  const tipoLabel = g.tipo_guia === "31" ? "GUÍA DE REMISIÓN TRANSPORTISTA" : "GUÍA DE REMISIÓN REMITENTE";
  const correlativoStr = String(g.correlativo).padStart(8, "0");
  const serieCorrelativo = `${g.serie}-${correlativoStr}`;

  const motivoMap = { "01": "Venta", "02": "Compra", "04": "Traslado entre est.", "08": "Importación", "09": "Exportación", "13": "Otros" };
  const motivoLabel = motivoMap[g.motivo_traslado_id] || g.descripcion_motivo || g.motivo_traslado_id || "-";

  const filas = detalles.map((d, i) => {
    const unidad = d.unidad_id || (d.Unidad ? d.Unidad.id : "NIU");
    return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f0f9ff"}">
      <td style="padding:3px 5px;text-align:center;font-size:9px">${d.item || i + 1}</td>
      <td style="padding:3px 5px;text-align:center;font-size:9px">${parseFloat(d.cantidad).toFixed(2)}</td>
      <td style="padding:3px 5px;text-align:center;font-size:9px">${escHtml(unidad)}</td>
      <td style="padding:3px 5px;font-size:9px">${escHtml(d.descripcion || "-")}</td>
    </tr>`;
  }).join("");

  const transporteHtml = g.modalidad_traslado === "01"
    ? `<div><strong>Modalidad:</strong> Transporte Público</div>
       <div><strong>Transportista:</strong> ${escHtml(g.transportista_razon_social || "")} &nbsp;|&nbsp; <strong>RUC:</strong> ${g.transportista_ruc || ""}</div>`
    : `<div><strong>Modalidad:</strong> Transporte Privado</div>
       <div><strong>Vehículo:</strong> ${escHtml(g.vehiculo_placa || "")} &nbsp;|&nbsp; <strong>Conductor:</strong> ${escHtml(g.conductor_nombres || "")} &nbsp;|&nbsp; <strong>Doc:</strong> ${g.conductor_nrodoc || ""}</div>
       ${g.conductor_licencia ? `<div><strong>Licencia:</strong> ${g.conductor_licencia}</div>` : ""}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #222; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0c4a6e; color: white; padding: 3px 5px; font-size: 8px; text-transform: uppercase; }
  .section { background: #f0f9ff; padding: 5px 7px; margin-bottom: 5px; border-radius: 3px; font-size: 9px; }
  .section-title { font-size: 8px; font-weight: bold; color: #0c4a6e; text-transform: uppercase; margin-bottom: 2px; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0369a1;padding-bottom:6px;margin-bottom:6px">
    ${logo ? `<img src="${logo}" alt="Logo" style="height:40px">` : "<div></div>"}
    <div style="text-align:center">
      <div style="font-weight:bold;font-size:12px">${escHtml(emisor.razon_social || "")}</div>
      <div style="font-size:9px">RUC: ${emisor.ruc || ""}</div>
      ${emisor.direccion ? `<div style="font-size:8px">${escHtml(emisor.direccion)}</div>` : ""}
      ${emisor.distrito ? `<div style="font-size:8px">${escHtml(emisor.distrito)} - ${escHtml(emisor.provincia)} - ${escHtml(emisor.departamento)}</div>` : ""}
    </div>
    <div style="border:2px solid #0369a1;padding:6px 8px;text-align:center;min-width:130px">
      <div style="font-weight:bold;font-size:8px;text-transform:uppercase">${escHtml(tipoLabel)}</div>
      <div style="font-weight:bold;font-size:12px;margin-top:2px">${serieCorrelativo}</div>
    </div>
  </div>

  <div class="section">
    <div><strong>Destinatario:</strong> ${escHtml(dest.razon_social || "")}</div>
    ${dest.nrodoc ? `<div><strong>${tipoDocLabel(dest.tipo_documento_id)}:</strong> ${dest.nrodoc}</div>` : ""}
    ${dest.direccion ? `<div><strong>Dirección:</strong> ${escHtml(dest.direccion)}</div>` : ""}
    <div><strong>Emisión:</strong> ${formatFechaCorta(g.fecha_emision)} &nbsp;|&nbsp; <strong>Traslado:</strong> ${formatFechaCorta(g.fecha_traslado)}</div>
  </div>

  <div class="section">
    <div class="section-title">Datos del Traslado</div>
    <div><strong>Motivo:</strong> ${escHtml(motivoLabel)}${g.motivo_traslado_id === "13" && g.descripcion_motivo ? ` — ${escHtml(g.descripcion_motivo)}` : ""}</div>
    <div><strong>Peso Bruto:</strong> ${parseFloat(g.peso_bruto_total || 0).toFixed(3)} ${g.unidad_peso_id || "KGM"} &nbsp;|&nbsp; <strong>Bultos:</strong> ${g.numero_bultos || 0}</div>
  </div>

  <div style="display:flex;gap:5px;margin-bottom:5px">
    <div class="section" style="flex:1">
      <div class="section-title">Punto de Partida</div>
      <div><strong>Ubigeo:</strong> ${g.ubigeo_partida || "-"}</div>
      <div>${escHtml(g.direccion_partida || "-")}</div>
    </div>
    <div class="section" style="flex:1">
      <div class="section-title">Punto de Llegada</div>
      <div><strong>Ubigeo:</strong> ${g.ubigeo_llegada || "-"}</div>
      <div>${escHtml(g.direccion_llegada || "-")}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Transporte</div>
    ${transporteHtml}
  </div>

  <table style="margin-top:5px;margin-bottom:6px">
    <thead>
      <tr>
        <th style="width:6%">#</th>
        <th style="width:12%">Cant.</th>
        <th style="width:10%">Unid.</th>
        <th style="text-align:left">Descripción del Bien</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <div style="margin-top:8px;border-top:1px solid #ccc;padding-top:5px;font-size:8px;color:#666">
    ${g.hash_cpe ? `<div>Hash CPE: ${g.hash_cpe}</div>` : ""}
    <div>Representación impresa de guía de remisión electrónica</div>
    ${g.estado_sunat === "AC" ? `<div style="color:green;font-weight:bold;font-size:9px">ACEPTADO POR SUNAT</div>` : ""}
  </div>
</body>
</html>`;
}

function formatFechaCorta(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-PE");
}

/**
 * Genera el PDF de una Guía de Remisión.
 *
 * @param {object} guia  Instancia de GuiaRemision con includes (Emisor, Destinatario, DetalleGuia)
 * @param {string} format "a5" (default)
 * @returns {Promise<Buffer>}
 */
async function generarPdfGuia(guia) {
  const html = buildGuiaA5Html(guia);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfOptions = {
      format: "A5",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    };

    return Buffer.from(await page.pdf(pdfOptions));
  } finally {
    await page.close();
  }
}

module.exports = { generarPdf, generarPdfGuia };
