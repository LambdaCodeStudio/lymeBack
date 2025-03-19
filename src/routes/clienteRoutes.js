// src/routes/clienteRoutes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

// Rutas principales para clientes
router.get('/', clienteController.getClientes);
router.get('/sin-asignar', clienteController.getClientesSinAsignar);
router.get('/estructurados', clienteController.getClientesEstructurados); // Nueva ruta para corte de control
router.get('/user/:userId', clienteController.getClientesByUserId);  
router.get('/:id', clienteController.getClienteById);
router.post('/', clienteController.createCliente);
router.put('/:id', clienteController.updateCliente);
router.delete('/:id', clienteController.deleteCliente);

// Rutas para subservicios
router.post('/:clienteId/subservicio', clienteController.addSubServicio);
router.put('/:clienteId/subservicio/:subServicioId', clienteController.updateSubServicio);
router.delete('/:clienteId/subservicio/:subServicioId', clienteController.deleteSubServicio);

// Rutas para sububicaciones
router.post('/:clienteId/subservicio/:subServicioId/sububicacion', clienteController.addSubUbicacion);
router.put('/:clienteId/subservicio/:subServicioId/sububicacion/:subUbicacionId', clienteController.updateSubUbicacion);
router.delete('/:clienteId/subservicio/:subServicioId/sububicacion/:subUbicacionId', clienteController.deleteSubUbicacion);

module.exports = router;