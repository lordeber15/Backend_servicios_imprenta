/**
 * @swagger
 * tags:
 *   name: Configuración
 *   description: Parámetros del sistema (Series, Emisor, Correlativos)
 */

const { Router } = require("express");
const SerieModel = require("../../../database/models/facturacion/serie");
const soloCampos = require("../../middleware/soloCampos");
const {
  getSerie,
  createSerie,
  deleteSerie,
  updateSerie,
} = require("../../controllers/facturacion/serie.controller");
const router = Router();

/**
 * @swagger
 * /serie:
 *   get:
 *     summary: Listar todas las series configuradas
 *     tags: [Configuración]
 *     responses:
 *       200:
 *         description: Lista de series
 */
router.get("/serie", getSerie);
router.post("/serie", soloCampos(SerieModel), createSerie);

/**
 * @swagger
 * /serie/{id}:
 *   delete:
 *     summary: Eliminar una serie
 *     tags: [Configuración]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Serie eliminada
 */
router.delete("/serie/:id", deleteSerie);
router.put("/serie/:id", soloCampos(SerieModel, { excluir: ["correlativo"] }), updateSerie);

module.exports = router;
