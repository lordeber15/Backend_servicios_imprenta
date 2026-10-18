const { Router } = require("express");
const {
  getEnvio_resumen,
  createEnvio_resumen,
  deleteEnvio_resumen,
  updateEnvio_resumen,
} = require("../../controllers/facturacion/envio_resumen.controller");
const router = Router();

// Solo lectura: estas filas las escriben la emisión, el resumen diario y la
// baja. Un CRUD crudo permitiría falsear estados y tickets de SUNAT.

/**
 * @swagger
 * /envio_resumen:
 *   get:
 *     summary: Listar envíos de resumen realizados
 *     tags: [SUNAT]
 *     responses:
 *       200:
 *         description: Lista de envíos
 */
router.get("/envio_resumen", getEnvio_resumen);


module.exports = router;
