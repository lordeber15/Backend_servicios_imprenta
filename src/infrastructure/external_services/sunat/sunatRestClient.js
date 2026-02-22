/**
 * CLIENTE REST PARA SUNAT (OAUTH2)
 *
 * Este módulo maneja todas las comunicaciones REST con los Web Services de SUNAT.
 * Es obligatorio para el envío de Guías de Remisión (GRE) a partir de 2023.
 */

const axios = require('axios');
const AdmZip = require('adm-zip');
const crypto = require('crypto');

/**
 * Obtiene un token oAuth 2.0 de SUNAT
 *
 * @param {Object} emisor Instancia del modelo Emisor
 * @returns {Promise<string>} Access Token
 */
async function getAccessToken(emisor) {
  const url = `https://api-seguridad.sunat.gob.pe/v1/clientessol/${emisor.client_id}/oauth2/token/`;
  
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('scope', 'https://api-cpe.sunat.gob.pe');
  params.append('client_id', emisor.client_id);
  params.append('client_secret', emisor.client_secret);
  params.append('username', `${emisor.ruc}${emisor.usuario_sol}`);
  params.append('password', emisor.clave_sol);

  try {
    const response = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000 
    });
    return response.data.access_token;
  } catch (error) {
    if (error.response) {
      throw new Error(`Error en auth SUNAT: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Error red auth SUNAT: ${error.message}`);
  }
}

/**
 * sendGuiaRest — Envío SÍNCRONO/ASINCRONO de Guías vía REST API.
 *
 * @param {Buffer} xmlBuffer       XML firmado como Buffer UTF-8
 * @param {string} nombreArchivo   Nombre sin extensión (ej: 20123-09-T001-001)
 * @param {object} emisor          Instancia del modelo Emisor
 * @returns {Object} { ticket: string, error: object, cdrBase64: string }
 */
async function sendGuiaRest(xmlBuffer, nombreArchivo, emisor) {
  if (!emisor.client_id || !emisor.client_secret) {
    throw new Error('El emisor no tiene configurado el Client ID o Client Secret para guías de remisión.');
  }

  const token = await getAccessToken(emisor);

  // Crear el archivo ZIP en memoria
  const zip = new AdmZip();
  zip.addFile(`${nombreArchivo}.xml`, xmlBuffer);
  const zipBuffer = zip.toBuffer();

  const zipBase64 = zipBuffer.toString('base64');
  const zipHash = crypto.createHash('sha256').update(zipBuffer).digest('base64');

  const payload = {
    archivo: {
      nomArchivo: `${nombreArchivo}.zip`,
      arcGreZip: zipBase64,
      hashZip: zipHash,
    }
  };

  const isBeta = process.env.SUNAT_ENV === 'beta' || process.env.SUNAT_WS_FACTURAS?.includes('beta');
  const baseUrl = isBeta 
    ? 'https://gre-test.sunat.gob.pe' 
    : 'https://api-cpe.sunat.gob.pe';
  
  const endpointUrl = `${baseUrl}/v1/contribuyente/gem/comprobantes/${nombreArchivo}`;

  try {
    const response = await axios.post(endpointUrl, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });
    
    // Si status es 200, devuelve ticket de recepcion asincrona, o a veces CDR directamente segun la url
    return response.data;
  } catch (error) {
    if (error.response) {
      const respData = error.response.data;
      throw new Error(`Error enviando Guía (REST): ${respData.cod} - ${respData.msg}`);
    }
    throw new Error(`Error de conexión con API de guías: ${error.message}`);
  }
}

/**
 * Consulta el ticket de una guía mediante REST
 */
async function getTicketStatus(ticket, emisor) {
  const token = await getAccessToken(emisor);
  
  const isBeta = process.env.SUNAT_ENV === 'beta' || process.env.SUNAT_WS_FACTURAS?.includes('beta');
  const baseUrl = isBeta 
    ? 'https://gre-test.sunat.gob.pe' 
    : 'https://api-cpe.sunat.gob.pe';
    
  const endpointUrl = `${baseUrl}/v1/contribuyente/gem/comprobantes/envios/${ticket}`;

  try {
    const response = await axios.get(endpointUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    return response.data; // { codRespuesta, arcCdr, error }
  } catch (error) {
    if (error.response) {
      throw new Error(`Error en consulta de ticket REST: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Error de conexión con SUNAT: ${error.message}`);
  }
}

module.exports = {
  getAccessToken,
  sendGuiaRest,
  getTicketStatus
};
