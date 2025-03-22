// src/controllers/clienteController.js
const Cliente = require('../models/clienteSchema');
const clienteLogic = require('../logic/clienteLogic');
const User = require('../models/user');
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
            
            // Verificar subServicios sin supervisor
            if (cliente.subServicios && cliente.subServicios.length > 0) {
                clienteObj.subServicios = cliente.subServicios.map(subServicio => {
                    const subServObj = subServicio.toObject ? subServicio.toObject() : subServicio;
                    
                    // Marcar subServicios sin supervisor
                    if (!subServicio.supervisorId) {
                        subServObj.requiereSupervisor = true;
                    } else if (typeof subServicio.supervisorId === 'object' && 
                              subServicio.supervisorId.isActive === false) {
                        subServObj.requiereSupervisor = true;
                    }
                    
                    return subServObj;
                });
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
        
        // Verificar subServicios sin supervisor
        if (cliente.subServicios && cliente.subServicios.length > 0) {
            clienteObj.subServicios = cliente.subServicios.map(subServicio => {
                const subServObj = subServicio.toObject ? subServicio.toObject() : subServicio;
                
                // Marcar subServicios sin supervisor
                if (!subServicio.supervisorId) {
                    subServObj.requiereSupervisor = true;
                } else if (typeof subServicio.supervisorId === 'object' && 
                          subServicio.supervisorId.isActive === false) {
                    subServObj.requiereSupervisor = true;
                }
                
                return subServObj;
            });
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
            
            // Verificar subServicios sin supervisor
            if (cliente.subServicios && cliente.subServicios.length > 0) {
                clienteObj.subServicios = cliente.subServicios.map(subServicio => {
                    const subServObj = subServicio.toObject ? subServicio.toObject() : subServicio;
                    
                    // Marcar subServicios sin supervisor
                    if (!subServicio.supervisorId) {
                        subServObj.requiereSupervisor = true;
                    } else if (typeof subServicio.supervisorId === 'object' && 
                              subServicio.supervisorId.isActive === false) {
                        subServObj.requiereSupervisor = true;
                    }
                    
                    return subServObj;
                });
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

// NUEVO ENDPOINT: Obtener clientes del supervisor asignado al operario
exports.getClientesByOperarioSupervisor = async (req, res) => {
    try {
        // 1. Primero obtenemos el ID del usuario actual (operario)
        const operarioId = req.user.id;
        
        // 2. Buscar el operario para obtener su supervisorId
        const operario = await User.findById(operarioId);
        
        if (!operario) {
            return res.status(404).json({
                success: false,
                message: 'Usuario operario no encontrado'
            });
        }
        
        // 3. Verificar que sea un operario y tenga un supervisor asignado
        if (operario.role !== 'operario' || !operario.supervisorId) {
            return res.status(404).json({
                success: false,
                message: 'No tienes un supervisor asignado o no eres un operario'
            });
        }
        
        // 4. Obtener el supervisorId del operario
        const supervisorId = operario.supervisorId;
        
        // 5. Obtener los clientes asociados al supervisor
        const clientes = await Cliente.find({ 'subServicios.supervisorId': supervisorId })
            .populate('userId', 'nombre email usuario apellido role isActive')
            .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive');
        
        if (!clientes || clientes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tu supervisor no tiene clientes asignados'
            });
        }
        
        res.json(clientes);
    } catch (error) {
        console.error('Error al obtener clientes del supervisor del operario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener clientes',
            error: error.message
        });
    }
};

// NUEVO ENDPOINT: Obtener clientes por ID de supervisor (a nivel de subServicio)
exports.getClientesBySupervisorId = async (req, res) => {
    try {
        // Validar que el ID de supervisor sea un ObjectId válido
        const supervisorId = req.params.supervisorId;
        if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
            return res.status(400).json({ mensaje: 'ID de supervisor inválido' });
        }

        // Buscar clientes con subservicios asociados al supervisorId
        const clientes = await clienteLogic.obtenerClientesPorSupervisorId(supervisorId);
        
        res.json(clientes);
    } catch (error) {
        console.error('Error al obtener clientes por supervisorId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener clientes por supervisor', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// NUEVO ENDPOINT: Obtener subServicios por ID de supervisor
exports.getSubServiciosBySupervisorId = async (req, res) => {
    try {
        // Validar que el ID de supervisor sea un ObjectId válido
        const supervisorId = req.params.supervisorId;
        if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
            return res.status(400).json({ mensaje: 'ID de supervisor inválido' });
        }

        // Buscar subservicios asociados al supervisorId
        const subServicios = await clienteLogic.obtenerSubServiciosPorSupervisorId(supervisorId);
        
        res.json(subServicios);
    } catch (error) {
        console.error('Error al obtener subservicios por supervisorId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener subservicios por supervisor', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// NUEVO ENDPOINT: Obtener subServicios sin supervisor asignado
exports.getSubServiciosSinSupervisor = async (req, res) => {
    try {
        const subServiciosSinSupervisor = await clienteLogic.obtenerSubServiciosSinSupervisor();
        res.json(subServiciosSinSupervisor);
    } catch (error) {
        console.error('Error al obtener subservicios sin supervisor:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener subservicios sin supervisor', 
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
        
        // Asegurarnos de que userId sea un array
        const userIds = Array.isArray(req.body.userId) ? req.body.userId : req.body.userId ? [req.body.userId] : [];
        
        // Crear objeto de cliente con los campos requeridos y opcionales
        const clienteData = {
            nombre: req.body.nombre,
            descripcion: req.body.descripcion || '',
            servicio: req.body.servicio || req.body.nombre, // Mantener compatibilidad
            seccionDelServicio: req.body.seccionDelServicio || '',
            userId: userIds,
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
        
        // Asegurarnos de que userId sea un array si viene en la petición
        if (req.body.userId !== undefined) {
            clienteData.userId = Array.isArray(req.body.userId) ? req.body.userId : [req.body.userId];
        }
        
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
            // Incluir supervisorId si se proporciona
            ...(req.body.supervisorId && { supervisorId: req.body.supervisorId }),
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

// NUEVO ENDPOINT: Asignar supervisor a un subservicio
exports.assignSupervisorToSubServicio = async (req, res) => {
    try {
        // Validar los IDs
        if (!mongoose.Types.ObjectId.isValid(req.params.clienteId)) {
            return res.status(400).json({ mensaje: 'ID de cliente inválido' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(req.params.subServicioId)) {
            return res.status(400).json({ mensaje: 'ID de subservicio inválido' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(req.body.supervisorId)) {
            return res.status(400).json({ mensaje: 'ID de supervisor inválido' });
        }
        
        // Obtener el cliente para verificar que el supervisor esté en su lista de supervisores
        const cliente = await clienteLogic.obtenerClientePorId(req.params.clienteId);
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        // Verificar que el supervisor esté en la lista de supervisores del cliente
        const supervisorIds = cliente.userId.map(id => 
            typeof id === 'object' && id !== null ? id._id.toString() : id.toString()
        );
        
        if (!supervisorIds.includes(req.body.supervisorId)) {
            return res.status(400).json({ 
                mensaje: 'El supervisor seleccionado no está asignado a este cliente',
                supervisoresPermitidos: supervisorIds
            });
        }
        
        const clienteActualizado = await clienteLogic.asignarSupervisorSubServicio(
            req.params.clienteId,
            req.params.subServicioId,
            req.body.supervisorId
        );
        
        if (!clienteActualizado) {
            return res.status(404).json({ mensaje: 'Cliente o subservicio no encontrado' });
        }
        
        res.json(clienteActualizado);
    } catch (error) {
        console.error('Error al asignar supervisor a subservicio:', error);
        res.status(500).json({ mensaje: 'Error al asignar supervisor', error: error.message });
    }
};

// NUEVO ENDPOINT: Remover supervisor de un subservicio
exports.removeSupervisorFromSubServicio = async (req, res) => {
    try {
        // Validar los IDs
        if (!mongoose.Types.ObjectId.isValid(req.params.clienteId)) {
            return res.status(400).json({ mensaje: 'ID de cliente inválido' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(req.params.subServicioId)) {
            return res.status(400).json({ mensaje: 'ID de subservicio inválido' });
        }
        
        const cliente = await clienteLogic.removerSupervisorSubServicio(
            req.params.clienteId,
            req.params.subServicioId
        );
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente o subservicio no encontrado' });
        }
        
        res.json(cliente);
    } catch (error) {
        console.error('Error al remover supervisor de subservicio:', error);
        res.status(500).json({ mensaje: 'Error al remover supervisor', error: error.message });
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