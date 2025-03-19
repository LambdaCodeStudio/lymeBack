// src/models/clienteSchema.js
const mongoose = require('mongoose');

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
  }
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
  // Lista de sububicaciones asociadas a este subservicio
  subUbicaciones: [subUbicacionSchema]
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
  // Mantener compatibilidad con el esquema anterior
  servicio: { 
    type: String,
    default: function() {
      return this.nombre;
    }
  },
  seccionDelServicio: {
    type: String,
    default: ''
  },
  // Referencia al usuario asignado
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Lista de subservicios/ubicaciones
  subServicios: [subServicioSchema],
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
  }
}, {
  timestamps: true // Agregar createdAt y updatedAt
});

// Índices para mejorar el rendimiento de búsquedas
clienteSchema.index({ nombre: 1 });
clienteSchema.index({ userId: 1 });
clienteSchema.index({ 'subServicios.nombre': 1 });

module.exports = mongoose.model('Cliente', clienteSchema);