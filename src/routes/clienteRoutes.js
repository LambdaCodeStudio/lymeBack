// src/routes/clienteRoutes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { auth } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId'); // Asumiendo que existe este middleware

// Aplicar middleware de autenticación a todas las rutas si es necesario
// router.use(auth);

// Rutas principales para clientes
router.get('/', clienteController.getClientes);
router.get('/sin-asignar', clienteController.getClientesSinAsignar);
router.get('/estructurados', clienteController.getClientesEstructurados);
router.get('/user/:userId', validateObjectId('userId'), clienteController.getClientesByUserId);  

// NUEVAS RUTAS PARA SUPERVISORES
router.get('/supervisor/:supervisorId', validateObjectId('supervisorId'), clienteController.getClientesBySupervisorId);
router.get('/subservicios/supervisor/:supervisorId', validateObjectId('supervisorId'), clienteController.getSubServiciosBySupervisorId);
router.get('/subservicios/sin-supervisor', clienteController.getSubServiciosSinSupervisor);

// Ruta para obtener un cliente específico
router.get('/:id', validateObjectId('id'), clienteController.getClienteById);

// Rutas para CRUD de clientes
router.post('/', clienteController.createCliente);
router.put('/:id', validateObjectId('id'), clienteController.updateCliente);
router.delete('/:id', validateObjectId('id'), clienteController.deleteCliente);

// Rutas para subservicios
router.post('/:clienteId/subservicio', validateObjectId('clienteId'), clienteController.addSubServicio);
router.put('/:clienteId/subservicio/:subServicioId', 
    [validateObjectId('clienteId'), validateObjectId('subServicioId')], 
    clienteController.updateSubServicio);
router.delete('/:clienteId/subservicio/:subServicioId', 
    [validateObjectId('clienteId'), validateObjectId('subServicioId')], 
    clienteController.deleteSubServicio);

// NUEVAS RUTAS PARA ASIGNACIÓN DE SUPERVISORES A SUBSERVICIOS
router.post('/:clienteId/subservicio/:subServicioId/supervisor', 
    [validateObjectId('clienteId'), validateObjectId('subServicioId')], 
    clienteController.assignSupervisorToSubServicio);
router.delete('/:clienteId/subservicio/:subServicioId/supervisor', 
    [validateObjectId('clienteId'), validateObjectId('subServicioId')], 
    clienteController.removeSupervisorFromSubServicio);

// Rutas para sububicaciones
router.post('/:clienteId/subservicio/:subServicioId/sububicacion', 
    [validateObjectId('clienteId'), validateObjectId('subServicioId')], 
    clienteController.addSubUbicacion);
router.put('/:clienteId/subservicio/:subServicioId/sububicacion/:subUbicacionId', 
    [validateObjectId('clienteId'), validateObjectId('subServicioId'), validateObjectId('subUbicacionId')], 
    clienteController.updateSubUbicacion);
router.delete('/:clienteId/subservicio/:subServicioId/sububicacion/:subUbicacionId', 
    [validateObjectId('clienteId'), validateObjectId('subServicioId'), validateObjectId('subUbicacionId')], 
    clienteController.deleteSubUbicacion);

module.exports = router;