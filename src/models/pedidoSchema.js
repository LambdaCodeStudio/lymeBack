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

// Esquema para productos dentro de un combo
const comboItemPedidoSchema = new mongoose.Schema({
    productoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Producto'
    },
    nombre: {
        type: String,
        required: true
    },
    cantidad: {
        type: Number,
        required: true,
        min: [1, 'La cantidad mínima es 1']
    },
    precio: {
        type: Number
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
    servicio: [{ 
        type: String, 
        default:"Todos los servicios" 
    }],
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
    // Operario original que creó el pedido (si se asignó a un supervisor)
    operarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true // Índice para filtrar por operario original
    },
    // Supervisor asignado al pedido
    // NOTA: Ahora se puede obtener del subServicioId si existe, pero mantenemos para compatibilidad
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
            nombre: {
                type: String, // Nombre del producto/combo al momento de la compra
                required: true
            },
            cantidad: {
                type: Number,
                required: true,
                min: [1, 'La cantidad mínima es 1']
            },
            precio: {
                type: Number, // Precio al momento de la compra
                required: true
            },
            // Campos para combos
            esCombo: {
                type: Boolean,
                default: false
            },
            personalizado: {
                type: Boolean,
                default: false
            },
            comboItems: {
                type: [comboItemPedidoSchema],
                default: []
            },
            // Campos opcionales para categorización
            categoria: {
                type: String
            },
            subCategoria: {
                type: String
            }
        }
    ],
    detalle: {
        type: String,
        default: ''
    },
    // Campo para metadata adicional
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Estados del pedido actualizados
    estado: {
        type: String,
        enum: ['pendiente', 'aprobado_supervisor', 'en_preparacion', 'entregado', 'aprobado', 'rechazado'],
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
    // Nuevos campos para tracking de estados adicionales
    fechaAprobacionSupervisor: {
        type: Date
    },
    aprobadoPorSupervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    fechaPreparacion: {
        type: Date
    },
    usuarioPreparacion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    fechaEntrega: {
        type: Date
    },
    usuarioEntrega: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    fechaRechazo: {
        type: Date
    },
    rechazadoPor: {
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

// Middleware pre-save para generar el número de pedido y obtener supervisor del subServicio
pedidoSchema.pre('save', async function(next) {
    try {
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
            
            // Si hay un subServicioId pero no hay supervisorId, buscar si el subServicio tiene un supervisor asignado
            if (this.cliente && this.cliente.subServicioId && !this.supervisorId) {
                try {
                    const Cliente = mongoose.model('Cliente');
                    const cliente = await Cliente.findById(this.cliente.clienteId);
                    
                    if (cliente) {
                        // Buscar el subServicio correspondiente
                        const subServicio = cliente.subServicios.id(this.cliente.subServicioId);
                        
                        if (subServicio && subServicio.supervisorId) {
                            // Asignar el supervisor del subServicio al pedido
                            this.supervisorId = subServicio.supervisorId;
                        }
                    }
                } catch (err) {
                    console.error('Error al obtener supervisor de subServicio:', err);
                    // Continuar sin asignar supervisor
                }
            }
        }
        next();
    } catch (error) {
        next(error);
    }
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
        $or: [
            { supervisorId: supervisorId },
            { 'cliente.subServicioId': { $exists: true } }
        ]
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