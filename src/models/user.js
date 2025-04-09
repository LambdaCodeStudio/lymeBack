const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ROLES = require('../constants/roles');

const userSchema = new mongoose.Schema({
  usuario: { 
    type: String, 
    required: [true, 'El nombre de usuario es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres'],
    maxlength: [50, 'El nombre de usuario no puede exceder 50 caracteres'],
    match: [/^[a-zA-Z0-9_\.]+$/, 'El nombre de usuario solo puede contener letras, números, puntos y guiones bajos']
  },
  password: { 
    type: String, 
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // No incluir por defecto en consultas
  },
  role: { 
    type: String, 
    enum: {
      values: Object.values(ROLES),
      message: 'Rol no válido. Roles permitidos: {values}'
    },
    required: [true, 'El rol es requerido'],
    index: true // Indexar para búsquedas frecuentes por rol
  },
  celular: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v) {
        // Permitir vacío o formato válido de teléfono internacional
        return v === '' || /^\+?[0-9]{8,15}$/.test(v);
      },
      message: props => `${props.value} no es un número de teléfono válido`
    }
  },
  nombre: { 
    type: String,
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  apellido: { 
    type: String,
    trim: true,
    maxlength: [100, 'El apellido no puede exceder 100 caracteres']
  },
  direccion: { 
    type: String,
    trim: true,
    maxlength: [200, 'La dirección no puede exceder 200 caracteres']
  },
  ciudad: { 
    type: String,
    trim: true,
    maxlength: [100, 'La ciudad no puede exceder 100 caracteres']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Indexar para búsquedas frecuentes por estado
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true // Indexar para búsquedas por creador
  },
  // Nuevo campo para supervisores de operarios
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    validate: {
      validator: function(v) {
        // Solo permitir supervisorId para operarios
        return this.role === ROLES.OPERARIO;
      },
      message: 'El supervisorId solo es válido para operarios'
    }
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true // Indexar para búsquedas por fecha de expiración
  },
  secciones: {
    type: String,
    enum: {
      values: ['limpieza', 'mantenimiento', 'ambos'],
      message: 'Sección no válida. Secciones permitidas: limpieza, mantenimiento, ambos'
    },
    required: [true, 'La sección es requerida'],
    index: true // Indexar para búsquedas por sección
  },
  // Nuevo campo para productos favoritos
  favoritos: {
    type: [{ 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto'
    }],
    default: [],
    index: true // Indexar para búsquedas rápidas
  }
}, { 
  timestamps: true, // Mantener createdAt y updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password; // Asegurar que la contraseña nunca se incluya en JSON
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Campo virtual para nombre completo
userSchema.virtual('nombreCompleto').get(function() {
  if (this.nombre && this.apellido) {
    return `${this.nombre} ${this.apellido}`;
  } else if (this.nombre) {
    return this.nombre;
  } else if (this.apellido) {
    return this.apellido;
  }
  return this.usuario;
});

// Middleware para hashear contraseña antes de guardar
userSchema.pre('save', async function(next) {
  // Solo hashear la contraseña si ha sido modificada o es nueva
  if (!this.isModified('password')) return next();
  
  try {
    // Generar salt único para cada usuario
    const salt = await bcrypt.genSalt(10);
    // Hashear la contraseña con el salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware para garantizar que el administrador principal siempre esté activo
userSchema.pre('save', function(next) {
  if (this.role === ROLES.ADMIN && !this.createdBy && this.isModified('isActive')) {
    this.isActive = true; // Forzar que esté activo
  }
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error al comparar contraseñas');
  }
};

// Método para verificar si un usuario está expirado
userSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Método para extender la expiración de un operario temporal
userSchema.methods.extendExpiration = async function(minutes = 30) {
  if (this.role !== ROLES.OPERARIO) return false;
  
  const newExpiration = new Date();
  newExpiration.setMinutes(newExpiration.getMinutes() + minutes);
  
  this.expiresAt = newExpiration;
  this.isActive = true;
  
  await this.save();
  return true;
};

// Índices compuestos para consultas frecuentes
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ usuario: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 
  usuario: 'text', 
  nombre: 'text', 
  apellido: 'text' 
}, {
  weights: {
    usuario: 10,
    nombre: 5,
    apellido: 5
  },
  name: 'text_search_index'
});

// Exportar el modelo
module.exports = mongoose.model('User', userSchema);