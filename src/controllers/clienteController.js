const Cliente = require('../models/Cliente');

// Obtener todos los clientes con información de usuario y creador
exports.getClientes = async (req, res) => {
    try {
        const clientes = await Cliente.find()
            .populate('userId', 'email usuario nombre apellido') // Datos del usuario asignado
            .populate('createdBy', 'email usuario nombre apellido') // Datos del creador
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
            .populate('createdBy', 'email usuario nombre apellido')
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
            .populate('createdBy', 'email usuario nombre apellido')
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
            userId,             // Usuario asignado al cliente
            createdBy: req.user.id  // Usuario que crea el cliente (del middleware auth)
        });
        
        await cliente.save();
        
        // Devolver el cliente con información poblada
        const clienteCreado = await Cliente.findById(cliente._id)
            .populate('userId', 'email usuario nombre apellido')
            .populate('createdBy', 'email usuario nombre apellido')
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
            { 
                servicio, 
                seccionDelServicio, 
                userId
                // No actualizamos createdBy ya que eso no debe cambiar
            },
            { new: true }
        )
        .populate('userId', 'email usuario nombre apellido')
        .populate('createdBy', 'email usuario nombre apellido')
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
        const clienteEliminado = await Cliente.findByIdAndRemove(req.params.id);
        
        if (!clienteEliminado) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar cliente', error: error.message });
    }
};