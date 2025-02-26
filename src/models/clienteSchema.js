const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
    servicio: { 
        type: String, 
        required: true 
    },
    seccionDelServicio: {
        type: String,
        default: ' ' 
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',    // Asegúrate de que tenga esta referencia
        required: true
    },
    createdBy: {        // Nuevo campo para el creador
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { 
    timestamps: true    // Agrega createdAt y updatedAt
});

module.exports = mongoose.model('Cliente', clienteSchema);