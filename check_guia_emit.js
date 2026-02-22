require('dotenv').config();
const GuiaRemision = require('./src/infrastructure/database/models/facturacion/guiaremision');
const DetalleGuia = require('./src/infrastructure/database/models/facturacion/detalleguia');
const Emisor = require('./src/infrastructure/database/models/facturacion/emisor');
const Cliente = require('./src/infrastructure/database/models/facturacion/cliente');
const Unidad = require('./src/infrastructure/database/models/facturacion/unidad');
const Comprobante = require('./src/infrastructure/database/models/facturacion/comprobante');
require('./src/infrastructure/database/models/facturacion/asociation');

const guiaRemisionBuilder = require('./src/infrastructure/external_services/sunat/xmlBuilders/guiaRemisionBuilder');
const xmlSigner = require('./src/infrastructure/external_services/sunat/xmlSigner');
const sunatClient = require('./src/infrastructure/external_services/sunat/sunatClient');
require('dotenv').config();

async function testEmit() {
  try {
    const guia = await GuiaRemision.findByPk(3, {
      include: [
        { model: Emisor },
        { model: Cliente, as: "Destinatario" },
        { model: DetalleGuia, include: [{ model: Unidad }] },
        { model: Comprobante, as: "ComprobanteRelacionado" },
      ]
    });

    const emisor = guia.Emisor;
    const correlativoStr = String(guia.correlativo).padStart(8, "0");
    const nombreArchivo = `${emisor.ruc}-${guia.tipo_guia}-${guia.serie}-${correlativoStr}`;

    console.log("Keys de guia:", Object.keys(guia.toJSON()));
    if (guia.DetalleGuia) console.log("Tiene DetalleGuia");
    if (guia.DetalleGuias) console.log("Tiene DetalleGuias", guia.DetalleGuias.length);

    const xmlSinFirmar = guiaRemisionBuilder.build(guia);
    const certPath = process.env.SUNAT_CERT_PATH;
    const certPassword = process.env.SUNAT_CERT_PASSWORD;

    const xmlFirmado = xmlSigner.signXml(xmlSinFirmar, certPath, certPassword);

    const xmlBuffer = Buffer.from(xmlFirmado, "utf8");
    console.log("Enviando a SUNAT...");
    const cdrBase64 = await sunatClient.sendBillGuia(xmlBuffer, nombreArchivo, emisor);
    console.log("EXITO:", cdrBase64 ? "CDR RECIBIDO" : "SIN CDR");
  } catch (err) {
    console.error("ERROR CAPTURADO:");
    console.error(err.message);
    if (err.response) {
       console.error(err.response.data);
    }
    if (err.Fault) {
       console.error("SOAP FAULT:", JSON.stringify(err.Fault, null, 2));
    }
    if (err.root) {
       console.error("ERROR ROOT:", err.root.Envelope.Body.Fault);
    }
  }
  process.exit();
}
testEmit();
