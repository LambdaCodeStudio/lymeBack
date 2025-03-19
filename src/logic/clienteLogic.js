const Cliente = require('../models/clienteSchema');

const obtenerClientes = async () => {
    return await Cliente.find().populate('userId', 'nombre email');
};

const obtenerClientePorId = async (id) => {
    return await Cliente.findById(id).populate('userId', 'nombre email');
};

const crearCliente = async (data) => {
    const cliente = new Cliente(data);
    return await cliente.save();
};

const actualizarCliente = async (id, data) => {
    return await Cliente.findByIdAndUpdate(id, data, { new: true });
};

const eliminarCliente = async (id) => {
    return await Cliente.findByIdAndDelete(id);
};

const obtenerClientesPorUserId = async (userId) => {
    return await Cliente.find({ userId }).populate('userId', 'nombre email');
};

module.exports = {
    obtenerClientes,
    obtenerClientePorId,
    crearCliente,
    actualizarCliente,
    eliminarCliente,
    obtenerClientesPorUserId
};
