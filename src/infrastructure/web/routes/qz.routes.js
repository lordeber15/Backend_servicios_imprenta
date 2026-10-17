const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

// Llaves QZ generadas por OpenSSL. Viven en storage/keys/ (volumen montado,
// igual que el certificado SUNAT) y NO se hornean en la imagen Docker: quien
// obtenga la imagen no obtiene la llave privada. Ruta configurable con QZ_KEYS_DIR.
const KEYS_DIR = path.resolve(process.cwd(), process.env.QZ_KEYS_DIR || 'storage/keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'qz-private-key.pem');
const PUBLIC_CERT_PATH = path.join(KEYS_DIR, 'qz-public-cert.crt');

/**
 * @route GET /qz/certificate
 * @desc Devuelve el certificado público (.crt) en texto plano para que QZ Tray confíe en este dominio
 */
router.get('/certificate', (req, res) => {
  try {
    const cert = fs.readFileSync(PUBLIC_CERT_PATH, 'utf8');
    res.type('text/plain').send(cert);
  } catch (error) {
    console.error('Error leyendo el certificado público de QZ:', error);
    res.status(500).send('Error interno leyendo certificado público');
  }
});

/**
 * @route POST /api/qz/sign
 * @desc Recibe una cadena de QZ Tray y la firma usando la llave privada RSA
 */
router.post('/sign', (req, res) => {
  try {
    const { toSign } = req.body || {};
    
    if (!toSign) {
      return res.status(400).type("text/plain").send('Missing toSign format');
    }

    // Leemos la llave privada
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

    // Firmar con SHA512 según estándar estricto de QZ Tray
    const signer = crypto.createSign('RSA-SHA512');
    signer.update(toSign, 'utf8');
    signer.end();

    const signature = signer.sign(privateKey, 'base64');
    
    // Es CRÍTICO hacer un .trim() para evitar que saltos de línea invaliden la firma en el frontend
    res.type('text/plain').send(signature.trim());
  } catch (error) {
    console.error('Error firmando la petición de QZ:', error);
    res.status(500).type("text/plain").send('Error interno firmando petición');
  }
});

module.exports = router;
