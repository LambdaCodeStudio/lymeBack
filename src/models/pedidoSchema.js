// src/models/pedidoSchema.js
const mongoose = require('mongoose');

// Esquema de Contador (mantenemos igual para compatibilidad)
const contadorSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        required: true 
    },
    secuencia: { 
        type: Number, 
        default: 0 
    }
});

const Contador = mongoose.model('Contador', contadorSchema);

// Función para obtener el siguiente número de pedido
async function obtenerSiguienteNumero(nombreColeccion) {
    const contador = await Contador.findByIdAndUpdate(
        nombreColeccion, 
        { $inc: { secuencia: 1 } }, 
        { new: true, upsert: true }
    );
    return contador.secuencia;
}

// Esquema para la referencia jerárquica del cliente
const ubicacionClienteSchema = new mongoose.Schema({
    clienteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente',
        required: true
    },
    subServicioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente.subServicios'
    },
    subUbicacionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente.subServicios.subUbicaciones'
    },
    // Mantener campos de texto para compatibilidad y búsquedas rápidas
    nombreCliente: {
        type: String,
        required: true
    },
    nombreSubServicio: {
        type: String
    },
    nombreSubUbicacion: {
        type: String
    }
});

const pedidoSchema = new mongoose.Schema({
    nPedido: {
        type: Number,
        unique: true,
        index: true // Añadimos índice para búsquedas rápidas por número
    },
    // Nueva estructura jerárquica de cliente
    cliente: {
        type: ubicacionClienteSchema,
        required: true
    },
    // Mantenemos campos antiguos para compatibilidad con código existente
    servicio: { 
        type: String, 
        required: true 
    },
    seccionDelServicio: {
        type: String,
        default: ''
    },
    // Usuario que creó el pedido (puede ser operario/supervisor)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Índice para filtrar por operario
    },
    // Supervisor asignado al pedido (para filtros)
    supervisorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true // Índice para filtrar por supervisor
    },
    fecha: {
        type: Date,
        default: Date.now,
        index: true // Índice para búsquedas por rango de fechas
    },
    productos: [
        {
            productoId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Producto',
                index: true // Índice para filtrar por producto
            },
            cantidad: {
                type: Number,
                required: true,
                min: [1, 'La cantidad mínima es 1']
            },
            // Precio al momento de la compra (para historial)
            precioUnitario: {
                type: Number
            }
        }
    ],
    detalle: {
        type: String,
        default: ''
    },
    estado: {
        type: String,
        enum: ['pendiente', 'aprobado', 'rechazado'],
        default: 'pendiente',
        index: true // Índice para filtrar por estado
    },
    // Campos para tracking y auditoría
    fechaAprobacion: {
        type: Date
    },
    aprobadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    observaciones: {
        type: String,
        default: ''
    }
}, {
    timestamps: true // Añade createdAt y updatedAt automáticamente
});

// Middleware pre-save para generar el número de pedido
pedidoSchema.pre('save', async function(next) {
    // Si es un nuevo pedido, generar número secuencial
    if (this.isNew) {
        this.nPedido = await obtenerSiguienteNumero('pedidos');
        
        // Si el pedido tiene campos de cliente nuevos pero no los antiguos, rellenarlos
        if (this.cliente && this.cliente.nombreCliente && !this.servicio) {
            this.servicio = this.cliente.nombreCliente;
            if (this.cliente.nombreSubServicio) {
                this.seccionDelServicio = this.cliente.nombreSubServicio;
            }
        }
    }
    next();
});

// Índices compuestos para consultas frecuentes
pedidoSchema.index({ 'cliente.clienteId': 1, fecha: -1 }); // Pedidos de un cliente ordenados por fecha
pedidoSchema.index({ 'cliente.subServicioId': 1, fecha: -1 }); // Pedidos de un subservicio
pedidoSchema.index({ supervisorId: 1, estado: 1, fecha: -1 }); // Pedidos de un supervisor por estado
pedidoSchema.index({ 'productos.productoId': 1, fecha: -1 }); // Pedidos que contienen un producto

// Métodos estáticos para filtros comunes
pedidoSchema.statics.filtrarPorRangoFechas = function(fechaInicio, fechaFin) {
    // Si las fechas son strings, convertirlas a objetos Date
    if (typeof fechaInicio === 'string') {
        const partesFechaInicio = fechaInicio.split('/');
        if (partesFechaInicio.length === 3) {
            fechaInicio = new Date(
                parseInt(partesFechaInicio[2]), // año
                parseInt(partesFechaInicio[1]) - 1, // mes (0-11)
                parseInt(partesFechaInicio[0]) // día
            );
        } else {
            fechaInicio = new Date(fechaInicio);
        }
    }
    
    if (typeof fechaFin === 'string') {
        const partesFechaFin = fechaFin.split('/');
        if (partesFechaFin.length === 3) {
            fechaFin = new Date(
                parseInt(partesFechaFin[2]), // año
                parseInt(partesFechaFin[1]) - 1, // mes (0-11)
                parseInt(partesFechaFin[0]) // día
            );
            // Ajustar al final del día
            fechaFin.setHours(23, 59, 59, 999);
        } else {
            fechaFin = new Date(fechaFin);
        }
    }
    
    return this.find({
        fecha: { 
            $gte: fechaInicio, 
            $lte: fechaFin 
        }
    }).sort({ fecha: -1 });
};

pedidoSchema.statics.filtrarPorProducto = function(productoId) {
    return this.find({
        'productos.productoId': productoId
    });
};

pedidoSchema.statics.filtrarPorSupervisor = function(supervisorId) {
    return this.find({
        supervisorId: supervisorId
    }).sort({ fecha: -1 });
};

pedidoSchema.statics.filtrarPorCliente = function(clienteId, subServicioId = null, subUbicacionId = null) {
    const filtro = { 'cliente.clienteId': clienteId };
    
    if (subServicioId) {
        filtro['cliente.subServicioId'] = subServicioId;
        
        if (subUbicacionId) {
            filtro['cliente.subUbicacionId'] = subUbicacionId;
        }
    }
    
    return this.find(filtro).sort({ fecha: -1 });
};

const Pedido = mongoose.model('Pedido', pedidoSchema);

module.exports = {
    Pedido,
    Contador
};