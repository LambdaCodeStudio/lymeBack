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
 * Obtiene un pedido por su ID con información completa
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
            select: 'nombre precio descripcion categoria subCategoria esCombo itemsCombo'
        })
        .populate({
            path: 'cliente.clienteId',
            select: 'nombre email telefono direccion'
        })
        .populate({
            path: 'aprobadoPor',
            select: 'nombre email usuario apellido role'
        })
        .populate({
            path: 'aprobadoPorSupervisor',
            select: 'nombre email usuario apellido role'
        })
        .populate({
            path: 'usuarioPreparacion',
            select: 'nombre email usuario apellido role'
        })
        .populate({
            path: 'usuarioEntrega',
            select: 'nombre email usuario apellido role'
        })
        .populate({
            path: 'rechazadoPor',
            select: 'nombre email usuario apellido role'
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

    // Primero encontrar todos los subServicios donde este usuario es supervisor
    const Cliente = mongoose.model('Cliente');
    const clientesDelSupervisor = await Cliente.find({ 
        'subServicios.supervisorId': new mongoose.Types.ObjectId(supervisorId) 
    }).select('_id subServicios');
    
    // Extraer los IDs de subServicios donde este usuario es supervisor
    const subServiciosIds = [];
    
    clientesDelSupervisor.forEach(cliente => {
        cliente.subServicios.forEach(subServ => {
            if (subServ.supervisorId && 
                subServ.supervisorId.toString() === supervisorId.toString()) {
                subServiciosIds.push(subServ._id);
            }
        });
    });

    // Buscar pedidos donde:
    // 1. El supervisor está asignado directamente al pedido, O
    // 2. El pedido tiene un subServicio donde el usuario es supervisor
    return await Pedido.find({
        $or: [
            { supervisorId: new mongoose.Types.ObjectId(supervisorId) },
            { 'cliente.subServicioId': { $in: subServiciosIds } }
        ]
    })
    .populate('userId', 'nombre email usuario apellido')
    .populate('supervisorId', 'nombre email usuario apellido')
    .populate('productos.productoId')
    .populate('cliente.clienteId', 'nombre email telefono')
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
    
    const filtro = { 'cliente.clienteId': new mongoose.Types.ObjectId(clienteId) };
    
    if (subServicioId) {
        filtro['cliente.subServicioId'] = new mongoose.Types.ObjectId(subServicioId);
        
        if (subUbicacionId) {
            filtro['cliente.subUbicacionId'] = new mongoose.Types.ObjectId(subUbicacionId);
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
    try {
        // Verificar si el usuario que hace el pedido es un operario
        if (data.userId) {
            const User = mongoose.model('User');
            const usuario = await User.findById(data.userId);
            
            // Si es un operario y tiene supervisor asignado, usar el ID del supervisor
            if (usuario && usuario.role === 'operario' && usuario.supervisorId) {
                // Guardamos el ID original del operario para referencia
                data.operarioId = data.userId;
                // Reemplazamos con el ID del supervisor
                data.userId = usuario.supervisorId;
                // También establecemos explícitamente el supervisorId
                data.supervisorId = usuario.supervisorId;
                // Añadimos una nota indicando que el pedido fue hecho por un operario
                data.notas = (data.notas ? data.notas + '\n' : '') + 
                    `Pedido realizado por el operario ${usuario.nombre || ''} ${usuario.apellido || ''} (ID: ${usuario._id}).`;
            }
        }
        
        // Solo asignamos el estado si no viene explícitamente
        if (!data.estado) {
            const User = mongoose.model('User');
            const usuario = await User.findById(data.userId);
            
            if (usuario && usuario.role === 'supervisor') {
                data.estado = 'aprobado_supervisor';
                // Si no viene la fecha de aprobación, la asignamos
                if (!data.fechaAprobacionSupervisor) {
                    data.fechaAprobacionSupervisor = new Date();
                }
                // Si no viene el ID de quien aprobó, usamos el mismo usuario
                if (!data.aprobadoPorSupervisor) {
                    data.aprobadoPorSupervisor = data.userId;
                }
            } else {
                data.estado = 'pendiente';
            }
        }
        
        // NUEVO: Procesar productos y combos para guardar información completa
        if (data.productos && Array.isArray(data.productos)) {
            // Array para procesar productos en paralelo
            const productPromises = data.productos.map(async (producto) => {
                // Guardar el precio original enviado desde el frontend
                const precioOriginalEnviado = producto.precio;
                
                // Obtener información completa del producto/combo
                const productoInfo = await productoLogic.obtenerPorId(producto.productoId);
                
                if (!productoInfo) {
                    throw new Error(`Producto no encontrado con ID: ${producto.productoId}`);
                }
                
                // Completar campos básicos del producto con la información actual
                producto.nombre = productoInfo.nombre;
                
                // MODIFICACIÓN CLAVE: No sobrescribir el precio para combos personalizados
                const esComboPersonalizado = productoInfo.esCombo && 
                                           (producto.personalizado === true || 
                                            producto.esComboEditado === true);
                
                if (!esComboPersonalizado) {
                    // Solo usar el precio de la base de datos para productos normales y combos no modificados
                    producto.precio = productoInfo.precio;
                } else {
                    // Para combos personalizados, mantener el precio calculado en el frontend
                    console.log(`Respetando precio personalizado para combo: "${producto.nombre}"`);
                    console.log(`  - Precio original BD: ${productoInfo.precio}`);
                    console.log(`  - Precio calculado frontend: ${precioOriginalEnviado}`);
                }
                
                producto.categoria = productoInfo.categoria;
                producto.subCategoria = productoInfo.subCategoria;
                
                // Si es un combo
                if (productoInfo.esCombo) {
                    producto.esCombo = true;
                    
                    // Si es un combo personalizado (modificado por el usuario)
                    if (producto.esComboEditado && producto.comboItems && Array.isArray(producto.comboItems)) {
                        producto.personalizado = true;
                        
                        // Para cada producto en el combo, obtener y guardar información completa
                        const comboItemsPromises = producto.comboItems.map(async (comboItem) => {
                            try {
                                const itemInfo = await productoLogic.obtenerPorId(comboItem.productoId);
                                return {
                                    productoId: comboItem.productoId,
                                    nombre: itemInfo ? itemInfo.nombre : comboItem.nombre || 'Producto no encontrado',
                                    cantidad: comboItem.cantidad || 1,
                                    precio: comboItem.precio || (itemInfo ? itemInfo.precio : 0)
                                };
                            } catch (err) {
                                console.warn(`Error al obtener información del producto ${comboItem.productoId} en combo:`, err);
                                return {
                                    productoId: comboItem.productoId,
                                    nombre: comboItem.nombre || 'Producto no encontrado',
                                    cantidad: comboItem.cantidad || 1,
                                    precio: comboItem.precio || 0
                                };
                            }
                        });
                        
                        // Esperar a que se completen todas las consultas
                        producto.comboItems = await Promise.all(comboItemsPromises);
                        
                        // Verificación final: calcular suma de componentes para debug
                        const sumaPreciosComponentes = producto.comboItems.reduce((suma, item) => {
                            return suma + (item.precio * item.cantidad);
                        }, 0);
                        
                        console.log(`  - Suma precios componentes: ${sumaPreciosComponentes}`);
                    } 
                    // Si es un combo estándar (no modificado)
                    else {
                        // Copiar los productos originales del combo
                        const comboItemsPromises = productoInfo.itemsCombo.map(async (comboItem) => {
                            try {
                                const itemInfo = await productoLogic.obtenerPorId(comboItem.productoId);
                                return {
                                    productoId: comboItem.productoId,
                                    nombre: itemInfo ? itemInfo.nombre : 'Producto no encontrado',
                                    cantidad: comboItem.cantidad || 1,
                                    precio: itemInfo ? itemInfo.precio : 0
                                };
                            } catch (err) {
                                console.warn(`Error al obtener información del producto ${comboItem.productoId} en combo:`, err);
                                return {
                                    productoId: comboItem.productoId,
                                    nombre: 'Producto no encontrado',
                                    cantidad: comboItem.cantidad || 1,
                                    precio: 0
                                };
                            }
                        });
                        
                        producto.comboItems = await Promise.all(comboItemsPromises);
                    }
                }
                
                // Eliminar flags temporales que no necesitamos almacenar
                delete producto.esComboEditado;
                
                return producto;
            });
            
            // Esperar a que terminen todas las consultas y procesamientos
            data.productos = await Promise.all(productPromises);
        }
        
        // Crear el nuevo pedido con la información completa
        const nuevoPedido = new Pedido(data);
        
        // Reducimos el stock de cada producto
        for (const item of data.productos) {
            const { productoId, cantidad } = item;
            
            // Obtener la información del producto
            const producto = await productoLogic.obtenerPorId(productoId);
            if (!producto) {
                throw new Error(`Producto no encontrado con ID: ${productoId}`);
            }
            
            // Verificar stock SOLO para productos de limpieza
            if (producto.categoria === 'limpieza' && producto.stock < cantidad) {
                throw new Error(`Stock insuficiente para el producto de limpieza "${producto.nombre}". Stock actual: ${producto.stock}, Solicitado: ${cantidad}`);
            }
            
            // Para productos de mantenimiento o con stock suficiente, actualizar
            await productoLogic.actualizarProducto(productoId, {
                stock: producto.stock - cantidad,
                vendidos: (producto.vendidos || 0) + cantidad
            });
        }
        
        // Guardamos el pedido una vez que se haya actualizado el stock correctamente
        return await nuevoPedido.save();
    } catch (error) {
        throw error;
    }
};

/**
 * Actualiza un pedido existente y ajusta el stock de productos
 */
// Función actualizada para actualizar pedido
const actualizarPedido = async (id, data) => {
    // Obtenemos el pedido actual para comparar los productos
    const pedidoActual = await Pedido.findById(id)
        .populate('productos.productoId');
    
    if (!pedidoActual) {
        throw new Error('Pedido no encontrado');
    }
    
    try {
        // Caso especial: Pedido pasando a estado rechazado
        if (data.estado === 'rechazado' && pedidoActual.estado !== 'rechazado') {
            return await rechazarPedido(id, data.rechazadoPor || data.userId);
        }
        
        // Caso especial: Pedido pasando a estado aprobado_supervisor
        if (data.estado === 'aprobado_supervisor' && pedidoActual.estado === 'pendiente') {
            return await aprobarPedidoPorSupervisor(id, data.aprobadoPorSupervisor || data.userId);
        }
        
        // Caso especial: Pedido pasando a estado en_preparacion
        if (data.estado === 'en_preparacion' && 
            (pedidoActual.estado === 'aprobado_supervisor' || pedidoActual.estado === 'aprobado')) {
            return await marcarPedidoEnPreparacion(id, data.usuarioPreparacion || data.userId);
        }
        
        // Caso especial: Pedido pasando a estado entregado
        if (data.estado === 'entregado' && pedidoActual.estado === 'en_preparacion') {
            return await marcarPedidoEntregado(id, data.usuarioEntrega || data.userId);
        }
        
        // Caso especial: Pedido pasando a estado aprobado final
        if (data.estado === 'aprobado' && 
            (pedidoActual.estado === 'pendiente' || pedidoActual.estado === 'aprobado_supervisor')) {
            return await aprobarPedidoFinal(id, data.aprobadoPor || data.userId);
        }
        
        // Para los demás casos, continúa con la lógica normal de actualización
        
        // Creamos mapas para comparar productos anteriores y nuevos
        const productosAnteriores = pedidoActual.productos.reduce((map, item) => {
            const idProducto = typeof item.productoId === 'object' ? 
                item.productoId._id.toString() : item.productoId.toString();
            map[idProducto] = item.cantidad;
            return map;
        }, {});
        
        // Si no hay cambio en los productos, usamos los existentes
        const productosNuevos = data.productos ? data.productos.reduce((map, item) => {
            map[item.productoId.toString()] = item.cantidad;
            return map;
        }, {}) : productosAnteriores;
        
        // Para cada producto en el nuevo pedido
        for (const [productoId, cantidadNueva] of Object.entries(productosNuevos)) {
            const cantidadAnterior = productosAnteriores[productoId] || 0;
            
            // Si hay más productos que antes, reducimos el stock
            if (cantidadNueva > cantidadAnterior) {
                const diferencia = cantidadNueva - cantidadAnterior;
                const producto = await productoLogic.obtenerPorId(productoId);
                
                if (!producto) {
                    throw new Error(`Producto no encontrado con ID: ${productoId}`);
                }
                
                // Verificar stock SOLO para productos de limpieza
                if (producto.categoria === 'limpieza' && producto.stock < diferencia) {
                    throw new Error(`Stock insuficiente para el producto de limpieza "${producto.nombre}". 
                    Stock actual: ${producto.stock}, Incremento solicitado: ${diferencia}`);
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
            // Si es igual, no hacemos nada
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
        
        // Actualizamos el pedido
        return await Pedido.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
        throw error;
    }
};

/**
 * Elimina un pedido y restaura el stock de productos
 */
// Modified function to avoid duplicate stock restoration
const eliminarPedido = async (id) => {
    // Obtenemos el pedido para restaurar el stock
    const pedido = await Pedido.findById(id);
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
    try {
        // Restauramos el stock de cada producto SOLO si el pedido NO está rechazado
        // ya que si está rechazado, el stock ya fue restaurado previamente
        if (pedido.estado !== 'rechazado') {
            for (const item of pedido.productos) {
                const productoId = typeof item.productoId === 'object' ? item.productoId._id : item.productoId;
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
        } else {
            console.log(`Pedido ${id} ya está rechazado, no se restaura stock al eliminarlo.`);
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
                pedidosAprobadosSupervisor: { 
                    $sum: { $cond: [{ $eq: ['$estado', 'aprobado_supervisor'] }, 1, 0] } 
                },
                pedidosEnPreparacion: { 
                    $sum: { $cond: [{ $eq: ['$estado', 'en_preparacion'] }, 1, 0] } 
                },
                pedidosEntregados: { 
                    $sum: { $cond: [{ $eq: ['$estado', 'entregado'] }, 1, 0] } 
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
            pedidosAprobadosSupervisor: 0,
            pedidosEnPreparacion: 0,
            pedidosEntregados: 0,
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

/**
 * Rechaza un pedido y restaura el stock
 * @param {string} id - ID del pedido
 * @param {string} userId - ID del usuario que rechaza el pedido
 */
const rechazarPedido = async (id, userId) => {
    // Obtenemos el pedido 
    const pedido = await Pedido.findById(id)
        .populate('productos.productoId');
    
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
    // Solo restauramos el stock si el pedido no estaba ya rechazado
    if (pedido.estado !== 'rechazado') {
        try {
            // Restauramos el stock de cada producto
            for (const item of pedido.productos) {
                const productoId = typeof item.productoId === 'object' ? item.productoId._id : item.productoId;
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
            
            // Actualizamos el estado del pedido a rechazado
            pedido.estado = 'rechazado';
            pedido.fechaRechazo = new Date();
            pedido.rechazadoPor = userId;
            await pedido.save();
            
            return pedido;
        } catch (error) {
            throw error;
        }
    } else {
        // Si ya estaba rechazado, simplemente devolvemos el pedido
        return pedido;
    }
};

/**
 * Aprueba un pedido por parte de un supervisor (primer nivel)
 * @param {string} id - ID del pedido
 * @param {string} userId - ID del supervisor que aprueba
 */
const aprobarPedidoPorSupervisor = async (id, userId) => {
    // Obtenemos el pedido
    const pedido = await Pedido.findById(id);
    
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
    // Solo se pueden aprobar pedidos pendientes
    if (pedido.estado !== 'pendiente') {
        throw new Error('Solo se pueden aprobar por supervisor pedidos en estado pendiente');
    }
    
    // Actualizar el estado del pedido
    pedido.estado = 'aprobado_supervisor';
    pedido.fechaAprobacionSupervisor = new Date();
    pedido.aprobadoPorSupervisor = userId;
    
    await pedido.save();
    
    return pedido;
};

/**
 * Marca un pedido como en preparación
 * @param {string} id - ID del pedido
 * @param {string} userId - ID del usuario que marca como en preparación
 */
const marcarPedidoEnPreparacion = async (id, userId) => {
    // Obtenemos el pedido
    const pedido = await Pedido.findById(id);
    
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
    // Solo se pueden marcar como en preparación pedidos aprobados o aprobados por supervisor
    if (pedido.estado !== 'aprobado' && pedido.estado !== 'aprobado_supervisor') {
        throw new Error('Solo se pueden marcar como en preparación pedidos aprobados por supervisor o aprobados definitivamente');
    }
    
    // Actualizar el estado del pedido
    pedido.estado = 'en_preparacion';
    pedido.fechaPreparacion = new Date();
    pedido.usuarioPreparacion = userId;
    
    await pedido.save();
    
    return pedido;
};

/**
 * Marca un pedido como entregado
 * @param {string} id - ID del pedido
 * @param {string} userId - ID del usuario que marca como entregado
 */
const marcarPedidoEntregado = async (id, userId) => {
    // Obtenemos el pedido
    const pedido = await Pedido.findById(id);
    
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
    // Solo se pueden marcar como entregados pedidos en preparación
    if (pedido.estado !== 'en_preparacion') {
        throw new Error('Solo se pueden marcar como entregados pedidos en preparación');
    }
    
    // Actualizar el estado del pedido
    pedido.estado = 'entregado';
    pedido.fechaEntrega = new Date();
    pedido.usuarioEntrega = userId;
    
    await pedido.save();
    
    return pedido;
};

/**
 * Aprueba un pedido definitivamente (nivel admin)
 * @param {string} id - ID del pedido
 * @param {string} userId - ID del administrador que aprueba
 */
const aprobarPedidoFinal = async (id, userId) => {
    // Obtenemos el pedido
    const pedido = await Pedido.findById(id)
        .populate('productos.productoId');
    
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
    // Solo se pueden aprobar definitivamente pedidos pendientes o aprobados por supervisor
    if (pedido.estado !== 'pendiente' && pedido.estado !== 'aprobado_supervisor') {
        throw new Error('Solo se pueden aprobar definitivamente pedidos pendientes o aprobados por supervisor');
    }
    
    // Si el pedido estaba rechazado y ahora se aprueba, debemos reducir el stock nuevamente
    if (pedido.estado === 'rechazado') {
        // Reducir el stock de cada producto en el pedido
        for (const item of pedido.productos) {
            const productoId = typeof item.productoId === 'object' ? 
                item.productoId._id : item.productoId;
            const cantidad = item.cantidad;
            
            // Obtener producto actual
            const producto = await productoLogic.obtenerPorId(productoId);
            
            if (!producto) {
                throw new Error(`Producto no encontrado con ID: ${productoId}`);
            }
            
            // Verificar stock SOLO para productos de limpieza
            if (producto.categoria === 'limpieza' && producto.stock < cantidad) {
                throw new Error(`Stock insuficiente para el producto de limpieza "${producto.nombre}". 
                No se puede aprobar el pedido debido a falta de stock.`);
            }
            
            // Reducir el stock nuevamente
            await productoLogic.actualizarProducto(productoId, {
                stock: producto.stock - cantidad,
                vendidos: (producto.vendidos || 0) + cantidad
            });
        }
    }
    
    // Actualizar el estado del pedido
    pedido.estado = 'aprobado';
    pedido.fechaAprobacion = new Date();
    pedido.aprobadoPor = userId;
    
    await pedido.save();
    
    return pedido;
};

/**
 * Obtiene pedidos por ID de supervisor y rango de fechas
 */
const obtenerPedidosPorSupervisorIdYRangoDeFechas = async (supervisorId, fechaInicio, fechaFin, opciones = {}) => {
    const { limit = 50, skip = 0, sort = { fecha: -1 } } = opciones;
    
    // Procesar fechas en formato dd/mm/aaaa o ISO
    const fechaInicioObj = procesarFecha(fechaInicio, true); // Inicio del día
    const fechaFinObj = procesarFecha(fechaFin, false); // Fin del día

    // Primero encontrar todos los subServicios donde este usuario es supervisor
    const Cliente = mongoose.model('Cliente');
    const clientesDelSupervisor = await Cliente.find({ 
        'subServicios.supervisorId': new mongoose.Types.ObjectId(supervisorId) 
    }).select('_id subServicios');
    
    // Extraer los IDs de subServicios donde este usuario es supervisor
    const subServiciosIds = [];
    
    clientesDelSupervisor.forEach(cliente => {
        cliente.subServicios.forEach(subServ => {
            if (subServ.supervisorId && 
                subServ.supervisorId.toString() === supervisorId.toString()) {
                subServiciosIds.push(subServ._id);
            }
        });
    });
    
    // Buscar pedidos donde:
    // 1. El supervisor está asignado directamente al pedido, O
    // 2. El pedido tiene un subServicio donde el usuario es supervisor
    // Y que estén dentro del rango de fechas
    return await Pedido.find({
        $or: [
            { supervisorId: new mongoose.Types.ObjectId(supervisorId) },
            { 'cliente.subServicioId': { $in: subServiciosIds } }
        ],
        fecha: { $gte: fechaInicioObj, $lte: fechaFinObj }
    })
    .populate('userId', 'nombre email usuario apellido role')
    .populate('supervisorId', 'nombre email usuario apellido role')
    .populate('productos.productoId')
    .populate('cliente.clienteId', 'nombre email telefono')
    .sort(sort)
    .skip(skip)
    .limit(limit);
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
    procesarFecha,
    rechazarPedido,
    aprobarPedidoPorSupervisor,
    marcarPedidoEnPreparacion,
    marcarPedidoEntregado,
    aprobarPedidoFinal,
    obtenerPedidosPorSupervisorIdYRangoDeFechas
};
