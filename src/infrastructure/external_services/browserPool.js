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

const puppeteer = require("puppeteer");

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserInstance;
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = { getBrowser, closeBrowser };
