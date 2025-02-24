const mongoose = require('mongoose');

const pedidoSchema = new mongoose.Schema({
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
    ]
});    

module.exports = mongoose.model('Pedido', pedidoSchema);