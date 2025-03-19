// src/routes/productoRoutes.js
const express = require('express');
const productoController = require('../controllers/productoController');
const router = express.Router();
const upload = require('../middleware/upload');

// Rutas básicas CRUD
router.get('/', productoController.obtenerTodos);
router.get('/:id', productoController.obtenerPorId);
router.post('/', productoController.crearProducto);
router.put('/:id', productoController.actualizarProducto);
router.delete('/:id', productoController.eliminarProducto);

// Rutas para ventas
router.post('/:id/vender', productoController.venderProducto);
router.post('/:id/cancelar-venta', productoController.cancelarVenta);

// Rutas para imágenes (formato binario/multipart)
router.post('/:id/imagen', upload.single('imagen'), productoController.uploadImagen);
router.get('/:id/imagen', productoController.getImagen);
router.delete('/:id/imagen', productoController.deleteImagen);

// Nuevas rutas para imágenes en formato base64
router.post('/:id/imagen-base64', productoController.uploadImagenBase64);
router.get('/:id/imagen-base64', productoController.getImagenBase64);

//Rutas de stock bajo
router.get('/stats/lowstock', productoController.getStockStats);

module.exports = router;