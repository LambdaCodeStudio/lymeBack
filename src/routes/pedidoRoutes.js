const express = require('express');
const pedidoController = require('../controllers/pedidoController');

const router = express.Router();

router.get('/', pedidoController.getPedidos);
router.get('/:id', pedidoController.getPedidoById);
router.get('/user/:userId', pedidoController.getPedidosByUserId);
router.get('/servicio/:servicio', pedidoController.getPedidosByServicio);
router.get('/fecha', pedidoController.getPedidosByFecha);
router.get('/ordenados', pedidoController.getPedidosOrdenados);

router.post('/', pedidoController.createPedido);
router.put('/:id', pedidoController.updatePedido);
router.delete('/:id', pedidoController.deletePedido);

module.exports = router;
