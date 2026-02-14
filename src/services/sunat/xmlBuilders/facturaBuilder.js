/**
 * GENERADOR DE XML: FACTURAS, BOLETAS Y NOTAS (UBL 2.1)
 * 
 * Este es el motor principal de generación de Comprobantes de Pago Electrónicos (CPE).
 * Construye la estructura XML siguiendo el estándar UBL 2.1 exigido por SUNAT.
 * 
 * Soporta:
 * - Facturas (01), Boletas (03)
 * - Notas de Crédito (07), Notas de Débito (08)
 * - Operaciones Gravadas, Exoneradas e Inafectas
 * - Ventas al Contado y al Crédito (con Cuotas)
 * 
 * @module services/sunat/xmlBuilders/facturaBuilder
 */

/**
 * Genera el XML UBL 2.1 para Factura Electrónica (tipo 01).
 * También sirve de base para Boleta (03) con pequeñas variaciones.
 *
 * El XML generado contiene <ext:ExtensionContent/> vacío donde se inyectará
 * la firma digital en el paso de firma (xmlSigner.js).
 *
 * @param {object} comprobante  Instancia Comprobante con relaciones cargadas:
 *   - Emisor, Cliente (+ TipoDocumento), Detalles (+ Producto + TipoAfectacion + Unidad),
 *     TipoComprobante, Moneda, Cuota[]
 * @returns {string}  XML sin firma como string UTF-8
 */
function build(comprobante) {
  const c = comprobante;
  const emisor = c.Emisor;
  const cliente = c.Cliente;
  const detalles = c.Detalles || [];
  const cuotas = c.Cuotas || [];

  const correlativoStr = String(c.correlativo).padStart(8, "0");
  const serieCorrelativo = `${c.serie}-${correlativoStr}`;
  const fechaEmision = formatDate(c.fecha_emision);
  const horaEmision = formatTime(c.fecha_emision);
  const moneda = c.moneda_id || "PEN";

  // listID según tipo de comprobante y forma de pago
  // 0101 = Factura Contado, 0102 = Factura Crédito
  const esCredito = c.forma_pago && c.forma_pago.toLowerCase().includes("crédit");
  const listId = esCredito ? "0102" : "0101";

  // Tipo documento del cliente: catalogo 06 SUNAT
  // DNI=1, RUC=6, CE=4, Pasaporte=7, 0=sin doc
  const tipoDocCliente = mapTipoDoc(cliente ? cliente.tipo_documento_id : "-");
  const nroDocCliente = cliente ? (cliente.nrodoc || "") : "";
  const razonCliente = cliente ? (cliente.razon_social || "") : "";

  // Totales
  const opGravadas = parseDecimal(c.op_gravadas);
  const opExoneradas = parseDecimal(c.op_exoneradas);
  const opInafectas = parseDecimal(c.op_inafectas);
  const opGratuitas = parseDecimal(c.op_gratuitas);
  const igv = parseDecimal(c.igv);
  const total = parseDecimal(c.total);
  const lineExtension = parseDecimal(c.op_gravadas) + parseDecimal(c.op_exoneradas) + parseDecimal(c.op_inafectas);

  // Líneas de detalle
  const lineas = detalles.map((d, i) => buildLinea(d, i + 1, moneda)).join("\n");

  // Cuotas de pago (solo crédito)
  const cuotasXml = esCredito ? buildCuotas(cuotas, moneda, total) : "";

  // Bloques de impuestos globales
  const impuestosXml = buildImpuestosGlobales(opGravadas, opExoneradas, opInafectas, opGratuitas, igv, moneda);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">

  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${serieCorrelativo}</cbc:ID>
  <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>
  <cbc:IssueTime>${horaEmision}</cbc:IssueTime>
  <cbc:InvoiceTypeCode
    listAgencyName="PE:SUNAT"
    listName="Tipo de Documento"
    listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01"
    listID="${listId}">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listName="Currency" listAgencyName="United Nations Economic Commission for Europe">${moneda}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${detalles.length}</cbc:LineCountNumeric>

  ${buildFirmaBlock(emisor)}

  ${buildEmisorBlock(emisor)}

  ${buildClienteBlock(tipoDocCliente, nroDocCliente, razonCliente)}

  ${esCredito
    ? `<cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${total}</cbc:Amount>
  </cac:PaymentTerms>`
    : `<cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
  </cac:PaymentTerms>`}

  ${cuotasXml}

  ${impuestosXml}

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${moneda}">${lineExtension.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${moneda}">${opGravadas.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${total}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${moneda}">0.00</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="${moneda}">0.00</cbc:ChargeTotalAmount>
    <cbc:PayableAmount currencyID="${moneda}">${total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${lineas}
</Invoice>`;
}

/**
 * Genera XML para Nota de Crédito (07) o Débito (08).
 * Mismos campos que Factura pero con elemento raíz y referencia distintos.
 */
function buildNota(comprobante) {
  const c = comprobante;
  const emisor = c.Emisor;
  const cliente = c.Cliente;
  const detalles = c.Detalles || [];
  const ref = c.comprobanteRef; // comprobante que se modifica/anula

  const correlativoStr = String(c.correlativo).padStart(8, "0");
  const serieCorrelativo = `${c.serie}-${correlativoStr}`;
  const fechaEmision = formatDate(c.fecha_emision);
  const horaEmision = formatTime(c.fecha_emision);
  const moneda = c.moneda_id || "PEN";

  const tipoDocCliente = mapTipoDoc(cliente ? cliente.tipo_documento_id : "-");
  const nroDocCliente = cliente ? (cliente.nrodoc || "") : "";
  const razonCliente = cliente ? (cliente.razon_social || "") : "";

  const opGravadas = parseDecimal(c.op_gravadas);
  const opExoneradas = parseDecimal(c.op_exoneradas);
  const opInafectas = parseDecimal(c.op_inafectas);
  const opGratuitas = parseDecimal(c.op_gratuitas);
  const igv = parseDecimal(c.igv);
  const total = parseDecimal(c.total);
  const lineExtension = opGravadas + opExoneradas + opInafectas;

  const esNC = c.tipo_comprobante_id === "07";
  const rootElement = esNC ? "CreditNote" : "DebitNote";
  const xmlns = esNC
    ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
    : "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2";
  const typeCodeElement = esNC ? "cbc:CreditNoteTypeCode" : "cbc:DebitNoteTypeCode";
  const listIdCatalog = esNC ? "0901" : "1001";
  const tipoNota = c.tipo_nota_id || "01";

  const refXml = ref
    ? `<cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${ref.serie}-${String(ref.correlativo).padStart(8, "0")}</cbc:ID>
      <cbc:DocumentTypeCode>${ref.tipo_comprobante_id}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : "";

  const impuestosXml = buildImpuestosGlobales(opGravadas, opExoneradas, opInafectas, opGratuitas, igv, moneda);
  const lineas = detalles.map((d, i) => buildLineaNota(d, i + 1, moneda, esNC)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} xmlns="${xmlns}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">

  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${serieCorrelativo}</cbc:ID>
  <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>
  <cbc:IssueTime>${horaEmision}</cbc:IssueTime>
  <${typeCodeElement} listAgencyName="PE:SUNAT" listName="${esNC ? "Tipo de Nota de Credito" : "Tipo de Nota de Debito"}" listID="${listIdCatalog}">${tipoNota}</${typeCodeElement}>
  ${c.descripcion_nota ? `<cbc:Note languageLocaleID="2006">${esc(c.descripcion_nota)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>

  ${buildFirmaBlock(emisor)}
  ${refXml}
  ${buildEmisorBlock(emisor)}
  ${buildClienteBlock(tipoDocCliente, nroDocCliente, razonCliente)}

  ${impuestosXml}

  <cac:RequestedMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${moneda}">${lineExtension.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${moneda}">${opGravadas.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${moneda}">${total}</cbc:PayableAmount>
  </cac:RequestedMonetaryTotal>

  ${lineas}
</${rootElement}>`;
}

// ────────────────────────────────────────────────────────────────
// Funciones auxiliares
// ────────────────────────────────────────────────────────────────

function buildFirmaBlock(emisor) {
  return `<cac:Signature>
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
  </cac:Signature>`;
}

function buildEmisorBlock(emisor) {
  return `<cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${emisor.ruc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name><![CDATA[${emisor.nombre_comercial || emisor.razon_social}]]></cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:ID>${emisor.ubigeo || "000000"}</cbc:ID>
        <cbc:StreetName><![CDATA[${emisor.direccion || ""}]]></cbc:StreetName>
        <cbc:CitySubdivisionName>${esc(emisor.distrito || "")}</cbc:CitySubdivisionName>
        <cbc:CityName>${esc(emisor.provincia || "")}</cbc:CityName>
        <cbc:CountrySubentity>${esc(emisor.departamento || "")}</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>${emisor.pais || "PE"}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${emisor.razon_social}]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

function buildClienteBlock(tipoDoc, nroDoc, razonSocial) {
  return `<cac:AccountingCustomerParty>
    <cbc:CustomerAssignedAccountID>${nroDoc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>${tipoDoc}</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${razonSocial}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

function buildCuotas(cuotas, moneda, totalPagar) {
  const cuotaTotal = `<cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${parseDecimal(totalPagar).toFixed(2)}</cbc:Amount>
  </cac:PaymentTerms>`;

  const detalleCuotas = cuotas.map((q) => `<cac:PaymentTerms>
    <cbc:ID>Cuota${String(q.numero).padStart(3, "0")}</cbc:ID>
    <cbc:PaymentMeansID>Cuota</cbc:PaymentMeansID>
    <cbc:Amount currencyID="${moneda}">${parseDecimal(q.importe).toFixed(2)}</cbc:Amount>
    <cbc:PaymentDueDate>${formatDate(q.fecha_vencimiento)}</cbc:PaymentDueDate>
  </cac:PaymentTerms>`).join("\n");

  return cuotaTotal + "\n" + detalleCuotas;
}

function buildImpuestosGlobales(opGravadas, opExoneradas, opInafectas, opGratuitas, igv, moneda) {
  const subtotales = [];

  if (opGravadas > 0) {
    subtotales.push(`<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${opGravadas.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">${igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`);
  }

  if (opExoneradas > 0) {
    subtotales.push(`<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${opExoneradas.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>9997</cbc:ID>
          <cbc:Name>EXO</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`);
  }

  if (opInafectas > 0) {
    subtotales.push(`<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${moneda}">${opInafectas.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${moneda}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>9998</cbc:ID>
          <cbc:Name>INA</cbc:Name>
          <cbc:TaxTypeCode>FRE</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`);
  }

  return `<cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${igv.toFixed(2)}</cbc:TaxAmount>
    ${subtotales.join("\n")}
  </cac:TaxTotal>`;
}

function buildLinea(d, numero, moneda) {
  const producto = d.Producto || {};
  const tipoAfec = producto.TipoAfectacion || {};
  const unidad = producto.Unidad || {};

  const cantidad = parseDecimal(d.cantidad);
  const valorUnitario = parseDecimal(d.valor_unitario);
  const precioUnitario = parseDecimal(d.precio_unitario);
  const igvLinea = parseDecimal(d.igv);
  const porcentajeIgv = parseDecimal(d.porcentaje_igv) || 18;
  const valorTotal = parseDecimal(d.valor_total);
  const importeTotal = parseDecimal(d.importe_total);

  // Código de tipo de afectación (catálogo 07): 10=gravado, 20=exo, 30=ina, 40=gratuito...
  const codAfec = tipoAfec.codigo || "10";
  // Código del tributo según tipo de afectación
  const { tributoId, tributoNombre, tributoTipo } = mapTributo(codAfec);

  return `<cac:InvoiceLine>
    <cbc:ID>${numero}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unidad.id || "NIU"}">${cantidad.toFixed(6)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${moneda}">${valorTotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${precioUnitario.toFixed(6)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${igvLinea.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${valorTotal.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${igvLinea.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${porcentajeIgv.toFixed(2)}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${codAfec}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>${tributoId}</cbc:ID>
            <cbc:Name>${tributoNombre}</cbc:Name>
            <cbc:TaxTypeCode>${tributoTipo}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description><![CDATA[${producto.nombre || d.descripcion || ""}]]></cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>${producto.codigo_sunat || String(numero)}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${valorUnitario.toFixed(6)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
}

function buildLineaNota(d, numero, moneda, esNC) {
  // Para NC/ND el elemento raíz de línea cambia
  const lineTag = esNC ? "cac:CreditNoteLine" : "cac:DebitNoteLine";
  const producto = d.Producto || {};
  const tipoAfec = producto.TipoAfectacion || {};
  const unidad = producto.Unidad || {};

  const cantidad = parseDecimal(d.cantidad);
  const valorUnitario = parseDecimal(d.valor_unitario);
  const precioUnitario = parseDecimal(d.precio_unitario);
  const igvLinea = parseDecimal(d.igv);
  const porcentajeIgv = parseDecimal(d.porcentaje_igv) || 18;
  const valorTotal = parseDecimal(d.valor_total);
  const codAfec = tipoAfec.codigo || "10";
  const { tributoId, tributoNombre, tributoTipo } = mapTributo(codAfec);

  return `<${lineTag}>
    <cbc:ID>${numero}</cbc:ID>
    <cbc:CreditedQuantity unitCode="${unidad.id || "NIU"}">${cantidad.toFixed(6)}</cbc:CreditedQuantity>
    <cbc:LineExtensionAmount currencyID="${moneda}">${valorTotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="${moneda}">${precioUnitario.toFixed(6)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${moneda}">${igvLinea.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${moneda}">${valorTotal.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${moneda}">${igvLinea.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${porcentajeIgv.toFixed(2)}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${codAfec}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>${tributoId}</cbc:ID>
            <cbc:Name>${tributoNombre}</cbc:Name>
            <cbc:TaxTypeCode>${tributoTipo}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description><![CDATA[${producto.nombre || ""}]]></cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${moneda}">${valorUnitario.toFixed(6)}</cbc:PriceAmount>
    </cac:Price>
  </${lineTag}>`;
}

function mapTributo(codigoAfec) {
  // Catálogo 07 SUNAT → tributo correspondiente
  const cod = parseInt(codigoAfec, 10);
  if (cod >= 10 && cod <= 16) return { tributoId: "1000", tributoNombre: "IGV", tributoTipo: "VAT" };
  if (cod >= 20 && cod <= 21) return { tributoId: "9997", tributoNombre: "EXO", tributoTipo: "VAT" };
  if (cod >= 30 && cod <= 36) return { tributoId: "9998", tributoNombre: "INA", tributoTipo: "FRE" };
  if (cod >= 40 && cod <= 49) return { tributoId: "9996", tributoNombre: "GRA", tributoTipo: "FRE" };
  return { tributoId: "1000", tributoNombre: "IGV", tributoTipo: "VAT" };
}

function mapTipoDoc(tipoDocId) {
  const map = { "1": "1", "4": "4", "6": "6", "7": "7", "A": "A", "0": "0", "-": "0" };
  return map[tipoDocId] || "1";
}

function parseDecimal(val) {
  return parseFloat(val || 0);
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function formatTime(d) {
  if (!d) return "00:00:00";
  return new Date(d).toISOString().split("T")[1].split(".")[0];
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { build, buildNota };
