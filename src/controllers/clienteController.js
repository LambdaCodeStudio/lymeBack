// Corrige esta línea para que coincida con el nombre real de tu archivo
const Cliente = require('../models/clienteSchema'); 
const mongoose = require('mongoose');

// Obtener todos los clientes
exports.getClientes = async (req, res) => {
    try {
        // Obtener todos los clientes, incluyendo aquellos con referencia a usuarios que ya no existen
        const clientes = await Cliente.find()
            .populate('userId', 'email usuario nombre apellido role isActive') // Población de datos del usuario
            .exec();
        
        // Procesar los clientes para marcar aquellos que necesitan reasignación
        const clientesProcesados = clientes.map(cliente => {
            const clienteObj = cliente.toObject();
            
            // Verificar si el userId existe y es una referencia válida
            // Si userId es null, undefined, o no se pudo poblar (porque el usuario ya no existe)
            const necesitaReasignacion = !cliente.userId || 
                (typeof cliente.userId === 'object' && cliente.userId.isActive === false);
            
            if (necesitaReasignacion) {
                clienteObj.requiereAsignacion = true;
            }
            
            return clienteObj;
        });
        
        res.json(clientesProcesados);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener clientes', error: error.message });
    }
};

// Obtener cliente por ID
exports.getClienteById = async (req, res) => {
    try {
        const cliente = await Cliente.findById(req.params.id)
            .populate('userId', 'email usuario nombre apellido role isActive')
            .exec();
        
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        
        // Verificar si requiere reasignación
        const clienteObj = cliente.toObject();
        const necesitaReasignacion = !cliente.userId || 
            (typeof cliente.userId === 'object' && cliente.userId.isActive === false);
        
        if (necesitaReasignacion) {
            clienteObj.requiereAsignacion = true;
        }
        
        res.json(clienteObj);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener cliente', error: error.message });
    }
};

// Obtener clientes por ID de usuario
exports.getClientesByUserId = async (req, res) => {
    try {
        const clientes = await Cliente.find({ userId: req.params.userId })
            .populate('userId', 'email usuario nombre apellido role isActive')
            .exec();
        
        // Procesar los clientes para verificar si requieren reasignación
        const clientesProcesados = clientes.map(cliente => {
            const clienteObj = cliente.toObject();
            
            const necesitaReasignacion = !cliente.userId || 
                (typeof cliente.userId === 'object' && cliente.userId.isActive === false);
            
            if (necesitaReasignacion) {
                clienteObj.requiereAsignacion = true;
            }
            
            return clienteObj;
        });
        
        res.json(clientesProcesados);
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
            .populate('userId', 'email usuario nombre apellido role isActive')
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
        .populate('userId', 'email usuario nombre apellido role isActive')
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

// Obtener clientes sin asignar (sin userId o con usuario inactivo)
exports.getClientesSinAsignar = async (req, res) => {
    try {
        // Obtener clientes sin userId
        const clientesSinUsuario = await Cliente.find({ userId: { $exists: false } }).exec();
        
        // Obtener referencia a usuarios inactivos
        const User = mongoose.model('User'); // Asumiendo que el modelo de usuario está registrado como 'User'
        const usuariosInactivos = await User.find({ isActive: false }, '_id').exec();
        const idsInactivos = usuariosInactivos.map(u => u._id);
        
        // Obtener clientes con usuarios inactivos
        const clientesUsuarioInactivo = await Cliente.find({ 
            userId: { $in: idsInactivos } 
        })
        .populate('userId', 'email usuario nombre apellido role isActive')
        .exec();
        
        // Combinar y procesar los resultados
        const todosClientesSinAsignar = [
            ...clientesSinUsuario.map(c => {
                const clienteObj = c.toObject();
                clienteObj.requiereAsignacion = true;
                return clienteObj;
            }),
            ...clientesUsuarioInactivo.map(c => {
                const clienteObj = c.toObject();
                clienteObj.requiereAsignacion = true;
                return clienteObj;
            })
        ];
        
        res.json(todosClientesSinAsignar);
    } catch (error) {
        console.error('Error al obtener clientes sin asignar:', error);
        res.status(500).json({ mensaje: 'Error al obtener clientes sin asignar', error: error.message });
    }
};