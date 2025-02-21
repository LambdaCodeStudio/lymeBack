// src/models/Producto.js
const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre: { 
    type: String, 
    required: true 
  },
  descripcion: { 
    type: String, 
    required: true 
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
           'superficiesConstruccion','plomeria'] 
  },
  precio: { 
    type: Number, 
    required: true,
    min: [0, 'El precio no puede ser negativo'] 
  },
  stock: { 
    type: Number, 
    required: true,
    min: [0, 'El stock no puede ser negativo'] 
  },
  imagen: { 
    type: Buffer, 
    required: false
  },
  vendidos: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  proovedorInfo: { 
    type: String, 
    default: 'Sin informacion' 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Producto', productoSchema);