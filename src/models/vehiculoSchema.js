const mongoose = require('mongoose');

const vehiculoSchema = new mongoose.Schema({
    marca: {
        type: String, 
        required: true, 
        trim: true
    },
    modelo: {
        type: String, 
        required: true, 
        trim: true
    },
    patente: {
        type: String, 
        required: true, 
        trim: true,
        unique: true, // Agregamos unique para evitar patentes duplicadas
        uppercase: true // Convierte automáticamente a mayúsculas
    }
}, {
    timestamps: true // Esto agrega automáticamente createdAt y updatedAt
});

// Índices para búsquedas eficientes
vehiculoSchema.index({ patente: 1 });
vehiculoSchema.index({ marca: 1, modelo: 1 });

module.exports = mongoose.model('Vehiculo', vehiculoSchema);