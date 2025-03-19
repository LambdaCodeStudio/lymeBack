const express = require('express');
const pedidoController = require('../controllers/pedidoController');

const router = express.Router();

// Ruta base para obtener todos los pedidos
router.get('/', pedidoController.getPedidos);

// Rutas específicas - IMPORTANTE: deben ir ANTES de las rutas con parámetros variables
router.get('/fecha', pedidoController.getPedidosByFecha);
router.get('/ordenados', pedidoController.getPedidosOrdenados);
router.get('/estado/:estado', pedidoController.getPedidosByEstado);

// Rutas con parámetros variables
router.get('/user/:userId', pedidoController.getPedidosByUserId);
router.get('/servicio/:servicio', pedidoController.getPedidosByServicio);

// porque /:id capturará cualquier ruta como "/fecha", "/ordenados", etc.
router.get('/:id', pedidoController.getPedidoById);

// Rutas para modificación de pedidos
router.post('/', pedidoController.createPedido);
router.put('/:id', pedidoController.updatePedido);
router.delete('/:id', pedidoController.deletePedido);

router.get('/cliente/:clienteId', pedidoController.getPedidosByClienteId);

module.exports = router;


