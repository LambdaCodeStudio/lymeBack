const pedidoLogic = require('../logic/pedidoLogic');

exports.getPedidos = async (req, res) => {
    try {
        const pedidos = await pedidoLogic.obtenerPedidos();
        res.json(pedidos);
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ mensaje: 'Error al obtener pedidos', error: error.message });
    }
};

exports.getPedidoById = async (req, res) => {
    try {
        const pedido = await pedidoLogic.obtenerPedidoPorId(req.params.id);
        res.json(pedido);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener el pedido ', error });
    }
};

exports.getPedidosByUserId = async (req, res) => {
    try {
        const pedidos = await pedidoLogic.obtenerPedidosPorUserId(req.params.userId);
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener pedidos por userId', error });
    }
};

exports.getPedidosByServicio = async (req, res) => {
    try {
        const pedidos = await pedidoLogic.obtenerPedidosPorServicio(req.params.servicio);
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener pedidos por servicio', error });
    }
};

exports.getPedidosByFecha = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const pedidos = await pedidoLogic.obtenerPedidosPorRangoDeFechas(fechaInicio, fechaFin);
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener pedidos por fecha', error });
    }
};

exports.createPedido = async (req, res) => {
    try {
        const pedido = await pedidoLogic.crearPedido(req.body);
        res.status(201).json(pedido);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear pedido, verifique el stock de los productos, previo a hacer la compra.', error });
    }
};

exports.updatePedido = async (req, res) => {
    try {
        const pedido = await pedidoLogic.actualizarPedido(req.params.id, req.body);
        res.json(pedido);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar pedido', error });
    }
};

exports.deletePedido = async (req, res) => {
    try {
        await pedidoLogic.eliminarPedido(req.params.id);
        res.json({ mensaje: 'Pedido eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar pedido', error });
    }
};

exports.getPedidosOrdenados = async (req, res) => {
    try {
        const pedidos = await pedidoLogic.obtenerPedidosOrdenados();
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener pedidos ordenados', error });
    }
};
