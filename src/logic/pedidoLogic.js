// src/logic/pedidoLogic.js
const { Pedido } = require('../models/pedidoSchema');
const Cliente = require('../models/clienteSchema');
const productoLogic = require('./productoLogic');
const mongoose = require('mongoose');

/**
 * Obtiene todos los pedidos con su información relacionada
 */
const obtenerPedidos = async (opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;

    return await Pedido.find()
        .populate('userId', 'nombre email usuario apellido role')
        .populate('supervisorId', 'nombre email usuario apellido role')
        .populate('productos.productoId')
        .populate('cliente.clienteId', 'nombre servicio email telefono')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

/**
 * Obtiene un pedido por su ID
 */
const obtenerPedidoPorId = async (id) => {
    return await Pedido.findById(id)
        .populate({
            path: 'userId',
            select: 'nombre email usuario apellido role'
        })
        .populate({
            path: 'supervisorId',
            select: 'nombre email usuario apellido role'
        })
        .populate({
            path: 'productos.productoId',
            select: 'nombre precio descripcion categoria'
        })
        .populate({
            path: 'cliente.clienteId',
            select: 'nombre email telefono direccion'
        });
};

/**
 * Obtiene pedidos por ID de usuario creador
 */
const obtenerPedidosPorUserId = async (userId, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;

    return await Pedido.find({ userId })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

/**
 * Obtiene pedidos por ID de supervisor
 */
const obtenerPedidosPorSupervisorId = async (supervisorId, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;

    return await Pedido.find({ supervisorId })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

/**
 * Obtiene pedidos por servicio (para compatibilidad con código existente)
 */
const obtenerPedidosPorServicio = async (servicio, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;

    return await Pedido.find({ servicio })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

/**
 * Obtiene pedidos por estado
 */
const obtenerPedidosPorEstado = async (estado, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;

    return await Pedido.find({ estado })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId', 'nombre')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

/**
 * Obtiene pedidos por rango de fechas con formato flexible dd/mm/aaaa o ISO
 */
const obtenerPedidosPorRangoDeFechas = async (fechaInicio, fechaFin, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;
    
    // Procesar fechas en formato dd/mm/aaaa o ISO
    const fechaInicioObj = procesarFecha(fechaInicio, true); // Inicio del día
    const fechaFinObj = procesarFecha(fechaFin, false); // Fin del día
    
    return await Pedido.find({
        fecha: { $gte: fechaInicioObj, $lte: fechaFinObj }
    })
    .populate('userId', 'nombre email usuario apellido')
    .populate('supervisorId', 'nombre email usuario apellido')
    .populate('productos.productoId')
    .populate('cliente.clienteId', 'nombre')
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

/**
 * Obtiene pedidos que contengan un producto específico
 */
const obtenerPedidosPorProducto = async (productoId, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;
    
    return await Pedido.find({
        'productos.productoId': productoId
    })
    .populate('userId', 'nombre email usuario apellido')
    .populate('supervisorId', 'nombre email usuario apellido')
    .populate('productos.productoId')
    .populate('cliente.clienteId', 'nombre')
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

/**
 * Obtiene pedidos por cliente usando la nueva estructura jerárquica
 */
const obtenerPedidosPorCliente = async (clienteId, subServicioId = null, subUbicacionId = null, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;
    
    const filtro = { 'cliente.clienteId': mongoose.Types.ObjectId(clienteId) };
    
    if (subServicioId) {
        filtro['cliente.subServicioId'] = mongoose.Types.ObjectId(subServicioId);
        
        if (subUbicacionId) {
            filtro['cliente.subUbicacionId'] = mongoose.Types.ObjectId(subUbicacionId);
        }
    }
    
    return await Pedido.find(filtro)
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId', 'nombre email telefono')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

/**
 * Obtiene pedidos por cliente usando la estructura antigua (para compatibilidad)
 */
const obtenerPedidosPorClienteId = async (clienteId, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;
    
    // Obtener el cliente para extraer servicio y sección
    const cliente = await Cliente.findById(clienteId);
    
    if (!cliente) {
        throw new Error('Cliente no encontrado');
    }
    
    // Primero intentamos buscar con la nueva estructura
    let pedidos = await Pedido.find({ 'cliente.clienteId': clienteId })
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .sort(sort)
        .skip(skip)
        .limit(limit);
    
    // Si no hay resultados, buscamos con la estructura antigua
    if (pedidos.length === 0) {
        // Construir filtro compatible con estructura antigua
        const filtro = {
            servicio: cliente.nombre || cliente.servicio
        };
        
        // Añadir sección del servicio si está definida
        if (cliente.seccionDelServicio && cliente.seccionDelServicio.trim() !== '') {
            filtro.seccionDelServicio = cliente.seccionDelServicio;
        }
        
        // Añadir userId como filtro adicional si existe
        if (cliente.userId) {
            filtro.$or = [
                { userId: cliente.userId },
                { 
                    servicio: cliente.servicio,
                    seccionDelServicio: cliente.seccionDelServicio || ''
                }
            ];
            
            // Eliminar seccionDelServicio del filtro principal si está en $or
            if (filtro.$or && filtro.seccionDelServicio) {
                delete filtro.seccionDelServicio;
            }
        }
        
        pedidos = await Pedido.find(filtro)
            .populate('userId', 'nombre email usuario apellido')
            .populate('supervisorId', 'nombre email usuario apellido')
            .populate('productos.productoId')
            .sort(sort)
            .skip(skip)
            .limit(limit);
    }
    
    return pedidos;
};

/**
 * Obtiene pedidos ordenados por servicio/seccion (para compatibilidad)
 */
const obtenerPedidosOrdenados = async (opciones = {}) => {
    const { limit = 50, skip = 0 } = opciones;
    
    return await Pedido.find()
        .populate('userId', 'nombre email usuario apellido')
        .populate('supervisorId', 'nombre email usuario apellido')
        .populate('productos.productoId')
        .populate('cliente.clienteId', 'nombre')
        .sort({ servicio: 1, seccionDelServicio: 1, fecha: -1 })
        .skip(skip)
        .limit(limit);
};

/**
 * Crea un nuevo pedido y actualiza el stock de productos
 */
const crearPedido = async (data) => {
    // Preparar datos de cliente jerárquico si no vienen incluidos
    if (data.clienteId && !data.cliente) {
        const cliente = await Cliente.findById(data.clienteId);
        if (cliente) {
            data.cliente = {
                clienteId: cliente._id,
                nombreCliente: cliente.nombre || cliente.servicio
            };
            
            // Si hay servicio y sección para compatibilidad
            if (!data.servicio) {
                data.servicio = cliente.nombre || cliente.servicio;
            }
            if (!data.seccionDelServicio && cliente.seccionDelServicio) {
                data.seccionDelServicio = cliente.seccionDelServicio;
            }
        }
    }
    
    // Creamos el pedido
    const nuevoPedido = new Pedido(data);
    
    try {
        // Reducimos el stock de cada producto
        for (const item of data.productos) {
            const { productoId, cantidad } = item;
            
            // Verificar si hay suficiente stock
            const producto = await productoLogic.obtenerPorId(productoId);
            if (!producto || producto.stock < cantidad) {
                throw new Error(`Stock insuficiente para el producto con ID: ${productoId}`);
            }
            
            // Guardar precio unitario actual para el historial
            item.precioUnitario = producto.precio;
            
            // Reducir el stock
            await productoLogic.actualizarProducto(productoId, {
                stock: producto.stock - cantidad,
                vendidos: (producto.vendidos || 0) + cantidad
            });
        }
        
        // Guardamos el pedido
        return await nuevoPedido.save();
    } catch (error) {
        throw error;
    }
};

/**
 * Actualiza un pedido existente y ajusta el stock de productos
 */
const actualizarPedido = async (id, data) => {
    // Obtenemos el pedido actual para comparar los productos
    const pedidoActual = await Pedido.findById(id);
    if (!pedidoActual) {
        throw new Error('Pedido no encontrado');
    }
    
    try {
        // Verificar cambios en cliente jerárquico
        if (data.clienteId && !data.cliente) {
            const cliente = await Cliente.findById(data.clienteId);
            if (cliente) {
                data.cliente = {
                    clienteId: cliente._id,
                    nombreCliente: cliente.nombre || cliente.servicio
                };
                
                // Actualizar campos de compatibilidad
                if (!data.servicio) {
                    data.servicio = cliente.nombre || cliente.servicio;
                }
                if (!data.seccionDelServicio) {
                    data.seccionDelServicio = cliente.seccionDelServicio || '';
                }
            }
        }
        
        // Si hay productos, comparamos con los anteriores
        if (data.productos && Array.isArray(data.productos)) {
            // Creamos mapas para comparar productos anteriores y nuevos
            const productosAnteriores = pedidoActual.productos.reduce((map, item) => {
                const idProducto = typeof item.productoId === 'object' ? 
                    item.productoId._id.toString() : item.productoId.toString();
                map[idProducto] = item.cantidad;
                return map;
            }, {});
            
            const productosNuevos = data.productos.reduce((map, item) => {
                map[item.productoId.toString()] = item.cantidad;
                return map;
            }, {});
            
            // Para cada producto en el nuevo pedido
            for (const [productoId, cantidadNueva] of Object.entries(productosNuevos)) {
                const cantidadAnterior = productosAnteriores[productoId] || 0;
                
                // Si hay más productos que antes, reducimos el stock
                if (cantidadNueva > cantidadAnterior) {
                    const diferencia = cantidadNueva - cantidadAnterior;
                    const producto = await productoLogic.obtenerPorId(productoId);
                    
                    // Verificar si hay suficiente stock
                    if (!producto || producto.stock < diferencia) {
                        throw new Error(`Stock insuficiente para el producto con ID: ${productoId}`);
                    }
                    
                    // Guardar precio unitario actual para nuevos productos o aumento de cantidad
                    const productoIndex = data.productos.findIndex(
                        p => p.productoId.toString() === productoId
                    );
                    if (productoIndex >= 0 && !data.productos[productoIndex].precioUnitario) {
                        data.productos[productoIndex].precioUnitario = producto.precio;
                    }
                    
                    // Reducir el stock
                    await productoLogic.actualizarProducto(productoId, {
                        stock: producto.stock - diferencia,
                        vendidos: (producto.vendidos || 0) + diferencia
                    });
                } 
                // Si hay menos productos que antes, aumentamos el stock
                else if (cantidadNueva < cantidadAnterior) {
                    const diferencia = cantidadAnterior - cantidadNueva;
                    const producto = await productoLogic.obtenerPorId(productoId);
                    
                    // Aumentar el stock
                    await productoLogic.actualizarProducto(productoId, {
                        stock: producto.stock + diferencia,
                        vendidos: Math.max(0, (producto.vendidos || 0) - diferencia)
                    });
                }
            }
            
            // Para cada producto que estaba antes pero no está en el nuevo pedido
            for (const [productoId, cantidadAnterior] of Object.entries(productosAnteriores)) {
                if (!productosNuevos[productoId]) {
                    // Devolvemos todo el stock
                    const producto = await productoLogic.obtenerPorId(productoId);
                    if (producto) {
                        await productoLogic.actualizarProducto(productoId, {
                            stock: producto.stock + cantidadAnterior,
                            vendidos: Math.max(0, (producto.vendidos || 0) - cantidadAnterior)
                        });
                    }
                }
            }
        }
        
        // Si el pedido cambia a "aprobado", registramos la fecha
        if (data.estado === 'aprobado' && pedidoActual.estado !== 'aprobado') {
            data.fechaAprobacion = new Date();
            // Si tenemos usuario en el contexto, lo guardamos como aprobador
            if (data.aprobadoPor) {
                data.aprobadoPor = data.aprobadoPor;
            }
        }
        
        // Actualizamos el pedido
        return await Pedido.findByIdAndUpdate(id, data, { new: true })
            .populate('userId', 'nombre email usuario apellido')
            .populate('supervisorId', 'nombre email usuario apellido')
            .populate('productos.productoId')
            .populate('cliente.clienteId', 'nombre');
    } catch (error) {
        throw error;
    }
};

/**
 * Elimina un pedido y restaura el stock de productos
 */
const eliminarPedido = async (id) => {
    // Obtenemos el pedido para restaurar el stock
    const pedido = await Pedido.findById(id);
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
    try {
        // Restauramos el stock de cada producto
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
            }
        }
        
        // Eliminamos el pedido
        return await Pedido.findByIdAndDelete(id);
    } catch (error) {
        throw error;
    }
};

/**
 * Obtiene pedidos con formato de corte de control (estructura plana)
 * para reportes y análisis
 */
const obtenerCorteControlPedidos = async (filtros = {}) => {
    // Construir pipeline de agregación según filtros
    const pipeline = [];
    
    // Etapa de filtrado
    const matchStage = {};
    
    // Filtro por fechas
    if (filtros.fechaInicio || filtros.fechaFin) {
        matchStage.fecha = {};
        if (filtros.fechaInicio) {
            matchStage.fecha.$gte = procesarFecha(filtros.fechaInicio, true);
        }
        if (filtros.fechaFin) {
            matchStage.fecha.$lte = procesarFecha(filtros.fechaFin, false);
        }
    }
    
    // Filtro por cliente
    if (filtros.clienteId) {
        matchStage['cliente.clienteId'] = mongoose.Types.ObjectId(filtros.clienteId);
        
        if (filtros.subServicioId) {
            matchStage['cliente.subServicioId'] = mongoose.Types.ObjectId(filtros.subServicioId);
            
            if (filtros.subUbicacionId) {
                matchStage['cliente.subUbicacionId'] = mongoose.Types.ObjectId(filtros.subUbicacionId);
            }
        }
    }
    
    // Filtro por supervisor
    if (filtros.supervisorId) {
        matchStage.supervisorId = mongoose.Types.ObjectId(filtros.supervisorId);
    }
    
    // Filtro por producto
    if (filtros.productoId) {
        matchStage['productos.productoId'] = mongoose.Types.ObjectId(filtros.productoId);
    }
    
    // Filtro por estado
    if (filtros.estado) {
        matchStage.estado = filtros.estado;
    }
    
    // Añadir etapa de filtrado si hay algún filtro
    if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
    }
    
    // Etapa de despliegue de productos para ver cada producto individualmente
    pipeline.push({ $unwind: { path: '$productos', preserveNullAndEmptyArrays: false } });
    
    // Etapa de lookup para obtener información de cliente
    pipeline.push({
        $lookup: {
            from: 'clientes',
            localField: 'cliente.clienteId',
            foreignField: '_id',
            as: 'clienteInfo'
        }
    });
    
    // Etapa de lookup para obtener información de producto
    pipeline.push({
        $lookup: {
            from: 'productos',
            localField: 'productos.productoId',
            foreignField: '_id',
            as: 'productoInfo'
        }
    });
    
    // Etapa de lookup para obtener información de usuario
    pipeline.push({
        $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userInfo'
        }
    });
    
    // Etapa de lookup para obtener información de supervisor
    pipeline.push({
        $lookup: {
            from: 'users',
            localField: 'supervisorId',
            foreignField: '_id',
            as: 'supervisorInfo'
        }
    });
    
    // Etapa de proyección para formatear la salida
    pipeline.push({
        $project: {
            _id: 0,
            tipo: 'PEDIDO',
            numeroPedido: '$nPedido',
            fecha: { $dateToString: { format: '%d/%m/%Y', date: '$fecha' } },
            estado: '$estado',
            CLIENTE: { $arrayElemAt: ['$clienteInfo.nombre', 0] },
            SUBSERVICIO: '$cliente.nombreSubServicio',
            SUBUBICACION: '$cliente.nombreSubUbicacion',
            PRODUCTO: { $arrayElemAt: ['$productoInfo.nombre', 0] },
            CANTIDAD: '$productos.cantidad',
            PRECIO_UNITARIO: { $ifNull: ['$productos.precioUnitario', { $arrayElemAt: ['$productoInfo.precio', 0] }] },
            SUBTOTAL: { 
                $multiply: [
                    '$productos.cantidad', 
                    { $ifNull: ['$productos.precioUnitario', { $arrayElemAt: ['$productoInfo.precio', 0] }] }
                ] 
            },
            OPERARIO: { $arrayElemAt: ['$userInfo.nombre', 0] },
            SUPERVISOR: { $arrayElemAt: ['$supervisorInfo.nombre', 0] }
        }
    });
    
    // Etapa de ordenamiento
    pipeline.push({
        $sort: {
            CLIENTE: 1,
            SUBSERVICIO: 1,
            SUBUBICACION: 1,
            fecha: 1,
            PRODUCTO: 1
        }
    });
    
    // Ejecutar pipeline
    return await Pedido.aggregate(pipeline);
};

/**
 * Obtiene estadísticas de pedidos para dashboard
 */
const obtenerEstadisticasPedidos = async (filtros = {}) => {
    // Construir condiciones de filtrado
    const matchStage = {};
    
    // Filtro por fechas
    if (filtros.fechaInicio || filtros.fechaFin) {
        matchStage.fecha = {};
        if (filtros.fechaInicio) {
            matchStage.fecha.$gte = procesarFecha(filtros.fechaInicio, true);
        }
        if (filtros.fechaFin) {
            matchStage.fecha.$lte = procesarFecha(filtros.fechaFin, false);
        }
    }
    
    // Filtro por cliente
    if (filtros.clienteId) {
        matchStage['cliente.clienteId'] = mongoose.Types.ObjectId(filtros.clienteId);
    }
    
    // Filtro por supervisor
    if (filtros.supervisorId) {
        matchStage.supervisorId = mongoose.Types.ObjectId(filtros.supervisorId);
    }
    
    // Pipeline para estadísticas generales
    const pipelineGeneral = [
        { $match: matchStage },
        { 
            $group: {
                _id: null,
                totalPedidos: { $sum: 1 },
                pedidosPendientes: { 
                    $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] } 
                },
                pedidosAprobados: { 
                    $sum: { $cond: [{ $eq: ['$estado', 'aprobado'] }, 1, 0] } 
                },
                pedidosRechazados: { 
                    $sum: { $cond: [{ $eq: ['$estado', 'rechazado'] }, 1, 0] } 
                }
            } 
        }
    ];
    
    // Pipeline para estadísticas por cliente
    const pipelineClientes = [
        { $match: matchStage },
        { 
            $group: {
                _id: '$cliente.clienteId',
                nombreCliente: { $first: '$cliente.nombreCliente' },
                totalPedidos: { $sum: 1 }
            } 
        },
        { $sort: { totalPedidos: -1 } },
        { $limit: 10 } // Top 10 clientes
    ];
    
    // Pipeline para estadísticas por producto
    const pipelineProductos = [
        { $match: matchStage },
        { $unwind: '$productos' },
        { 
            $group: {
                _id: '$productos.productoId',
                cantidadTotal: { $sum: '$productos.cantidad' }
            } 
        },
        { 
            $lookup: {
                from: 'productos',
                localField: '_id',
                foreignField: '_id',
                as: 'productoInfo'
            } 
        },
        { 
            $project: {
                _id: 1,
                cantidadTotal: 1,
                nombreProducto: { $arrayElemAt: ['$productoInfo.nombre', 0] }
            } 
        },
        { $sort: { cantidadTotal: -1 } },
        { $limit: 10 } // Top 10 productos
    ];
    
    // Ejecutar todos los pipelines en paralelo
    const [estadisticasGenerales, estadisticasClientes, estadisticasProductos] = await Promise.all([
        Pedido.aggregate(pipelineGeneral),
        Pedido.aggregate(pipelineClientes),
        Pedido.aggregate(pipelineProductos)
    ]);
    
    return {
        general: estadisticasGenerales[0] || {
            totalPedidos: 0,
            pedidosPendientes: 0,
            pedidosAprobados: 0,
            pedidosRechazados: 0
        },
        clientes: estadisticasClientes,
        productos: estadisticasProductos
    };
};

/**
 * Función auxiliar para procesar fechas en diferentes formatos
 */
const procesarFecha = (fecha, esInicio = true) => {
    if (!fecha) {
        return esInicio ? new Date(0) : new Date();
    }
    
    let fechaObj;
    
    // Detectar formato dd/mm/aaaa
    if (typeof fecha === 'string' && fecha.includes('/')) {
        const partes = fecha.split('/');
        if (partes.length === 3) {
            fechaObj = new Date(
                parseInt(partes[2]), // año
                parseInt(partes[1]) - 1, // mes (0-11)
                parseInt(partes[0]) // día
            );
        } else {
            fechaObj = new Date(fecha);
        }
    } else {
        fechaObj = new Date(fecha);
    }
    
    // Ajustar a inicio o fin del día
    if (esInicio) {
        fechaObj.setHours(0, 0, 0, 0);
    } else {
        fechaObj.setHours(23, 59, 59, 999);
    }
    
    return fechaObj;
};

module.exports = {
    obtenerPedidos,
    obtenerPedidoPorId,
    obtenerPedidosPorUserId,
    obtenerPedidosPorSupervisorId,
    obtenerPedidosPorServicio,
    obtenerPedidosPorRangoDeFechas,
    obtenerPedidosPorProducto,
    obtenerPedidosPorCliente,
    obtenerPedidosPorClienteId,
    obtenerPedidosPorEstado,
    crearPedido,
    actualizarPedido,
    eliminarPedido,
    obtenerPedidosOrdenados,
    obtenerCorteControlPedidos,
    obtenerEstadisticasPedidos,
    procesarFecha
};