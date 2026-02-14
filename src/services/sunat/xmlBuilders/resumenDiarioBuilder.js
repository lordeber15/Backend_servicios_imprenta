/**
 * GENERADOR DE XML: RESUMEN DIARIO DE BOLETAS
 * 
 * Este módulo agrupa múltiples boletas de venta del mismo día en un único
 * archivo XML (RC) para su envío por lotes a SUNAT.
 * 
 * @module services/sunat/xmlBuilders/resumenDiarioBuilder
 */

/**
 * Genera el XML del Resumen Diario (RC) para un lote de boletas.
 * Formato: {RUC}-RC-{YYYYMMDD}-{N}
 *
 * Cada boleta en el lote se incluye como un <sac:SummaryDocumentsLine>.
 * El RC se envía al día siguiente de la fecha de las boletas (fecha_referencia).
 *
 * @param {object} params
 * @param {object} params.emisor          Instancia del modelo Emisor
 * @param {object[]} params.boletas       Array de Comprobantes tipo 03 con Cliente y Moneda
 * @param {string} params.fecha_referencia  Fecha YYYY-MM-DD de las boletas
 * @param {number} params.correlativo     Correlativo del RC del día (ej: 1)
 * @returns {string}  XML del RC sin firma
 */
function build({ emisor, boletas, fecha_referencia, correlativo }) {
  const fechaReferencia = formatDate(fecha_referencia);
  const fechaEmision = formatDate(new Date()); // hoy
  const rcId = `RC-${fechaReferencia.replace(/-/g, "")}-${correlativo}`;

  const lineas = boletas.map((b, i) => buildLinea(b, i + 1)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<SummaryDocuments
  xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">

  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.1</cbc:CustomizationID>
  <cbc:ID>${rcId}</cbc:ID>
  <cbc:ReferenceDate>${fechaReferencia}</cbc:ReferenceDate>
  <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>

  <cac:Signature>
    <cbc:ID>IDSignKG</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[${emisor.razon_social}]]></cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#IDSignKG</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>

  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${emisor.ruc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${emisor.razon_social}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  ${lineas}
</SummaryDocuments>`;
}

function buildLinea(boleta, lineId) {
  const cliente = boleta.Cliente || {};
  const moneda = boleta.moneda_id || "PEN";

  // Tipo de documento del cliente para el RC
  const tipoDocCliente = mapTipoDoc(cliente.tipo_documento_id);
  const nroDocCliente = cliente.nrodoc || "0";

  const opGravadas = parseDecimal(boleta.op_gravadas);
  const opExoneradas = parseDecimal(boleta.op_exoneradas);
  const opInafectas = parseDecimal(boleta.op_inafectas);
  const igv = parseDecimal(boleta.igv);
  const total = parseDecimal(boleta.total);
  const serieCorrelativo = `${boleta.serie}-${String(boleta.correlativo).padStart(8, "0")}`;

  // condicion: 1=adicion, 2=modificacion, 3=anulacion
  const condicion = boleta._condicionRC || 1;

  // Bloques de impuestos
  const subTotalesIgv = opGravadas > 0
    ? `<cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${opGravadas.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${igv.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`
    : "";

  const subTotalesExo = opExoneradas > 0
    ? `<cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${opExoneradas.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">0.00</cbc:TaxAmount>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:ID>9997</cbc:ID>
            <cbc:Name>EXO</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`
    : "";

  const subTotalesIna = opInafectas > 0
    ? `<cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${opInafectas.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">0.00</cbc:TaxAmount>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:ID>9998</cbc:ID>
            <cbc:Name>INA</cbc:Name>
            <cbc:TaxTypeCode>FRE</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`
    : "";

  return `<sac:SummaryDocumentsLine>
    <cbc:LineID>${lineId}</cbc:LineID>
    <cbc:DocumentTypeCode>03</cbc:DocumentTypeCode>
    <cbc:ID>${serieCorrelativo}</cbc:ID>
    <sac:AccountingCustomerParty>
      <cbc:CustomerAssignedAccountID>${nroDocCliente}</cbc:CustomerAssignedAccountID>
      <cbc:AdditionalAccountID>${tipoDocCliente}</cbc:AdditionalAccountID>
    </sac:AccountingCustomerParty>
    <sac:BillingPayment>
      <cbc:PaidAmount currencyID="${moneda}">${total.toFixed(2)}</cbc:PaidAmount>
      <cbc:InstructionID>01</cbc:InstructionID>
    </sac:BillingPayment>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${igv.toFixed(2)}</cbc:TaxAmount>
      ${subTotalesIgv}
      ${subTotalesExo}
      ${subTotalesIna}
    </cac:TaxTotal>
    <sac:TotalAmount currencyID="${moneda}">${total.toFixed(2)}</sac:TotalAmount>
    <sac:Condition>${condicion}</sac:Condition>
  </sac:SummaryDocumentsLine>`;
}

function mapTipoDoc(id) {
  const map = { "1": "1", "4": "4", "6": "6", "7": "7", "A": "A" };
  return map[id] || "0";
}

function parseDecimal(val) {
  return parseFloat(val || 0);
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

module.exports = { build };
