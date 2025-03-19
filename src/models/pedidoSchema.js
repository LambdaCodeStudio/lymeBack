const mongoose = require('mongoose');

// Esquema de Contador
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

const pedidoSchema = new mongoose.Schema({
    nPedido: {
        type: Number,
        unique: true
    },
    servicio: { 
        type: String, 
        required: true 
    },
    seccionDelServicio: {
        type: String,
        default: ' '
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    productos: [
        {
            productoId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Producto'
            },
            cantidad: {
                type: Number,
                required: true
            }
        }
    ],
    detalle:{
        type: String,
        default: ' '
    },
    estado: {
        type: String,
        enum: ['pendiente', 'aprobado', 'rechazado'],
        default: 'pendiente'
    }
});

// Middleware pre-save para generar el número de pedido
pedidoSchema.pre('save', async function(next) {
    if (this.isNew) {
        this.nPedido = await obtenerSiguienteNumero('pedidos');
    }
    next();
});

module.exports = {
    Pedido: mongoose.model('Pedido', pedidoSchema),
    Contador: Contador
};