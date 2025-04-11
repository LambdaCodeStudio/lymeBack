// src/controllers/pedidoController.js
const { Pedido } = require('../models/pedidoSchema');
const pedidoLogic = require('../logic/pedidoLogic');
const mongoose = require('mongoose');

/**
 * Función utilitaria para extraer el ID del usuario de múltiples fuentes
 * @param {Object} req - Objeto de solicitud Express
 * @returns {string|null} - ID del usuario o null si no se encontró
 */
const extractUserId = (req) => {
    let userId = null;
    
    // 1. Intentar obtener del objeto req.user estándar
    if (req.user) {
      userId = req.user.id || req.user._id;
      console.log("ID obtenido de req.user:", userId);
    }
    
    // 2. Si no está disponible, intentar extraerlo manualmente del token
    if (!userId && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        // Esta línea asume que la verificación del token ya fue hecha por un middleware
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decoded.id || decoded.sub;
        console.log("ID extraído manualmente del token:", userId);
      } catch (tokenError) {
        console.error("Error al extraer ID del token:", tokenError);
      }
    }
    
    // 3. Si aun no hay userId, intentar obtenerlo del cuerpo de la solicitud como último recurso
    if (!userId && req.body && req.body.userId) {
      userId = req.body.userId;
      console.log("ID obtenido del cuerpo de la solicitud:", userId);
    }
    
    return userId;
  };
  

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

        // MODIFICACIÓN: Usar la función ya implementada en pedidoLogic.js
        // que obtiene correctamente los pedidos asignados al supervisor
        const pedidos = await pedidoLogic.obtenerPedidosPorSupervisorId(
            req.params.supervisorId, 
            opciones
        );
        
        res.json(pedidos);
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
        const estados = ['pendiente', 'aprobado_supervisor', 'en_preparacion', 'entregado', 'aprobado', 'rechazado'];
        if (!estados.includes(req.params.estado)) {
            return res.status(400).json({ 
                mensaje: 'Estado no válido. Debe ser: pendiente, aprobado_supervisor, en_preparacion, entregado, aprobado o rechazado' 
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
exports.createPedido = async (req, res) => {
    try {
        // Validar campos requeridos
        if (!req.body.productos || !Array.isArray(req.body.productos) || req.body.productos.length === 0) {
            return res.status(400).json({ mensaje: 'Se requiere al menos un producto en el pedido' });
        }

        // Agregar userId desde el token de autenticación si está disponible
        if (req.user && req.user.id && !req.body.userId) {
            // Si es un operario, obtener su supervisor asignado y usar ese ID
            if (req.user.role === 'operario' && req.user.supervisorId) {
                // Usar el ID del supervisor como userId del pedido
                req.body.userId = req.user.supervisorId;
                
                // Guardar info del operario en metadata para mantener trazabilidad
                req.body.metadata = {
                    creadoPorOperario: true,
                    operarioId: req.user.id,
                    operarioNombre: req.user.nombre || req.user.usuario || req.user.email,
                    fechaCreacion: new Date().toISOString(),
                    supervisorId: req.user.supervisorId
                };
                
                // Intentar obtener información adicional del supervisor
                try {
                    const User = mongoose.model('User');
                    const supervisor = await User.findById(req.user.supervisorId);
                    if (supervisor) {
                        req.body.metadata.supervisorNombre = supervisor.nombre || supervisor.usuario || supervisor.email;
                    }
                } catch (err) {
                    console.error('Error al obtener información del supervisor:', err);
                }
            } else {
                // Si no es operario o no tiene supervisor, usar el ID del usuario actual
                req.body.userId = req.user.id;
            }
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

        // El código para operarios creando pedidos para otros usuarios ya no es necesario aquí
        // ya que el userId siempre será el supervisor cuando un operario crea un pedido
        
        // Para casos especiales donde se quiere forzar a mantener el userId original
        if (req.user && req.body.mantenerUsuarioOriginal === true) {
            // Mantener el userId tal como está, pero incluir metadatos
            if (!req.body.metadata) {
                req.body.metadata = {
                    fechaCreacion: new Date().toISOString()
                };
            }
        }

        // Estado según el rol del usuario
        if (req.user && req.user.role === 'supervisor') {
            req.body.estado = 'aprobado_supervisor';
            // Si estamos asignando el pedido como aprobado_supervisor directamente,
            // guardamos quién lo aprobó
            req.body.aprobadoPorSupervisor = req.user.id;
            req.body.fechaAprobacionSupervisor = new Date();
        } else {
            req.body.estado = 'pendiente';
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
        // Si se actualiza a estado "aprobado_supervisor", registrar quién lo aprobó
        else if (req.body.estado === 'aprobado_supervisor' && req.user && req.user.id) {
            req.body.aprobadoPorSupervisor = req.user.id;
        }
        // Si se actualiza a estado "en_preparacion", registrar quién lo marcó
        else if (req.body.estado === 'en_preparacion' && req.user && req.user.id) {
            req.body.usuarioPreparacion = req.user.id;
        }
        // Si se actualiza a estado "entregado", registrar quién lo entregó
        else if (req.body.estado === 'entregado' && req.user && req.user.id) {
            req.body.usuarioEntrega = req.user.id;
        }
        // Si se actualiza a estado "rechazado", registrar quién lo rechazó
        else if (req.body.estado === 'rechazado' && req.user && req.user.id) {
            req.body.rechazadoPor = req.user.id;
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

/**
 * Rechaza un pedido y restaura el stock
 */
exports.rechazarPedido = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const pedidoId = req.params.id;
        
        // Usar la función utilitaria para extraer el ID del usuario
        const userId = extractUserId(req);

        // Verificar si hay un usuario autenticado
        if (!userId) {
            return res.status(401).json({ mensaje: 'Usuario no autenticado' });
        }

        // Obtener el pedido actual
        const pedidoActual = await Pedido.findById(pedidoId);
        if (!pedidoActual) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }

        // Solo rechazar si está pendiente, aprobado_supervisor o en_preparacion
        if (pedidoActual.estado !== 'pendiente' && 
            pedidoActual.estado !== 'aprobado_supervisor' && 
            pedidoActual.estado !== 'en_preparacion') {
            return res.status(400).json({ 
                mensaje: 'Solo se pueden rechazar pedidos pendientes, aprobados por supervisor o en preparación' 
            });
        }

        // Rechazar el pedido incluyendo el motivo en las observaciones
        const pedidoActualizado = await pedidoLogic.rechazarPedido(pedidoId, userId);
        
        // Actualizar las observaciones con el motivo si se proporcionó
        if (req.body.motivo) {
            pedidoActualizado.observaciones = req.body.motivo;
            await pedidoActualizado.save();
        }
        
        // Obtener el pedido rechazado con información completa
        const pedidoRechazado = await Pedido.findById(pedidoId)
            .populate('userId', 'nombre email usuario apellido role')
            .populate('supervisorId', 'nombre email usuario apellido role')
            .populate('productos.productoId')
            .populate('rechazadoPor', 'nombre email usuario apellido');

        res.json({
            success: true,
            mensaje: 'Pedido rechazado correctamente y stock restaurado',
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

/**
 * Aprueba un pedido por parte de un supervisor (primer nivel)
 */
exports.aprobarPedidoPorSupervisor = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const pedidoId = req.params.id;
        
        // Usar la función utilitaria para extraer el ID del usuario
        const userId = extractUserId(req);
        
        // Verificación final
        if (!userId) {
            console.error("No se pudo obtener el ID de usuario de ninguna fuente");
            return res.status(401).json({ mensaje: 'Usuario no autenticado' });
        }

        // Obtener el pedido actual
        const pedidoActual = await Pedido.findById(pedidoId);
        if (!pedidoActual) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }

        // Solo se pueden aprobar pedidos pendientes
        if (pedidoActual.estado !== 'pendiente') {
            return res.status(400).json({ 
                mensaje: 'Solo se pueden aprobar por supervisor pedidos en estado pendiente' 
            });
        }

        // Actualizar el estado del pedido
        pedidoActual.estado = 'aprobado_supervisor';
        pedidoActual.fechaAprobacionSupervisor = new Date();
        pedidoActual.aprobadoPorSupervisor = userId;
        
        // Si hay comentarios adicionales, guardarlos
        if (req.body.comentarios) {
            pedidoActual.observaciones = `Aprobado por supervisor: ${req.body.comentarios}`;
        }
        
        await pedidoActual.save();

        // Obtener el pedido aprobado con información completa
        const pedidoAprobado = await Pedido.findById(pedidoId)
            .populate('userId', 'nombre email usuario apellido role')
            .populate('supervisorId', 'nombre email usuario apellido role')
            .populate('productos.productoId')
            .populate('aprobadoPorSupervisor', 'nombre email usuario apellido');

        res.json({
            success: true,
            mensaje: 'Pedido aprobado por supervisor correctamente',
            pedido: pedidoAprobado
        });
    } catch (error) {
        console.error('Error al aprobar pedido por supervisor:', error);
        res.status(500).json({ 
            mensaje: 'Error al aprobar pedido por supervisor', 
            error: error.message 
        });
    }
};

/**
 * Marca un pedido como en preparación
 */
exports.marcarPedidoEnPreparacion = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const pedidoId = req.params.id;
        
        // Usar la función utilitaria para extraer el ID del usuario
        const userId = extractUserId(req);

        // Verificar si hay un usuario autenticado
        if (!userId) {
            return res.status(401).json({ mensaje: 'Usuario no autenticado' });
        }

        // Verificar que el usuario no sea supervisor
        if (req.user && req.user.role === 'supervisor') {
            return res.status(403).json({ 
                mensaje: 'Los supervisores no están autorizados para marcar pedidos como en preparación' 
            });
        }

        // Obtener el pedido actual
        const pedidoActual = await Pedido.findById(pedidoId);
        if (!pedidoActual) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }

        // Solo marcar como en preparación si está aprobado por supervisor o aprobado definitivamente
        if (pedidoActual.estado !== 'aprobado_supervisor' && pedidoActual.estado !== 'aprobado') {
            return res.status(400).json({ 
                mensaje: 'Solo se pueden marcar como en preparación pedidos aprobados por supervisor o aprobados definitivamente' 
            });
        }

        // Marcar el pedido como en preparación
        const pedidoActualizado = await pedidoLogic.marcarPedidoEnPreparacion(pedidoId, userId);
        
        // Obtener el pedido actualizado con información completa
        const pedidoPreparacion = await Pedido.findById(pedidoId)
            .populate('userId', 'nombre email usuario apellido role')
            .populate('supervisorId', 'nombre email usuario apellido role')
            .populate('productos.productoId')
            .populate('usuarioPreparacion', 'nombre email usuario apellido');

        res.json({
            success: true,
            mensaje: 'Pedido marcado en preparación correctamente',
            pedido: pedidoPreparacion
        });
    } catch (error) {
        console.error('Error al marcar pedido en preparación:', error);
        res.status(500).json({ 
            mensaje: 'Error al marcar pedido en preparación', 
            error: error.message 
        });
    }
};

/**
 * Marca un pedido como entregado
 */
exports.marcarPedidoEntregado = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const pedidoId = req.params.id;
        
        // Usar la función utilitaria para extraer el ID del usuario
        const userId = extractUserId(req);

        // Verificar si hay un usuario autenticado
        if (!userId) {
            return res.status(401).json({ mensaje: 'Usuario no autenticado' });
        }

        // Obtener el pedido actual
        const pedidoActual = await Pedido.findById(pedidoId);
        if (!pedidoActual) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }

        // Solo marcar como entregado si está en preparación
        if (pedidoActual.estado !== 'en_preparacion') {
            return res.status(400).json({ 
                mensaje: 'Solo se pueden marcar como entregados pedidos en preparación' 
            });
        }

        // Marcar el pedido como entregado
        const pedidoActualizado = await pedidoLogic.marcarPedidoEntregado(pedidoId, userId);
        
        // Obtener el pedido actualizado con información completa
        const pedidoEntregado = await Pedido.findById(pedidoId)
            .populate('userId', 'nombre email usuario apellido role')
            .populate('supervisorId', 'nombre email usuario apellido role')
            .populate('productos.productoId')
            .populate('usuarioEntrega', 'nombre email usuario apellido');

        res.json({
            success: true,
            mensaje: 'Pedido marcado como entregado correctamente',
            pedido: pedidoEntregado
        });
    } catch (error) {
        console.error('Error al marcar pedido como entregado:', error);
        res.status(500).json({ 
            mensaje: 'Error al marcar pedido como entregado', 
            error: error.message 
        });
    }
};

/**
 * Aprueba un pedido definitivamente (nivel admin)
 */
exports.aprobarPedidoFinal = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ mensaje: 'ID de pedido inválido' });
        }

        const pedidoId = req.params.id;
        
        // Usar la función utilitaria para extraer el ID del usuario
        const userId = extractUserId(req);

        // Verificar si hay un usuario autenticado
        if (!userId) {
            return res.status(401).json({ mensaje: 'Usuario no autenticado' });
        }

        // Obtener el pedido actual
        const pedidoActual = await Pedido.findById(pedidoId);
        if (!pedidoActual) {
            return res.status(404).json({ mensaje: 'Pedido no encontrado' });
        }

        // Solo aprobar definitivamente si está pendiente o aprobado por supervisor
        if (pedidoActual.estado !== 'pendiente' && pedidoActual.estado !== 'aprobado_supervisor') {
            return res.status(400).json({ 
                mensaje: 'Solo se pueden aprobar definitivamente pedidos pendientes o aprobados por supervisor' 
            });
        }

        // Aprobar el pedido definitivamente
        const pedidoActualizado = await pedidoLogic.aprobarPedidoFinal(pedidoId, userId);
        
        // Obtener el pedido actualizado con información completa
        const pedidoAprobado = await Pedido.findById(pedidoId)
            .populate('userId', 'nombre email usuario apellido role')
            .populate('supervisorId', 'nombre email usuario apellido role')
            .populate('productos.productoId')
            .populate('aprobadoPor', 'nombre email usuario apellido');

        res.json({
            success: true,
            mensaje: 'Pedido aprobado definitivamente',
            pedido: pedidoAprobado
        });
    } catch (error) {
        console.error('Error al aprobar pedido definitivamente:', error);
        res.status(500).json({ 
            mensaje: 'Error al aprobar pedido definitivamente', 
            error: error.message 
        });
    }
};

// Para mantener compatibilidad con código existente, redireccionar aprobarPedido a aprobarPedidoFinal
exports.aprobarPedido = exports.aprobarPedidoFinal;

/**
 * Obtiene pedidos por ID de supervisor y rango de fechas
 */
exports.getPedidosBySupervisorIdAndDateRange = async (req, res) => {
    try {
        // Validar que el ID sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.supervisorId)) {
            return res.status(400).json({ mensaje: 'ID de supervisor inválido' });
        }

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

        const pedidos = await pedidoLogic.obtenerPedidosPorSupervisorIdYRangoDeFechas(
            req.params.supervisorId, 
            fechaDesde, 
            fechaHasta, 
            opciones
        );
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos por supervisor y fecha:', error);
        res.status(500).json({ 
            mensaje: 'Error al obtener pedidos por supervisor y fecha', 
            error: error.message 
        });
    }
};