const mongoose = require('mongoose');

const conductorSchema = new mongoose.Schema({
    nombre: {
        type: String, 
        required: true, 
        trim: true
    },
    dni: {
        type: String, 
        required: true, 
        trim: true,
        unique: true // Agregamos unique para evitar DNIs duplicados
    }
}, {
    timestamps: true // Esto agrega automáticamente createdAt y updatedAt
});

// Índice para búsquedas eficientes
conductorSchema.index({ dni: 1 });
conductorSchema.index({ nombre: 1 });

module.exports = mongoose.model('Conductor', conductorSchema);