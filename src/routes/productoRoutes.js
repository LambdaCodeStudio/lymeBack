// src/routes/productoRoutes.js
const express = require('express');
const productoController = require('../controllers/productoController');
const router = express.Router();

router.get('/', productoController.obtenerTodos);
router.get('/:id', productoController.obtenerPorId);
router.post('/', productoController.crearProducto);
router.put('/:id', productoController.actualizarProducto);
router.delete('/:id', productoController.eliminarProducto);
router.post('/:id/vender', productoController.venderProducto);
router.post('/:id/cancelar-venta', productoController.cancelarVenta);

module.exports = router;