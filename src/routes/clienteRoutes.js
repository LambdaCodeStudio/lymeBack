const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

router.get('/', clienteController.getClientes);
router.get('/sin-asignar', clienteController.getClientesSinAsignar); // Nueva ruta para clientes sin asignar
router.get('/user/:userId', clienteController.getClientesByUserId);  
router.get('/:id', clienteController.getClienteById);
router.post('/', clienteController.createCliente);
router.put('/:id', clienteController.updateCliente);
router.delete('/:id', clienteController.deleteCliente);

module.exports = router;