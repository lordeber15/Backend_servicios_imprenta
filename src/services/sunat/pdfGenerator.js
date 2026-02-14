/**
 * GENERADOR DE PDF (REPRESENTACIÓN IMPRESA)
 * 
 * Este módulo utiliza Puppeteer para convertir una plantilla HTML dinámica en un
 * archivo PDF profesional que sirve como representación impresa del comprobante.
 * 
 * @module services/sunat/pdfGenerator
 */

/**
 * Genera la representación impresa (PDF) del comprobante electrónico.
 * Usa Puppeteer para renderizar una plantilla HTML con todos los datos.
 *
 * @param {object} comprobante  Instancia de Comprobante con includes cargados
 * @param {string} qrBase64    Data URL del QR generado por qrGenerator
 * @returns {Promise<Buffer>}  Buffer del PDF generado
 */
async function generarPdf(comprobante, qrBase64) {
  const html = buildHtml(comprobante, qrBase64);
  const nombreArchivo = comprobante.nombre_xml;
  const outputPath = storageHelper.getPdfPath(nombreArchivo);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
    });

    // Asegurar directorio y guardar en disco
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, pdfBuffer);

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

function buildHtml(c, qrBase64) {
  const emisor = c.Emisor || {};
  const cliente = c.Cliente || {};
  const detalles = c.Detalles || [];
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
    <div class="emisor-info">
      <h2>${escHtml(emisor.razon_social || "")}</h2>
      <p>RUC: <strong>${emisor.ruc || ""}</strong></p>
      <p>${escHtml(emisor.direccion || "")}</p>
      ${emisor.distrito ? `<p>${escHtml(emisor.distrito)} - ${escHtml(emisor.provincia)} - ${escHtml(emisor.departamento)}</p>` : ""}
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
  return new Date(fecha).toLocaleDateString("es-PE");
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

module.exports = { generarPdf };
