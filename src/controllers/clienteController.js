// src/controllers/clienteController.js
const Cliente = require('../models/clienteSchema');
const clienteLogic = require('../logic/clienteLogic');
const mongoose = require('mongoose');

// Obtener todos los clientes
exports.getClientes = async (req, res) => {
    try {
        // Obtener todos los clientes, incluyendo aquellos con referencia a usuarios que ya no existen
        const clientes = await clienteLogic.obtenerClientes();
        
        // Procesar los clientes para marcar aquellos que necesitan reasignación
        const clientesProcesados = clientes.map(cliente => {
            const clienteObj = cliente.toObject();
            
            // Verificar si el userId existe y es una referencia válida
            const necesitaReasignacion = !cliente.userId || 
                (typeof cliente.userId === 'object' && cliente.userId.isActive === false);
            
            if (necesitaReasignacion) {
                clienteObj.requiereAsignacion = true;
            }
            
            return clienteObj;
        });
        
        res.json(clientesProcesados);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ mensaje: 'Error al obtener clientes', error: error.message });
    }
};

// Obtener cliente por ID
exports.getClienteById = async (req, res) => {
    try {
        const cliente = await clienteLogic.obtenerClientePorId(req.params.id);
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        // Verificar si requiere reasignación
        const clienteObj = cliente.toObject();
        const necesitaReasignacion = !cliente.userId || 
            (typeof cliente.userId === 'object' && cliente.userId.isActive === false);
        
        if (necesitaReasignacion) {
            clienteObj.requiereAsignacion = true;
        }
        
        res.json(clienteObj);
    } catch (error) {
        console.error('Error al obtener cliente por id:', error);
        res.status(500).json({ mensaje: 'Error al obtener cliente', error: error.message });
    }
};

// Obtener clientes por ID de usuario
exports.getClientesByUserId = async (req, res) => {
    try {
        // Validar que el ID de usuario sea un ObjectId válido
        const userId = req.params.userId;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ mensaje: 'ID de usuario inválido' });
        }

        // Buscar clientes asociados al userId
        const clientes = await clienteLogic.obtenerClientesPorUserId(userId);
        
        // Procesar los clientes para verificar si requieren reasignación
        const clientesProcesados = clientes.map(cliente => {
            const clienteObj = cliente.toObject();
            
            // Verificar si el userId existe y es una referencia válida
            const necesitaReasignacion = !cliente.userId || 
                (typeof cliente.userId === 'object' && cliente.userId.isActive === false);
            
            if (necesitaReasignacion) {
                clienteObj.requiereAsignacion = true;
            }
            
            return clienteObj;
        });
        
        res.json(clientesProcesados);
    } catch (error) {
        console.error('Error al obtener clientes por userId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener clientes', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Crear nuevo cliente
exports.createCliente = async (req, res) => {
    try {
        // Validar campos requeridos
        if (!req.body.nombre) {
            return res.status(400).json({ mensaje: 'El nombre del cliente es requerido' });
        }
        
        // Crear objeto de cliente con los campos requeridos y opcionales
        const clienteData = {
            nombre: req.body.nombre,
            descripcion: req.body.descripcion || '',
            servicio: req.body.servicio || req.body.nombre, // Mantener compatibilidad
            seccionDelServicio: req.body.seccionDelServicio || '',
            userId: req.body.userId,
            subServicios: req.body.subServicios || [],
            direccion: req.body.direccion || '',
            telefono: req.body.telefono || '',
            email: req.body.email || '',
            activo: req.body.activo !== undefined ? req.body.activo : true
        };
        
        // Crear el cliente
        const cliente = await clienteLogic.crearCliente(clienteData);
        
        // Devolver el cliente con información de usuario poblada
        const clienteCreado = await clienteLogic.obtenerClientePorId(cliente._id);
        
        res.status(201).json(clienteCreado);
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ mensaje: 'Error al crear cliente', error: error.message });
    }
};

// Actualizar cliente
exports.updateCliente = async (req, res) => {
    try {
        // Verificar que el cliente exista
        const clienteExistente = await clienteLogic.obtenerClientePorId(req.params.id);
        if (!clienteExistente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        // Preparar datos de actualización
        const clienteData = {};
        
        // Solo actualizar los campos que vienen en la petición
        if (req.body.nombre !== undefined) clienteData.nombre = req.body.nombre;
        if (req.body.descripcion !== undefined) clienteData.descripcion = req.body.descripcion;
        if (req.body.servicio !== undefined) clienteData.servicio = req.body.servicio;
        if (req.body.seccionDelServicio !== undefined) clienteData.seccionDelServicio = req.body.seccionDelServicio;
        if (req.body.userId !== undefined) clienteData.userId = req.body.userId;
        if (req.body.subServicios !== undefined) clienteData.subServicios = req.body.subServicios;
        if (req.body.direccion !== undefined) clienteData.direccion = req.body.direccion;
        if (req.body.telefono !== undefined) clienteData.telefono = req.body.telefono;
        if (req.body.email !== undefined) clienteData.email = req.body.email;
        if (req.body.activo !== undefined) clienteData.activo = req.body.activo;
        
        // Actualizar el cliente
        const clienteActualizado = await clienteLogic.actualizarCliente(req.params.id, clienteData);
        
        res.json(clienteActualizado);
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ mensaje: 'Error al actualizar cliente', error: error.message });
    }
};

// Eliminar cliente
exports.deleteCliente = async (req, res) => {
    try {
        const resultado = await clienteLogic.eliminarCliente(req.params.id);
        
        if (!resultado) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ mensaje: 'Error al eliminar cliente', error: error.message });
    }
};

// Obtener clientes sin asignar (sin userId o con usuario inactivo)
exports.getClientesSinAsignar = async (req, res) => {
    try {
        // Obtener referencia a usuarios inactivos
        const User = mongoose.model('User');
        const usuariosInactivos = await User.find({ isActive: false }, '_id').exec();
        const idsInactivos = usuariosInactivos.map(u => u._id);
        
        // Obtener clientes sin asignar usando la lógica centralizada
        const { clientesSinUsuario, clientesUsuarioInactivo } = await clienteLogic.obtenerClientesSinAsignar(idsInactivos);
        
        // Combinar y procesar los resultados
        const todosClientesSinAsignar = [
            ...clientesSinUsuario.map(c => {
                const clienteObj = c.toObject();
                clienteObj.requiereAsignacion = true;
                return clienteObj;
            }),
            ...clientesUsuarioInactivo.map(c => {
                const clienteObj = c.toObject();
                clienteObj.requiereAsignacion = true;
                return clienteObj;
            })
        ];
        
        res.json(todosClientesSinAsignar);
    } catch (error) {
        console.error('Error al obtener clientes sin asignar:', error);
        res.status(500).json({ mensaje: 'Error al obtener clientes sin asignar', error: error.message });
    }
};

// Agregar subservicio a un cliente
exports.addSubServicio = async (req, res) => {
    try {
        if (!req.body.nombre) {
            return res.status(400).json({ mensaje: 'El nombre del subservicio es requerido' });
        }
        
        const subServicioData = {
            nombre: req.body.nombre,
            descripcion: req.body.descripcion || '',
            subUbicaciones: req.body.subUbicaciones || []
        };
        
        const cliente = await clienteLogic.agregarSubServicio(req.params.clienteId, subServicioData);
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        res.status(201).json(cliente);
    } catch (error) {
        console.error('Error al agregar subservicio:', error);
        res.status(500).json({ mensaje: 'Error al agregar subservicio', error: error.message });
    }
};

// Actualizar subservicio
exports.updateSubServicio = async (req, res) => {
    try {
        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({ mensaje: 'No se proporcionaron datos para actualizar' });
        }
        
        const cliente = await clienteLogic.actualizarSubServicio(
            req.params.clienteId, 
            req.params.subServicioId, 
            req.body
        );
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente o subservicio no encontrado' });
        }
        
        res.json(cliente);
    } catch (error) {
        console.error('Error al actualizar subservicio:', error);
        res.status(500).json({ mensaje: 'Error al actualizar subservicio', error: error.message });
    }
};

// Eliminar subservicio
exports.deleteSubServicio = async (req, res) => {
    try {
        const cliente = await clienteLogic.eliminarSubServicio(
            req.params.clienteId, 
            req.params.subServicioId
        );
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente o subservicio no encontrado' });
        }
        
        res.json({ mensaje: 'Subservicio eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar subservicio:', error);
        res.status(500).json({ mensaje: 'Error al eliminar subservicio', error: error.message });
    }
};

// Agregar sububicación a un subservicio
exports.addSubUbicacion = async (req, res) => {
    try {
        if (!req.body.nombre) {
            return res.status(400).json({ mensaje: 'El nombre de la sububicación es requerido' });
        }
        
        const subUbicacionData = {
            nombre: req.body.nombre,
            descripcion: req.body.descripcion || ''
        };
        
        const cliente = await clienteLogic.agregarSubUbicacion(
            req.params.clienteId, 
            req.params.subServicioId, 
            subUbicacionData
        );
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente o subservicio no encontrado' });
        }
        
        res.status(201).json(cliente);
    } catch (error) {
        console.error('Error al agregar sububicación:', error);
        res.status(500).json({ mensaje: 'Error al agregar sububicación', error: error.message });
    }
};

// Actualizar sububicación
exports.updateSubUbicacion = async (req, res) => {
    try {
        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({ mensaje: 'No se proporcionaron datos para actualizar' });
        }
        
        const cliente = await clienteLogic.actualizarSubUbicacion(
            req.params.clienteId, 
            req.params.subServicioId, 
            req.params.subUbicacionId, 
            req.body
        );
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente, subservicio o sububicación no encontrado' });
        }
        
        res.json(cliente);
    } catch (error) {
        console.error('Error al actualizar sububicación:', error);
        res.status(500).json({ mensaje: 'Error al actualizar sububicación', error: error.message });
    }
};

// Eliminar sububicación
exports.deleteSubUbicacion = async (req, res) => {
    try {
        const cliente = await clienteLogic.eliminarSubUbicacion(
            req.params.clienteId, 
            req.params.subServicioId, 
            req.params.subUbicacionId
        );
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente, subservicio o sububicación no encontrado' });
        }
        
        res.json({ mensaje: 'Sububicación eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar sububicación:', error);
        res.status(500).json({ mensaje: 'Error al eliminar sububicación', error: error.message });
    }
};

// Obtener clientes en formato de corte de control (estructura plana)
exports.getClientesEstructurados = async (req, res) => {
    try {
        const clientesEstructurados = await clienteLogic.obtenerClientesEstructurados();
        res.json(clientesEstructurados);
    } catch (error) {
        console.error('Error al obtener clientes estructurados:', error);
        res.status(500).json({ mensaje: 'Error al obtener clientes estructurados', error: error.message });
    }
};