// src/routes/downloadRoutes.js
const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');

/**
 * @route   GET /api/downloads/remito/:id
 * @desc    Descargar un remito en formato PDF
 * @access  Private
 */
router.get('/remito/:id', downloadController.downloadRemito);

/**
 * @route   GET /api/downloads/excel
 * @desc    Descargar un reporte Excel de pedidos por rango de fechas
 * @access  Private
 */
router.get('/excel', downloadController.downloadExcel);

/**
 * @route   GET /api/downloads/mensual/:month/:year
 * @desc    Descargar un reporte mensual
 * @access  Private
 */
router.get('/mensual/:month/:year', downloadController.downloadReporteMensual);

/**
 * @route   GET /api/downloads/reporte-mensual
 * @desc    Descargar un reporte mensual por rango de fechas
 * @access  Private
 */
router.get('/reporte-mensual', downloadController.downloadReporteMensual);

module.exports = router;