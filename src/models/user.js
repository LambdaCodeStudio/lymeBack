const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ROLES = require('../constants/roles');

const userSchema = new mongoose.Schema({
  usuario: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: Object.values(ROLES),
    required: true
  },
  celular: { 
    type: String, 
    required: false 
  },
  nombre: { 
    type: String, 
    required: false 
  },
  apellido: { 
    type: String, 
    required: false 
  },
  direccion: { 
    type: String, 
    required: false 
  },
  ciudad: { 
    type: String, 
    required: false 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  expiresAt: {
    type: Date,
    default: null
  },
  secciones: {
    type: String,
    enum: ['limpieza', 'mantenimiento', 'ambos'],
    required: true  // Ahora es obligatorio
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', userSchema);