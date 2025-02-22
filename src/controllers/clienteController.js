const clienteLogic = require('../logic/clienteLogic');

exports.getClientes = async (req, res) => {
    try {
        const clientes = await clienteLogic.obtenerClientes();
        res.json(clientes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener clientes', error });
    }
};

exports.getClienteById = async (req, res) => {
    try {
        const cliente = await clienteLogic.obtenerClientePorId(req.params.id);
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        res.json(cliente);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener cliente', error });
    }
};

exports.createCliente = async (req, res) => {
    try {
        const nuevoCliente = await clienteLogic.crearCliente(req.body);
        res.status(201).json(nuevoCliente);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear cliente', error });
    }
};

exports.updateCliente = async (req, res) => {
    try {
        const clienteActualizado = await clienteLogic.actualizarCliente(req.params.id, req.body);
        if (!clienteActualizado) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        res.json(clienteActualizado);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar cliente', error });
    }
};

exports.deleteCliente = async (req, res) => {
    try {
        const clienteEliminado = await clienteLogic.eliminarCliente(req.params.id);
        if (!clienteEliminado) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar cliente', error });
    }
};

exports.getClientesByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const clientes = await clienteLogic.obtenerClientesPorUserId(userId);
        res.json(clientes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener clientes por userId', error });
    }
};