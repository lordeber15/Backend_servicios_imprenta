const { Router } = require("express");
const {
  getEmisor,
  createEmisor,
  deleteEmisor,
  updateEmisor,
  updateLogo,
} = require("../../controllers/facturacion/emisor.controller");
const { authorize } = require("../../middleware/authorize.middleware");
const { subirImagen } = require("../../middleware/subidaImagen");
const router = Router();

// GET queda para cualquier usuario autenticado: el frontend lo necesita
// para renderizar comprobantes. Las escrituras son datos fiscales → solo admin.
router.get("/emisor", getEmisor);
router.post("/emisor", authorize("Administrador"), createEmisor);

/**
 * @swagger
 * /emisor/{id}:
 *   delete:
 *     summary: Eliminar configuración de emisor
 *     tags: [Configuración]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Emisor eliminado
 */
router.delete("/emisor/:id", authorize("Administrador"), deleteEmisor);
router.put("/emisor/:id", authorize("Administrador"), updateEmisor);

// Logo de empresa: contenido validado por magic bytes y nombre aleatorio.
router.put("/emisor/:id/logo", authorize("Administrador"), ...subirImagen({ campo: "logo", carpeta: "empresa", prefijo: "logo" }), updateLogo);

module.exports = router;
