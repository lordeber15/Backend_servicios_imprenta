/**
 * GENERADOR DE XML: COMUNICACIÓN DE BAJA
 * 
 * Este módulo construye el XML UBL 2.0 para la anulación de comprobantes
 * electrónicos (RA) que ya fueron aceptados previamente por SUNAT.
 * 
 * @module services/sunat/xmlBuilders/comunicacionBajaBuilder
 */

/**
 * Genera el XML de Comunicación de Baja (RA) para anular comprobantes
 * de tipo Factura (01), NC (07) o ND (08) ya aceptados por SUNAT.
 *
 * Formato del nombre: {RUC}-RA-{YYYYMMDD}-{N}
 *
 * @param {object} params
 * @param {object}   params.emisor          Instancia del modelo Emisor
 * @param {object[]} params.comprobantes    Array de { tipo_comprobante_id, serie, correlativo, motivo_baja }
 * @param {string}   params.fecha_referencia  Fecha YYYY-MM-DD del RC (fecha de las facturas)
 * @param {number}   params.correlativo     Correlativo del RA del día
 * @returns {string}  XML del RA sin firma
 */
function build({ emisor, comprobantes, fecha_referencia, correlativo }) {
  const fechaReferencia = formatDate(fecha_referencia);
  const fechaEmision = formatDate(new Date()); // hoy
  const raId = `RA-${fechaEmision.replace(/-/g, "")}-${correlativo}`;

  const lineas = comprobantes.map((c, i) => `<sac:VoidedDocumentsLine>
    <cbc:LineID>${i + 1}</cbc:LineID>
    <cbc:DocumentTypeCode>${c.tipo_comprobante_id}</cbc:DocumentTypeCode>
    <sac:DocumentSerialID>${c.serie}</sac:DocumentSerialID>
    <sac:DocumentNumberID>${String(c.correlativo).padStart(8, "0")}</sac:DocumentNumberID>
    <cbc:VoidReasonDescription><![CDATA[${c.motivo_baja || "Error en emisión"}]]></cbc:VoidReasonDescription>
  </sac:VoidedDocumentsLine>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<VoidedDocuments
  xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1"
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
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${raId}</cbc:ID>
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
</VoidedDocuments>`;
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

module.exports = { build };
