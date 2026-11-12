/**
 * Configuración de Pagos Yape/Plin (teléfono Android → backend).
 *
 * Ejemplo .env:
 * NOTIFIER_PUBLIC_API_URL=https://api.impalexander.com   URL que la app guarda al escanear el QR
 * NOTIFIER_PROVIDER_PACKAGES=com.bcp.innovacxion.yapeapp:YAPE,pe.com.interbank.mobilebanking:PLIN
 * NOTIFIER_RETENTION_SECURITY_CODE_DAYS=7    borrar el código de seguridad de Yape
 * NOTIFIER_RETENTION_RAW_TEXT_DAYS=90        anonimizar el texto original
 * NOTIFIER_RETENTION_UNPARSED_DAYS=30        borrar las no reconocidas e ignoradas
 * NOTIFIER_RETENTION_SENDER_NAME_DAYS=0      0 = conservar nombres (obligación contable)
 */
const PAQUETES_POR_DEFECTO = "com.bcp.innovacxion.yapeapp:YAPE,pe.com.interbank.mobilebanking:PLIN";

function leerPaquetes(valor) {
  const mapa = new Map();
  for (const par of (valor || PAQUETES_POR_DEFECTO).split(",").map((s) => s.trim()).filter(Boolean)) {
    const [paquete, proveedor] = par.split(":").map((s) => s.trim());
    if (!paquete || !["YAPE", "PLIN"].includes(proveedor)) {
      throw new Error(`NOTIFIER_PROVIDER_PACKAGES inválido: ${par}`);
    }
    mapa.set(paquete, proveedor);
  }
  return mapa;
}

function dias(nombre, porDefecto, minimo = 1) {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo === "") return porDefecto;
  const n = Number(crudo);
  if (!Number.isInteger(n) || n < minimo) throw new Error(`${nombre} debe ser un entero >= ${minimo}`);
  return n;
}

const notifierConfig = {
  publicApiUrl: (process.env.NOTIFIER_PUBLIC_API_URL || "").replace(/\/+$/, ""),
  paquetes: leerPaquetes(process.env.NOTIFIER_PROVIDER_PACKAGES),
  retencion: {
    codigoSeguridad: dias("NOTIFIER_RETENTION_SECURITY_CODE_DAYS", 7),
    textoOriginal: dias("NOTIFIER_RETENTION_RAW_TEXT_DAYS", 90),
    noReconocidas: dias("NOTIFIER_RETENTION_UNPARSED_DAYS", 30),
    nombres: dias("NOTIFIER_RETENTION_SENDER_NAME_DAYS", 0, 0),
  },
};

module.exports = { notifierConfig, leerPaquetes };
