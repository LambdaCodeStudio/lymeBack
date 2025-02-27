const Pedido = require('../models/pedidoSchema');
const productoLogic = require('../logic/productoLogic'); // Importamos la lógica de productos

const obtenerPedidos = async () => {
    return await Pedido.find().populate('userId', 'nombre email').populate('productos.productoId');
};

const obtenerPedidoPorId = async (id) => {
    return await Pedido.findById(id).populate('userId', 'nombre email').populate('productos.productoId');
};

const obtenerPedidosPorUserId = async (userId) => {
    return await Pedido.find({ userId }).populate('userId', 'nombre email').populate('productos.productoId');
};

const obtenerPedidosPorServicio = async (servicio) => {
    return await Pedido.find({ servicio }).populate('userId', 'nombre email').populate('productos.productoId');
};

const obtenerPedidosPorRangoDeFechas = async (fechaInicio, fechaFin) => {
    return await Pedido.find({
        fecha: { $gte: new Date(fechaInicio), $lte: new Date(fechaFin) }
    }).populate('userId', 'nombre email').populate('productos.productoId');
};

// Función actualizada para crear pedido y reducir stock
const crearPedido = async (data) => {
    // Creamos el pedido primero
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
            
            // Reducir el stock (actualizar producto)
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

// Función actualizada para actualizar pedido
const actualizarPedido = async (id, data) => {
    // Obtenemos el pedido actual para comparar los productos
    const pedidoActual = await Pedido.findById(id);
    if (!pedidoActual) {
        throw new Error('Pedido no encontrado');
    }
    
    try {
        // Creamos mapas para comparar productos anteriores y nuevos
        const productosAnteriores = pedidoActual.productos.reduce((map, item) => {
            const idProducto = typeof item.productoId === 'object' ? item.productoId._id.toString() : item.productoId.toString();
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

// Función actualizada para eliminar pedido
const eliminarPedido = async (id) => {
    // Obtenemos el pedido para restaurar el stock
    const pedido = await Pedido.findById(id);
    if (!pedido) {
        throw new Error('Pedido no encontrado');
    }
    
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
        
        // Eliminamos el pedido
        return await Pedido.findByIdAndDelete(id);
    } catch (error) {
        throw error;
    }
};

const obtenerPedidosOrdenados = async () => {
    return await Pedido.find()
        .populate('userId', 'nombre email')
        .populate('productos.productoId')
        .sort({ servicio: 1, seccionDelServicio: 1 });
};

module.exports = {
    obtenerPedidos,
    obtenerPedidoPorId,
    obtenerPedidosPorUserId,
    obtenerPedidosPorServicio,
    obtenerPedidosPorRangoDeFechas,
    crearPedido,
    actualizarPedido,
    eliminarPedido,
    obtenerPedidosOrdenados
};