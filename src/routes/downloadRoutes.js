// src/routes/downloadRoutes.js
const express = require('express');
const downloadController = require('../controllers/downloadController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Descargar remito PDF
router.get('/remito/:id', downloadController.downloadRemito);

// Descargar reporte Excel
router.get('/excel', downloadController.downloadExcel);

module.exports = router;