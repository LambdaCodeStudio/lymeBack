// src/routes/pedidoRoutes.js
const express = require('express');
const pedidoController = require('../controllers/pedidoController');
const auth = require('../middleware/auth'); // Asumiendo que existe un middleware de autenticación

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas si es necesario
// router.use(auth);

// =================== RUTAS DE CONSULTA ===================

// Ruta base para obtener todos los pedidos (con soporte para paginación)
router.get('/', pedidoController.getPedidos);

// Rutas para reportes y análisis
router.get('/corte-control', pedidoController.getPedidosCorteControl);
router.get('/estadisticas', pedidoController.getPedidosEstadisticas);

// Rutas para filtros específicos (DEBEN IR ANTES DE LAS RUTAS CON PARÁMETROS VARIABLES)
router.get('/fecha', pedidoController.getPedidosByFecha);
router.get('/ordenados', pedidoController.getPedidosOrdenados);
router.get('/estado/:estado', pedidoController.getPedidosByEstado);

// Rutas para filtro por usuario
router.get('/user/:userId', pedidoController.getPedidosByUserId);
router.get('/supervisor/:supervisorId', pedidoController.getPedidosBySupervisorId);

// Rutas para filtro por producto y servicio
router.get('/producto/:productoId', pedidoController.getPedidosByProducto);
router.get('/servicio/:servicio', pedidoController.getPedidosByServicio);

// Rutas para filtro por cliente
router.get('/cliente/:clienteId', pedidoController.getPedidosByCliente);

// =================== RUTAS DE MODIFICACIÓN ===================

// Crear nuevo pedido
router.post('/', pedidoController.createPedido);

// Actualizar pedido existente
router.put('/:id', pedidoController.updatePedido);

// Eliminar pedido
router.delete('/:id', pedidoController.deletePedido);

// =================== RUTAS DE CONSULTA POR ID ===================

// Ruta para obtener un pedido específico por ID
// Importante: esta ruta debe ir AL FINAL para evitar conflictos con otras rutas
router.get('/:id', pedidoController.getPedidoById);

module.exports = router;