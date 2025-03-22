// src/controllers/pedidoController.js
const { Pedido } = require('../models/pedidoSchema');
const pedidoLogic = require('../logic/pedidoLogic');
const mongoose = require('mongoose');

/**
 * Obtiene todos los pedidos
 */
exports.getPedidos = async (req, res) => {
    try {
        // Configurar opciones de paginación y ordenamiento desde query params
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 } // Por defecto, los más recientes primero
        };

        // Ordenar por otros campos si se especifica
        if (req.query.sort) {
            const sortField = req.query.sort.startsWith('-') ? 
                req.query.sort.substring(1) : req.query.sort;
            const sortDir = req.query.sort.startsWith('-') ? -1 : 1;
            opciones.sort = { [sortField]: sortDir };
        }

        const pedidos = await pedidoLogic.obtenerPedidos(opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ mensaje: 'Error al obtener pedidos', error: error.message });
    }
};

/**
 * Obtiene un pedido por su ID
 */
exports.getPedidoById = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const pedido = await pedidoLogic.obtenerPedidoPorId(req.params.id);
        
        if (!pedido) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }
        
        res.json(pedido);
    } catch (error) {
        console.error('Error al obtener pedido por ID:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener el pedido', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos por ID de usuario creador
 */
exports.getPedidosByUserId = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ mensaje: 'ID de usuario inválido' });
        }

        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        const pedidos = await pedidoLogic.obtenerPedidosPorUserId(req.params.userId, opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por userId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por usuario', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos por supervisor
 */
exports.getPedidosBySupervisorId = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.supervisorId)) {
            return res.status(400).json({ mensaje: 'ID de supervisor inválido' });
        }

        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        // Obtener pedidos por supervisorId (directamente asignado o a través de subServicio)
        const pedidos = await Pedido.find({
            $or: [
                { supervisorId: req.params.supervisorId },
                { 'cliente.subServicioId': { $exists: true } }
            ]
        })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId', 'nombre')
        .populate({
            path: 'cliente.clienteId',
            select: 'nombre subServicios',
            populate: {
                path: 'subServicios',
                populate: { path: 'supervisorId' }
            }
        })
        .sort(opciones.sort)
        .skip(opciones.skip)
        .limit(opciones.limit);
        
        // Filtrar manualmente los pedidos que tienen el supervisor asignado a nivel de subServicio
        const pedidosFiltrados = pedidos.filter(pedido => {
            // Si el supervisorId coincide directamente, incluir
            if (pedido.supervisorId && 
                pedido.supervisorId._id.toString() === req.params.supervisorId) {
                return true;
            }
            
            // Si hay cliente y subServicioId, verificar si el subServicio tiene asignado este supervisor
            if (pedido.cliente && 
                pedido.cliente.clienteId && 
                pedido.cliente.subServicioId) {
                
                const cliente = pedido.cliente.clienteId;
                if (!cliente.subServicios) return false;
                
                // Buscar el subServicio correspondiente
                const subServicio = cliente.subServicios.find(sub => 
                    sub._id.toString() === pedido.cliente.subServicioId.toString()
                );
                
                // Verificar si el subServicio tiene asignado el supervisor
                return subServicio && 
                       subServicio.supervisorId && 
                       subServicio.supervisorId.toString() === req.params.supervisorId;
            }
            
            return false;
        });
        
        res.json(pedidosFiltrados);
    } catch (error) {
        console.error('Error al obtener pedidos por supervisorId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por supervisor', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos por servicio (compatibilidad con código antiguo)
 */
exports.getPedidosByServicio = async (req, res) => {
    try {
        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        const pedidos = await pedidoLogic.obtenerPedidosPorServicio(req.params.servicio, opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por servicio:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por servicio', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos por rango de fechas
 */
exports.getPedidosByFecha = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, desde, hasta } = req.query;
        
        // Admitir ambos formatos de parámetros
        const fechaDesde = fechaInicio || desde;
        const fechaHasta = fechaFin || hasta;
        
        if (!fechaDesde || !fechaHasta) {
            return res.status(400).json({ 
                mensaje: 'Se requieren los parámetros de fecha (fechaInicio/desde y fechaFin/hasta)' 
            });
        }

        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        const pedidos = await pedidoLogic.obtenerPedidosPorRangoDeFechas(fechaDesde, fechaHasta, opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por fecha:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por fecha', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos por estado
 */
exports.getPedidosByEstado = async (req, res) => {
    try {
        const estados = ['pendiente', 'aprobado', 'rechazado'];
        if (!estados.includes(req.params.estado)) {
            return res.status(400).json({ 
                mensaje: 'Estado no válido. Debe ser: pendiente, aprobado o rechazado' 
            });
        }

        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        const pedidos = await pedidoLogic.obtenerPedidosPorEstado(req.params.estado, opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por estado:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por estado', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos que contienen un producto específico
 */
exports.getPedidosByProducto = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.productoId)) {
            return res.status(400).json({ mensaje: 'ID de producto inválido' });
        }

        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        const pedidos = await pedidoLogic.obtenerPedidosPorProducto(req.params.productoId, opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por producto:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por producto', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos por cliente usando la estructura jerárquica
 */
exports.getPedidosByCliente = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.clienteId)) {
            return res.status(400).json({ mensaje: 'ID de cliente inválido' });
        }

        // Validar subServicioId y subUbicacionId si están presentes
        const subServicioId = req.query.subServicioId;
        if (subServicioId && !mongoose.Types.ObjectId.isValid(subServicioId)) {
            return res.status(400).json({ mensaje: 'ID de subservicio inválido' });
        }

        const subUbicacionId = req.query.subUbicacionId;
        if (subUbicacionId && !mongoose.Types.ObjectId.isValid(subUbicacionId)) {
            return res.status(400).json({ mensaje: 'ID de sububicación inválido' });
        }

        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        const pedidos = await pedidoLogic.obtenerPedidosPorCliente(
            req.params.clienteId, 
            subServicioId, 
            subUbicacionId,
            opciones
        );
        
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por cliente:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por cliente', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos por cliente ID (compatibilidad)
 */
exports.getPedidosByClienteId = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.clienteId)) {
            return res.status(400).json({ mensaje: 'ID de cliente inválido' });
        }

        // Configurar opciones de paginación y ordenamiento
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0,
            sort: { fecha: -1 }
        };

        const pedidos = await pedidoLogic.obtenerPedidosPorClienteId(req.params.clienteId, opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por clienteId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por cliente', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos ordenados por servicio/sección (compatibilidad)
 */
exports.getPedidosOrdenados = async (req, res) => {
    try {
        // Configurar opciones de paginación
        const opciones = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            skip: req.query.page ? (parseInt(req.query.page) - 1) * (parseInt(req.query.limit) || 50) : 0
        };

        const pedidos = await pedidoLogic.obtenerPedidosOrdenados(opciones);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos ordenados:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos ordenados', 
            error: error.message 
        });
    }
};

/**
 * Crea un nuevo pedido
 */
/**
 * Crea un nuevo pedido
 */
exports.createPedido = async (req, res) => {
    try {
        // Validar campos requeridos
        if (!req.body.productos || !Array.isArray(req.body.productos) || req.body.productos.length === 0) {
            return res.status(400).json({ mensaje: 'Se requiere al menos un producto en el pedido' });
        }

        // Agregar userId desde el token de autenticación si está disponible
        if (req.user && req.user.id && !req.body.userId) {
            req.body.userId = req.user.id;
        }
        
        // Si no hay supervisorId pero hay un subServicioId, intentar obtener el supervisor del subServicio
        if (!req.body.supervisorId && 
            req.body.cliente && 
            req.body.cliente.clienteId && 
            req.body.cliente.subServicioId) {
            
            try {
                const Cliente = mongoose.model('Cliente');
                const cliente = await Cliente.findById(req.body.cliente.clienteId);
                
                if (cliente) {
                    // Buscar el subServicio correspondiente
                    const subServicio = cliente.subServicios.id(req.body.cliente.subServicioId);
                    
                    if (subServicio && subServicio.supervisorId) {
                        // Asignar el supervisor del subServicio al pedido
                        req.body.supervisorId = subServicio.supervisorId;
                    }
                }
            } catch (err) {
                console.error('Error al obtener supervisor de subServicio:', err);
                // Continuar sin asignar supervisor
            }
        }

        // Si es un operario creando un pedido para otro usuario
        if (req.user && req.user.id && req.user.role === 'operario' && req.body.userId && req.user.id !== req.body.userId) {
            // Configurar los metadatos del pedido
            req.body.metadata = {
                creadoPorOperario: true,
                operarioId: req.user.id,
                operarioNombre: req.user.nombre || req.user.usuario || req.user.email,
                fechaCreacion: new Date().toISOString()
            };
            
            // Si hay supervisor asignado, incluirlo en los metadatos
            if (req.body.supervisorId) {
                try {
                    const User = mongoose.model('User');
                    const supervisor = await User.findById(req.body.supervisorId);
                    if (supervisor) {
                        req.body.metadata.supervisorId = supervisor._id;
                        req.body.metadata.supervisorNombre = supervisor.nombre || supervisor.usuario || supervisor.email;
                    }
                } catch (err) {
                    console.error('Error al obtener información del supervisor:', err);
                }
            }
        }
        
        // Si es un pedido creado por un operario para sí mismo, pero quiere marcar explícitamente
        if (req.user && req.user.role === 'operario' && req.body.creadoPorOperario) {
            req.body.metadata = {
                creadoPorOperario: true,
                operarioId: req.user.id,
                operarioNombre: req.user.nombre || req.user.usuario || req.user.email,
                fechaCreacion: new Date().toISOString()
            };
            
            // Incluir supervisor en los metadatos si está disponible
            if (req.body.supervisorId) {
                try {
                    const User = mongoose.model('User');
                    const supervisor = await User.findById(req.body.supervisorId);
                    if (supervisor) {
                        req.body.metadata.supervisorId = supervisor._id;
                        req.body.metadata.supervisorNombre = supervisor.nombre || supervisor.usuario || supervisor.email;
                    }
                } catch (err) {
                    console.error('Error al obtener información del supervisor:', err);
                }
            }
        }

        // Crear el pedido
        const pedido = await pedidoLogic.crearPedido(req.body);
        res.status(201).json(pedido);
    } catch (error) {
        console.error('Error al crear pedido:', error);
        res.status(500).json({ 
            mensaje: 'Error al crear pedido. ' + 
            (error.message.includes('Stock insuficiente') 
                ? 'Verifique el stock de los productos, previo a hacer la compra.' 
                : error.message), 
            error: error.message 
        });
    }
};

/**
 * Actualiza un pedido existente
 */
exports.updatePedido = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        // Si se actualiza a estado "aprobado", registrar quién lo aprobó
        if (req.body.estado === 'aprobado' && req.user && req.user.id) {
            req.body.aprobadoPor = req.user.id;
        }

        const pedido = await pedidoLogic.actualizarPedido(req.params.id, req.body);
        
        if (!pedido) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }
        
        res.json(pedido);
    } catch (error) {
        console.error('Error al actualizar pedido:', error);
        res.status(500).json({ 
            mensaje: 'Error al actualizar pedido', 
            error: error.message 
        });
    }
};

/**
 * Elimina un pedido
 */
exports.deletePedido = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const resultado = await pedidoLogic.eliminarPedido(req.params.id);
        
        if (!resultado) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }
        
        res.json({ mensaje: 'Pedido eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar pedido:', error);
        res.status(500).json({ 
            mensaje: 'Error al eliminar pedido', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos en formato de corte de control para reportes
 */
exports.getPedidosCorteControl = async (req, res) => {
    try {
        // Procesar filtros desde query params
        const filtros = {
            fechaInicio: req.query.fechaInicio || req.query.desde,
            fechaFin: req.query.fechaFin || req.query.hasta,
            clienteId: req.query.clienteId,
            subServicioId: req.query.subServicioId,
            subUbicacionId: req.query.subUbicacionId,
            supervisorId: req.query.supervisorId,
            productoId: req.query.productoId,
            estado: req.query.estado
        };

        const pedidos = await pedidoLogic.obtenerCorteControlPedidos(filtros);
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener corte de control de pedidos:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener corte de control de pedidos', 
            error: error.message 
        });
    }
};

/**
 * Obtiene estadísticas para el dashboard
 */
exports.getPedidosEstadisticas = async (req, res) => {
    try {
        // Procesar filtros desde query params
        const filtros = {
            fechaInicio: req.query.fechaInicio || req.query.desde,
            fechaFin: req.query.fechaFin || req.query.hasta,
            clienteId: req.query.clienteId,
            supervisorId: req.query.supervisorId
        };

        const estadisticas = await pedidoLogic.obtenerEstadisticasPedidos(filtros);
        res.json(estadisticas);
    } catch (error) {
        console.error('Error al obtener estadísticas de pedidos:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener estadísticas de pedidos', 
            error: error.message 
        });
    }
};

exports.rechazarPedido = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const pedidoId = req.params.id;
        const { motivo } = req.body;

        // Obtener el pedido para restaurar stock
        const pedido = await Pedido.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }

        // Solo rechazar si está pendiente
        if (pedido.estado !== 'pendiente') {
            return res.status(400).json({ 
                mensaje: 'Solo se pueden rechazar pedidos pendientes' 
            });
        }

        // IMPORTANTE: Restaurar el stock de cada producto
        for (const item of pedido.productos) {
            const productoId = typeof item.productoId === 'object' ? 
                item.productoId._id : item.productoId;
            const cantidad = item.cantidad;
            
            // Obtener producto actual
            const producto = await productoLogic.obtenerPorId(productoId);
            if (producto) {
                // Aumentar stock y reducir vendidos
                await productoLogic.actualizarProducto(productoId, {
                    stock: producto.stock + cantidad,
                    vendidos: Math.max(0, (producto.vendidos || 0) - cantidad)
                });
                console.log(`Stock restaurado para producto ${productoId}: +${cantidad} unidades`);
            }
        }

        // Actualizar estado del pedido
        pedido.estado = 'rechazado';
        pedido.observaciones = motivo;
        pedido.fechaRechazo = new Date();
        pedido.rechazadoPor = req.user.id;

        await pedido.save();
        
        // Devolver el pedido rechazado con información completa
        const pedidoRechazado = await Pedido.findById(pedidoId)
            .populate('userId', 'nombre email usuario apellido role')
            .populate('supervisorId', 'nombre email usuario apellido role')
            .populate('productos.productoId')
            .populate('rechazadoPor', 'nombre email usuario apellido');

        res.json({
            success: true,
            mensaje: 'Pedido rechazado correctamente',
            pedido: pedidoRechazado
        });
    } catch (error) {
        console.error('Error al rechazar pedido:', error);
        res.status(500).json({ 
            mensaje: 'Error al rechazar pedido', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos creados por un operario específico
 */
exports.getPedidosByOperarioId = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.operarioId)) {
            return res.status(400).json({ mensaje: 'ID de operario inválido' });
        }

        const pedidos = await Pedido.find({
            'metadata.creadoPorOperario': true,
            'metadata.operarioId': req.params.operarioId
        })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId')
        .sort({ fecha: -1 });
        
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por operarioId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos creados por operario', 
            error: error.message 
        });
    }
};

/**
 * Obtiene pedidos rechazados que fueron creados por un operario específico
 */
exports.getPedidosRechazadosByOperarioId = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.operarioId)) {
            return res.status(400).json({ mensaje: 'ID de operario inválido' });
        }

        const pedidos = await Pedido.find({
            'metadata.creadoPorOperario': true,
            'metadata.operarioId': req.params.operarioId,
            'estado': 'rechazado'
        })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId')
        .sort({ fecha: -1 });
        
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos rechazados por operarioId:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos rechazados creados por operario', 
            error: error.message 
        });
    }
};