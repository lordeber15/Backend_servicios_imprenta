const { Router } = require("express");
const {
  getEnvio_resumen,
  createEnvio_resumen,
  deleteEnvio_resumen,
  updateEnvio_resumen,
} = require("../../controllers/facturacion/envio_resumen.controller");
const router = Router();

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
router.post("/envio_resumen", createEnvio_resumen);

/**
 * @swagger
 * /envio_resumen/{id}:
 *   delete:
 *     summary: Eliminar registro de envío de resumen
 *     tags: [SUNAT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro eliminado
 */
router.delete("/envio_resumen/:id", deleteEnvio_resumen);
router.put("/envio_resumen/:id", updateEnvio_resumen);

module.exports = router;
