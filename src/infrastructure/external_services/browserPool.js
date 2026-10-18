/**
 * POOL DE BROWSER PUPPETEER REUTILIZABLE
 *
 * Mantiene una única instancia de Chromium para todas las generaciones de PDF,
 * evitando el overhead de lanzar un nuevo browser por cada solicitud (~1-3s).
 *
 * Uso:
 *   const { getBrowser } = require("./browserPool");
 *   const browser = await getBrowser();
 *   const page = await browser.newPage();
 *   // ... generar PDF ...
 *   await page.close(); // Solo cerrar la página, NO el browser
 */

// puppeteer-core: usa el Chromium del sistema (apk) y no trae la cadena de
// descarga de navegadores (@puppeteer/browsers, extract-zip, proxy-agent…).
const puppeteer = require("puppeteer-core");

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserInstance;
}

/**
 * Abre una página aislada para renderizar HTML propio a PDF.
 *
 * El HTML incluye datos que escriben los usuarios (cliente, descripción…).
 * Aunque se escapan, se cierra la puerta por si alguno se filtra:
 * - JavaScript desactivado: un <script> inyectado no se ejecuta.
 * - Red bloqueada: solo data: y about: (logos y QR van embebidos en base64),
 *   así un <img src="http://..."> no puede usarse para SSRF hacia la red interna.
 */
async function newSafePage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith("data:") || url.startsWith("about:")) req.continue();
    else req.abort("blockedbyclient");
  });
  return page;
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = { getBrowser, newSafePage, closeBrowser };
