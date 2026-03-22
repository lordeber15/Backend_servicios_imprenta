const { getBrowser } = require("../browserPool");
const fs = require("fs");
const path = require("path");

// Ruta base: Backend_servicios_imprenta/storage/
const storagePath = path.resolve(__dirname, "../../../../storage");

// Logo (se carga una sola vez al iniciar)
let defaultLogoBase64 = "";
try {
  const logoPath = path.join(storagePath, "ALEXANDER-CtWN4tN1.webp");
  if (fs.existsSync(logoPath)) {
    const buf = fs.readFileSync(logoPath);
    defaultLogoBase64 = `data:image/webp;base64,${buf.toString("base64")}`;
    console.log("✅ Logo cotización cargado correctamente");
  } else {
    console.log("⚠️ Logo no encontrado en:", logoPath);
  }
} catch (_) {
  console.log("⚠️ Error al cargar logo cotización");
}

// Membrete SVG (se carga y limpia una sola vez al iniciar)
let membreteSvgBase64 = "";
try {
  const svgPath = path.join(storagePath, "membrete.svg");
  if (fs.existsSync(svgPath)) {
    let svgContent = fs.readFileSync(svgPath, "utf-8");
    // Eliminar <symbol> (referencian PNGs externos que no existen)
    svgContent = svgContent.replace(/<symbol[\s\S]*?<\/symbol>/g, "");
    // Eliminar <clipPath> (ya no se necesitan sin los symbols)
    svgContent = svgContent.replace(/<clipPath[\s\S]*?<\/clipPath>/g, "");
    membreteSvgBase64 = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`;
    console.log("✅ Membrete cotización cargado correctamente");
  } else {
    console.log("⚠️ Membrete no encontrado en:", svgPath);
  }
} catch (_) {
  console.log("⚠️ Error al cargar membrete SVG");
}

function getLogoBase64(emisor) {
  if (emisor?.logo_url) {
    try {
      // Buscar primero en storage/, luego ruta relativa al proyecto
      const inStorage = path.join(storagePath, path.basename(emisor.logo_url));
      if (fs.existsSync(inStorage)) {
        const ext = path.extname(inStorage).slice(1) || "png";
        const buf = fs.readFileSync(inStorage);
        return `data:image/${ext};base64,${buf.toString("base64")}`;
      }

      // Fallback: ruta desde src/ (subir 3 niveles desde cotizacion/)
      // __dirname está en: src/infrastructure/external_services/cotizacion/
      const projectRoot = path.resolve(__dirname, "../../..");
      const relativePath = emisor.logo_url.replace(/^\//, "");
      const altPath = path.join(projectRoot, relativePath);

      if (fs.existsSync(altPath)) {
        const ext = path.extname(altPath).slice(1) || "png";
        const buf = fs.readFileSync(altPath);
        return `data:image/${ext};base64,${buf.toString("base64")}`;
      } else {
        console.warn(`Logo no encontrado en: ${altPath}`);
      }
    } catch (error) {
      console.error("Error cargando logo del emisor:", error);
    }
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

// ─── Template A4 ────────────────────────────────────────────────────────────

function buildA4Html(cotizacion, detalles, emisor) {
  const logo = getLogoBase64(emisor);
  const nombre = escHtml(emisor?.nombre_comercial || emisor?.razon_social || "IMPRENTA ALEXANDER");
  const numCot = String(cotizacion.id).padStart(5, "0");
  const tel = escHtml(emisor?.telefono || "");

  const filas = detalles
    .map((d) => {
      const subtotal = parseFloat(d.cantidad * d.precioUnitario).toFixed(2);
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escHtml(d.descripcion)}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e5e7eb">${d.cantidad}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb">S/.${parseFloat(d.precioUnitario).toFixed(2)}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb">S/.${subtotal}</td>
      </tr>`;
    })
    .join("");

  const total = parseFloat(cotizacion.precioTotal || 0);
  const opGravada = total / 1.18;
  const igv = total - opGravada;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1f2937; }

  .membrete-bg {
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0; pointer-events: none;
  }

  .cot-label {
    position: fixed; top: 55px; left: 45px;
    color: #fff; font-size: 26px; font-weight: bold;
    z-index: 2; line-height: 1.4;
  }
  .cot-label span { font-size: 22px; }

  .content {
    position: relative; z-index: 1;
    padding: 210px 50px 240px 50px;
  }

  .header-row {
    display: flex; justify-content: flex-end; align-items: flex-start;
    margin-top: -70px; margin-bottom: 20px;
  }
  .logo-block { text-align: center; }
  .logo-block img { height: 75px; margin-bottom: 4px; }
  .logo-block .company-name {
    font-size: 9px; font-weight: bold; color: #374151;
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .client-section {
    border-top: 1px solid #9ca3af;
    padding-top: 12px; margin-bottom: 8px;
  }
  .client-title {
    font-weight: bold; font-size: 14px; color: #1f2937;
    margin-bottom: 8px; letter-spacing: 1.5px;
  }
  .client-field { margin-bottom: 3px; font-size: 11px; color: #374151; }
  .client-field strong { color: #111827; }

  .fecha-line {
    font-weight: bold; font-size: 12px;
    margin: 14px 0 10px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid #9ca3af;
  }

  .table-wrapper { position: relative; }
  .watermark {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.06; z-index: 0; pointer-events: none;
  }
  .watermark img { height: 220px; }

  table.items {
    width: 100%; border-collapse: collapse;
    position: relative; z-index: 1;
  }
  table.items th {
    background: #ede9fe; color: #374151;
    padding: 10px 12px; font-size: 12px; font-weight: bold;
    border-bottom: 2px solid #c4b5fd;
  }
  table.items td { font-size: 11px; }

  .table-gold-line {
    border-top: 3px solid #eab308;
    margin-bottom: 16px;
  }

  table.totals {
    border-collapse: collapse; margin-left: auto;
    min-width: 260px;
  }
  table.totals td { padding: 5px 12px; font-size: 12px; }
  .total-row td {
    background: #0CC0DF; color: #fff;
    font-weight: bold; font-size: 14px;
    padding: 7px 12px;
  }
</style>
</head>
<body>

  <!-- Membrete de fondo (ondas reales de la empresa) -->
  ${membreteSvgBase64 ? `<img src="${membreteSvgBase64}" class="membrete-bg" alt="">` : ""}

  <!-- Etiqueta COTIZACION sobre la onda cian -->
  <div class="cot-label">
    COTIZACION<br><span>N° ${numCot}</span>
  </div>

  <div class="content">
    <!-- Logo arriba derecha -->
    <div class="header-row">
      <div class="logo-block">
        ${logo ? `<img src="${logo}" alt="Logo">` : ""}
        <div class="company-name">${nombre}</div>
      </div>
    </div>

    <!-- Datos del cliente -->
    <div class="client-section">
      <div class="client-title">DATOS DEL CLIENTE</div>
      <div class="client-field"><strong>Nombre:</strong> ${escHtml(cotizacion.cliente || "Sin nombre")}</div>
      ${cotizacion.direccion ? `<div class="client-field"><strong>Dirección:</strong> ${escHtml(cotizacion.direccion)}</div>` : ""}
      ${tel ? `<div class="client-field"><strong>Tel:</strong> ${tel}</div>` : ""}
      ${cotizacion.tipoDocumento && cotizacion.tipoDocumento !== "Sin Documento" && cotizacion.numeroDocumento ? `<div class="client-field"><strong>${escHtml(cotizacion.tipoDocumento)}:</strong> ${escHtml(cotizacion.numeroDocumento)}</div>` : ""}
    </div>

    <!-- Fecha -->
    <div class="fecha-line">Fecha: ${formatFecha(cotizacion.fechaEmision)}</div>

    <!-- Tabla de ítems -->
    <div class="table-wrapper">
      ${logo ? `<div class="watermark"><img src="${logo}" alt=""></div>` : ""}
      <table class="items">
        <thead>
          <tr>
            <th style="width:45%;text-align:left">Concepto</th>
            <th style="width:15%;text-align:center">Cantidad</th>
            <th style="width:20%;text-align:right">Precio</th>
            <th style="width:20%;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="table-gold-line"></div>
    </div>

    <!-- Totales -->
    <table class="totals">
      <tr>
        <td style="text-align:right">Op. Gravada:</td>
        <td style="text-align:right">S/.${opGravada.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="text-align:right">IGV (18%):</td>
        <td style="text-align:right">S/.${igv.toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td style="text-align:right">TOTAL:</td>
        <td style="text-align:right">S/.${total.toFixed(2)}</td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

// ─── Template A5 ────────────────────────────────────────────────────────────

function buildA5Html(cotizacion, detalles, emisor) {
  const logo = getLogoBase64(emisor);
  const nombre = escHtml(emisor?.nombre_comercial || emisor?.razon_social || "IMPRENTA ALEXANDER");
  const numCot = String(cotizacion.id).padStart(5, "0");
  const tel = escHtml(emisor?.telefono || "");

  const filas = detalles
    .map((d) => {
      const subtotal = parseFloat(d.cantidad * d.precioUnitario).toFixed(2);
      return `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:9px">${escHtml(d.descripcion)}</td>
        <td style="padding:5px 8px;text-align:center;border-bottom:1px solid #e5e7eb;font-size:9px">${d.cantidad}</td>
        <td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-size:9px">S/.${parseFloat(d.precioUnitario).toFixed(2)}</td>
        <td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-size:9px">S/.${subtotal}</td>
      </tr>`;
    })
    .join("");

  const total = parseFloat(cotizacion.precioTotal || 0);
  const opGravada = total / 1.18;
  const igv = total - opGravada;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1f2937; }

  .membrete-bg {
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0; pointer-events: none;
  }

  .cot-label {
    position: fixed; top: 35px; left: 30px;
    color: #fff; font-size: 18px; font-weight: bold;
    z-index: 2; line-height: 1.3;
  }
  .cot-label span { font-size: 15px; }

  .content {
    position: relative; z-index: 1;
    padding: 145px 35px 170px 35px;
  }

  .header-row {
    display: flex; justify-content: flex-end; align-items: flex-start;
    margin-top: -50px; margin-bottom: 12px;
  }
  .logo-block { text-align: center; }
  .logo-block img { height: 50px; margin-bottom: 3px; }
  .logo-block .company-name {
    font-size: 7px; font-weight: bold; color: #374151;
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .client-section {
    border-top: 1px solid #9ca3af;
    padding-top: 8px; margin-bottom: 6px;
  }
  .client-title {
    font-weight: bold; font-size: 11px; color: #1f2937;
    margin-bottom: 5px; letter-spacing: 1px;
  }
  .client-field { margin-bottom: 2px; font-size: 9px; color: #374151; }
  .client-field strong { color: #111827; }

  .fecha-line {
    font-weight: bold; font-size: 10px;
    margin: 8px 0 6px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #9ca3af;
  }

  .table-wrapper { position: relative; }
  .watermark {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.06; z-index: 0; pointer-events: none;
  }
  .watermark img { height: 140px; }

  table.items {
    width: 100%; border-collapse: collapse;
    position: relative; z-index: 1;
  }
  table.items th {
    background: #ede9fe; color: #374151;
    padding: 6px 8px; font-size: 9px; font-weight: bold;
    border-bottom: 2px solid #c4b5fd;
  }

  .table-gold-line {
    border-top: 2px solid #eab308;
    margin-bottom: 10px;
  }

  table.totals {
    border-collapse: collapse; margin-left: auto;
    min-width: 180px;
  }
  table.totals td { padding: 3px 8px; font-size: 10px; }
  .total-row td {
    background: #0CC0DF; color: #fff;
    font-weight: bold; font-size: 11px;
    padding: 5px 8px;
  }
</style>
</head>
<body>

  <!-- Membrete de fondo (ondas reales de la empresa) -->
  ${membreteSvgBase64 ? `<img src="${membreteSvgBase64}" class="membrete-bg" alt="">` : ""}

  <!-- Etiqueta COTIZACION sobre la onda cian -->
  <div class="cot-label">
    COTIZACION<br><span>N° ${numCot}</span>
  </div>

  <div class="content">
    <!-- Logo arriba derecha -->
    <div class="header-row">
      <div class="logo-block">
        ${logo ? `<img src="${logo}" alt="Logo">` : ""}
        <div class="company-name">${nombre}</div>
      </div>
    </div>

    <!-- Datos del cliente -->
    <div class="client-section">
      <div class="client-title">DATOS DEL CLIENTE</div>
      <div class="client-field"><strong>Nombre:</strong> ${escHtml(cotizacion.cliente || "Sin nombre")}</div>
      ${cotizacion.direccion ? `<div class="client-field"><strong>Dirección:</strong> ${escHtml(cotizacion.direccion)}</div>` : ""}
      ${tel ? `<div class="client-field"><strong>Tel:</strong> ${tel}</div>` : ""}
      ${cotizacion.tipoDocumento && cotizacion.tipoDocumento !== "Sin Documento" && cotizacion.numeroDocumento ? `<div class="client-field"><strong>${escHtml(cotizacion.tipoDocumento)}:</strong> ${escHtml(cotizacion.numeroDocumento)}</div>` : ""}
    </div>

    <!-- Fecha -->
    <div class="fecha-line">Fecha: ${formatFecha(cotizacion.fechaEmision)}</div>

    <!-- Tabla de ítems -->
    <div class="table-wrapper">
      ${logo ? `<div class="watermark"><img src="${logo}" alt=""></div>` : ""}
      <table class="items">
        <thead>
          <tr>
            <th style="width:45%;text-align:left">Concepto</th>
            <th style="width:15%;text-align:center">Cantidad</th>
            <th style="width:20%;text-align:right">Precio</th>
            <th style="width:20%;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="table-gold-line"></div>
    </div>

    <!-- Totales -->
    <table class="totals">
      <tr>
        <td style="text-align:right">Op. Gravada:</td>
        <td style="text-align:right">S/.${opGravada.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="text-align:right">IGV (18%):</td>
        <td style="text-align:right">S/.${igv.toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td style="text-align:right">TOTAL:</td>
        <td style="text-align:right">S/.${total.toFixed(2)}</td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

// ─── Generador principal ─────────────────────────────────────────────────────

async function generarCotizacionPdf(cotizacion, detalles, format, emisor) {
  const html = format === "a4"
    ? buildA4Html(cotizacion, detalles, emisor)
    : buildA5Html(cotizacion, detalles, emisor);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfOptions = format === "a4"
      ? { format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } }
      : { format: "A5", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } };

    return Buffer.from(await page.pdf(pdfOptions));
  } finally {
    await page.close();
  }
}

module.exports = { generarCotizacionPdf };
