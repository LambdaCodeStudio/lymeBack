const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const auth = require('../middleware/auth'); // Importamos el middleware de autenticación

router.use(auth);

router.get('/', clienteController.getClientes);
router.get('/:id', clienteController.getClienteById);
router.get('/user/:userId', clienteController.getClientesByUserId);  
router.post('/', clienteController.createCliente);
router.put('/:id', clienteController.updateCliente);
router.delete('/:id', clienteController.deleteCliente);

module.exports = router;