// src/models/productoSchema.js
const mongoose = require('mongoose');

// Esquema para los ítems dentro de un combo
const comboItemSchema = new mongoose.Schema({
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: [1, 'La cantidad mínima es 1']
  }
});

const productoSchema = new mongoose.Schema({
  nombre: { 
    type: String, 
    required: true 
  },
  descripcion: { 
    type: String
  },
  categoria: { 
    type: String, 
    required: true, 
    enum: ['limpieza', 'mantenimiento'] 
  },
  subCategoria: { 
    type: String, 
    required: true, 
    enum: ['accesorios','aerosoles','bolsas','estandar','indumentaria','liquidos','papeles',
           'sinClasificarLimpieza','iluminaria','electricidad','cerraduraCortina','pintura',
           'superficiesConstruccion','plomeria', 'calzado'] 
  },
  precio: { 
    type: Number, 
    required: true,
    min: [0, 'El precio no puede ser negativo'] 
  },
  stock: { 
    type: Number, 
    required: true,
    validate: {
      validator: function(value) {
        // Para productos de limpieza, el stock mínimo es 1
        if (this.categoria === 'limpieza') {
          return value >= 1;
        }
        // Para productos de mantenimiento, permitir stock negativo
        return true;
      },
      message: props => {
        if (props.value < 1 && this.categoria === 'limpieza') {
          return 'Los productos de limpieza deben tener stock mínimo de 1';
        }
        return 'Error de validación de stock';
      }
    }
  },
  imagen: { 
    type: Buffer, 
    required: false,
    // Usar select: false para evitar incluir la imagen en las consultas por defecto
    select: false
  },
  vendidos: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  proovedorInfo: { 
    type: String, 
    default: 'Sin informacion' 
  },
  // Nuevos campos para combos
  esCombo: {
    type: Boolean,
    default: false
  },
  itemsCombo: {
    type: [comboItemSchema],
    default: [],
    validate: {
      validator: function(items) {
        // Si es un combo, debe tener al menos un ítem
        return !this.esCombo || (items && items.length > 0);
      },
      message: 'Un combo debe contener al menos un producto'
    }
  }
}, {
  timestamps: true // Agregar createdAt y updatedAt automáticamente
});

// Pre-save middleware para validar combos
productoSchema.pre('save', async function(next) {
  if (this.esCombo && this.isModified('itemsCombo')) {
    try {
      // Verificar que no haya referencias circulares
      const combosEnItems = await mongoose.model('Producto').find({
        _id: { $in: this.itemsCombo.map(item => item.productoId) },
        esCombo: true
      });
      
      if (combosEnItems.length > 0) {
        const comboNames = combosEnItems.map(c => c.nombre).join(', ');
        return next(new Error(`No se permiten combos dentro de combos. Productos problemáticos: ${comboNames}`));
      }
      
      // Todo bien, continuar
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Crear índices para mejorar rendimiento de consultas
productoSchema.index({ nombre: 1 });
productoSchema.index({ categoria: 1 });
productoSchema.index({ subCategoria: 1 });
productoSchema.index({ 'itemsCombo.productoId': 1 }); // Para búsquedas en combos
productoSchema.index({ stock: 1 }); // Para consultas de stock bajo
productoSchema.index({ nombre: 'text', descripcion: 'text', proovedorInfo: 'text' }); // Índice de texto para búsquedas

module.exports = mongoose.model('Producto', productoSchema);