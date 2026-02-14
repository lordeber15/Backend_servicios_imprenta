/**
 * GENERADOR DE XML: GUÍA DE REMISIÓN
 * 
 * Este módulo construye el XML UBL 2.1 (DespatchAdvice) para guías de remisión
 * de remitente (tipo 09) y transportista (tipo 31).
 * 
 * @module services/sunat/xmlBuilders/guiaRemisionBuilder
 */

/**
 * Genera el XML UBL 2.1 DespatchAdvice para:
 *  - Guía de Remisión Remitente (tipo 09)
 *  - Guía de Remisión Transportista (tipo 31)
 *
 * Usa un schema diferente al de Invoice: DespatchAdvice-2
 * y se envía al WS de Guías (SUNAT_WS_GUIAS).
 *
 * @param {object} guia  Instancia del modelo GuiaRemision con:
 *   - Emisor, Destinatario (Cliente), DetalleGuias (+ Unidad),
 *     ComprobanteRelacionado (opcional)
 * @returns {string}  XML sin firma
 */
function build(guia) {
  const g = guia;
  const emisor = g.Emisor;
  const destinatario = g.Destinatario || {};
  const detalles = g.DetalleGuias || [];

  const correlativoStr = String(g.correlativo).padStart(8, "0");
  const serieCorrelativo = `${g.serie}-${correlativoStr}`;
  const fechaEmision = formatDate(g.fecha_emision);
  const fechaTraslado = formatDate(g.fecha_traslado);

  // Referencia al comprobante de venta (opcional)
  const refComprobanteXml = g.ComprobanteRelacionado
    ? `<cac:OrderReference>
      <cbc:ID>${g.ComprobanteRelacionado.serie}-${String(g.ComprobanteRelacionado.correlativo).padStart(8, "0")}</cbc:ID>
    </cac:OrderReference>`
    : "";

  const lineas = detalles.map((d, i) => buildLinea(d, i + 1)).join("\n");

  // Datos del transportista (modalidad pública)
  const transportistaXml =
    g.modalidad_traslado === "01" && g.transportista_ruc
      ? `<cac:CarrierParty>
        <cac:PartyIdentification>
          <cbc:ID schemeID="6">${g.transportista_ruc}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name><![CDATA[${g.transportista_razon_social || ""}]]></cbc:Name>
        </cac:PartyName>
        ${g.mtc_numero ? `<cac:PartyLegalEntity><cbc:RegistrationName>${g.mtc_numero}</cbc:RegistrationName></cac:PartyLegalEntity>` : ""}
      </cac:CarrierParty>`
      : "";

  // Datos del conductor (modalidad privada o guía transportista)
  const conductorXml =
    g.conductor_nrodoc
      ? `<cac:DriverPerson>
        <cbc:ID schemeID="${g.conductor_tipo_doc || "1"}">${g.conductor_nrodoc}</cbc:ID>
        <cbc:FirstName><![CDATA[${g.conductor_nombres || ""}]]></cbc:FirstName>
        <cbc:JobTitle>${g.conductor_licencia || ""}</cbc:JobTitle>
      </cac:DriverPerson>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<DespatchAdvice
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
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
  <cbc:IssueTime>00:00:00</cbc:IssueTime>
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listID="0">${g.tipo_guia}</cbc:DespatchAdviceTypeCode>
  <cbc:Note><![CDATA[${g.descripcion_motivo || "Traslado de bienes"}]]></cbc:Note>

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

  ${refComprobanteXml}

  <cac:Shipment>
    <cbc:ID>SUNAT_Envio</cbc:ID>
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de Traslado" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20">${g.motivo_traslado_id || "01"}</cbc:HandlingCode>
    <cbc:Information><![CDATA[${g.descripcion_motivo || "Venta"}]]></cbc:Information>
    <cbc:GrossWeightMeasure unitCode="${g.unidad_peso_id || "KGM"}">${parseDecimal(g.peso_bruto_total).toFixed(3)}</cbc:GrossWeightMeasure>
    <cbc:TotalTransportHandlingUnitQuantity>${g.numero_bultos || 1}</cbc:TotalTransportHandlingUnitQuantity>
    ${g.indicador_transborde ? "<cbc:SplitConsignmentIndicator>true</cbc:SplitConsignmentIndicator>" : ""}
    ${g.numero_contenedor ? `<cbc:ShippingMarks>${g.numero_contenedor}</cbc:ShippingMarks>` : ""}

    <cac:ShipmentStage>
      <cbc:TransportModeCode>${g.modalidad_traslado || "02"}</cbc:TransportModeCode>
      <cac:TransitPeriod>
        <cbc:StartDate>${fechaTraslado}</cbc:StartDate>
      </cac:TransitPeriod>
      ${transportistaXml}
      ${conductorXml}
      ${g.vehiculo_placa ? `<cac:TransportMeans><cac:RoadTransport><cbc:LicensePlateID>${g.vehiculo_placa}</cbc:LicensePlateID></cac:RoadTransport></cac:TransportMeans>` : ""}
    </cac:ShipmentStage>

    <cac:Delivery>
      <cac:DeliveryAddress>
        <cbc:ID>${g.ubigeo_llegada || "000000"}</cbc:ID>
        <cbc:StreetName><![CDATA[${g.direccion_llegada || ""}]]></cbc:StreetName>
      </cac:DeliveryAddress>
    </cac:Delivery>

    <cac:OriginAddress>
      <cbc:ID>${g.ubigeo_partida || "000000"}</cbc:ID>
      <cbc:StreetName><![CDATA[${g.direccion_partida || ""}]]></cbc:StreetName>
    </cac:OriginAddress>
  </cac:Shipment>

  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${mapTipoDoc(destinatario.tipo_documento_id)}">${destinatario.nrodoc || ""}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${destinatario.razon_social || ""}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>

  <cac:SellerSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${emisor.razon_social}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:SellerSupplierParty>

  ${lineas}
</DespatchAdvice>`;
}

function buildLinea(d, numero) {
  const unidad = d.Unidad || {};
  const cantidad = parseDecimal(d.cantidad);

  return `<cac:DespatchLine>
    <cbc:ID>${numero}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${unidad.id || "NIU"}">${cantidad.toFixed(6)}</cbc:DeliveredQuantity>
    ${d.numero_serie ? `<cbc:Note>${d.numero_serie}</cbc:Note>` : ""}
    <cac:Item>
      <cbc:Description><![CDATA[${d.descripcion || ""}]]></cbc:Description>
      ${d.codigo_sunat ? `<cac:SellersItemIdentification><cbc:ID>${d.codigo_sunat}</cbc:ID></cac:SellersItemIdentification>` : ""}
    </cac:Item>
  </cac:DespatchLine>`;
}

function mapTipoDoc(id) {
  const map = { "1": "1", "4": "4", "6": "6", "7": "7" };
  return map[id] || "6";
}

function parseDecimal(val) {
  return parseFloat(val || 0);
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

module.exports = { build };
