

// src/models/clienteSchema.js
const mongoose = require('mongoose');
// Importar el schema del receptor
const { receptorSchema } = require('./receptorSchema'); // Ajusta la ruta según tu estructura

// Esquema para las sububicaciones (nivel más bajo)
const subUbicacionSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  domEntrega:{type: String, require:true, trim:true},
});

// Esquema para los subservicios/ubicaciones (nivel medio)
const subServicioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  // Nuevo campo para asignar supervisor al subservicio
  supervisorId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true // Añadimos índice para mejorar rendimiento de búsquedas
  }],
  // Lista de sububicaciones asociadas a este subservicio
  subUbicaciones: [subUbicacionSchema],
  operarios: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
}]
});

// Esquema principal del cliente (nivel superior)
const clienteSchema = new mongoose.Schema({
  // Nombre principal del cliente/servicio
  nombre: { 
    type: String, 
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  // NUEVO: Datos del receptor embebidos
  receptor: {
    type: receptorSchema,
    required: false // Puedes cambiarlo a true si siempre debe tener receptor
  },
  // Lista de subservicios/ubicaciones
  subServicios: [subServicioSchema],
  // Referencia al usuario asignado (se mantiene para compatibilidad)
  userId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Campos adicionales que podrían ser útiles
  direccion: {
    type: String,
    default: ''
  },
  telefono: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  },
  
}, {
  timestamps: true // Agregar createdAt y updatedAt
});

// Índices para mejorar el rendimiento de búsquedas
clienteSchema.index({ nombre: 1 });
clienteSchema.index({ userId: 1 });
clienteSchema.index({ 'subServicios.nombre': 1 });
clienteSchema.index({ 'subServicios.supervisorId': 1 }); // Nuevo índice para buscar por supervisor
clienteSchema.index({ 'receptor.cuitDni': 1 }); // Nuevo índice para buscar por CUIT/DNI del receptor

module.exports = mongoose.model('Cliente', clienteSchema);