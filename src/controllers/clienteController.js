// Corrige esta línea para que coincida con el nombre real de tu archivo
const Cliente = require('../models/clienteSchema'); 

// Obtener todos los clientes
exports.getClientes = async (req, res) => {
    try {
        const clientes = await Cliente.find()
            .populate('userId', 'email usuario nombre apellido') // Población de datos del usuario
            .exec();
        
        res.json(clientes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener clientes', error: error.message });
    }
};

// Obtener cliente por ID
exports.getClienteById = async (req, res) => {
    try {
        const cliente = await Cliente.findById(req.params.id)
            .populate('userId', 'email usuario nombre apellido')
            .exec();
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        res.json(cliente);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener cliente', error: error.message });
    }
};

// Obtener clientes por ID de usuario
exports.getClientesByUserId = async (req, res) => {
    try {
        const clientes = await Cliente.find({ userId: req.params.userId })
            .populate('userId', 'email usuario nombre apellido')
            .exec();
        
        res.json(clientes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener clientes', error: error.message });
    }
};

// Crear nuevo cliente
exports.createCliente = async (req, res) => {
    try {
        const { servicio, seccionDelServicio, userId } = req.body;
        
        const cliente = new Cliente({
            servicio,
            seccionDelServicio,
            userId
        });
        
        await cliente.save();
        
        // Devolver el cliente con información de usuario poblada
        const clienteCreado = await Cliente.findById(cliente._id)
            .populate('userId', 'email usuario nombre apellido')
            .exec();
        
        res.status(201).json(clienteCreado);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear cliente', error: error.message });
    }
};

// Actualizar cliente
exports.updateCliente = async (req, res) => {
    try {
        const { servicio, seccionDelServicio, userId } = req.body;
        
        const clienteActualizado = await Cliente.findByIdAndUpdate(
            req.params.id,
            { servicio, seccionDelServicio, userId },
            { new: true }
        )
        .populate('userId', 'email usuario nombre apellido')
        .exec();
        
        if (!clienteActualizado) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        res.json(clienteActualizado);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar cliente', error: error.message });
    }
};

// Eliminar cliente
exports.deleteCliente = async (req, res) => {
    try {
        const resultado = await Cliente.deleteOne({ _id: req.params.id });
        
        if (resultado.deletedCount === 0) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar cliente', error: error.message });
    }
};