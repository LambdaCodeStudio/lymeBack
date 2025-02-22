const Pedido = require('../models/pedidoSchema');

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

const crearPedido = async (data) => {
    const nuevoPedido = new Pedido(data);
    return await nuevoPedido.save();
};

const actualizarPedido = async (id, data) => {
    return await Pedido.findByIdAndUpdate(id, data, { new: true });
};

const eliminarPedido = async (id) => {
    return await Pedido.findByIdAndDelete(id);
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
