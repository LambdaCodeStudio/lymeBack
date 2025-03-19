// src/models/productoSchema.js
const mongoose = require('mongoose');

// Esquema para los ítems dentro de un combo (mantenemos el existente)
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

// Esquema para el historial de precios
const precioHistorialSchema = new mongoose.Schema({
  precio: {
    type: Number,
    required: true,
    min: [0, 'El precio no puede ser negativo']
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  motivo: String
});

// Esquema para el historial de ventas
const ventaHistorialSchema = new mongoose.Schema({
  cantidad: {
    type: Number,
    required: true,
    min: [1, 'La cantidad mínima es 1']
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  pedidoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pedido'
  }
});

// Esquema para ubicación física
const ubicacionSchema = new mongoose.Schema({
  deposito: {
    type: String,
    default: 'Principal'
  },
  pasillo: String,
  estante: String,
  posicion: String
});

// Esquema para proveedor
const proveedorSchema = new mongoose.Schema({
  nombre: String,
  codigo: String,
  contacto: String,
  telefono: String,
  email: String,
  notas: String
});

// Esquema principal de producto
const productoSchema = new mongoose.Schema({
  // Campos básicos
  nombre: { 
    type: String, 
    required: true 
  },
  descripcion: { 
    type: String
  },
  
  // Estructura jerárquica
  categoria: { 
    type: String, 
    required: true, 
    enum: ['limpieza', 'mantenimiento'] 
  },
  subCategoria: { 
    type: String, 
    required: true, 
    enum: ['accesorios', 'aerosoles', 'bolsas', 'estandar', 'indumentaria', 'liquidos', 'papeles',
           'sinClasificarLimpieza', 'iluminaria', 'electricidad', 'cerraduraCortina', 'pintura',
           'superficiesConstruccion', 'plomeria', 'calzado'] 
  },
  marca: {
    type: String,
    index: true
  },
  
  // Información de proveedor
  proveedor: {
    type: proveedorSchema,
    default: {}
  },
  
  // Precio actual
  precio: { 
    type: Number, 
    required: true,
    min: [0, 'El precio no puede ser negativo'] 
  },
  
  // Historial de precios
  historialPrecios: {
    type: [precioHistorialSchema],
    default: [],
    select: false // No incluir por defecto en consultas
  },
  
  // Gestión de stock
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
  stockMinimo: {
    type: Number,
    default: 5
  },
  stockMaximo: {
    type: Number
  },
  
  // Ubicación física
  ubicacion: {
    type: ubicacionSchema,
    default: {}
  },
  
  // Manejo de imagen
  imagen: { 
    type: Buffer, 
    required: false,
    select: false // No incluir en consultas por defecto
  },
  imagenInfo: {
    mimetype: String,
    tamano: Number,
    ultimaActualizacion: Date
  },
  
  // Estadísticas de ventas
  vendidos: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  historialVentas: {
    type: [ventaHistorialSchema],
    default: [],
    select: false // No incluir por defecto en consultas
  },
  ultimaVenta: {
    type: Date
  },
  
  // Campos para combos
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
  },
  
  // Metadata y estadísticas
  proovedorInfo: { 
    type: String, 
    default: 'Sin informacion' 
  },
  codigoBarras: {
    type: String,
    sparse: true,
    unique: true
  },
  codigoInterno: {
    type: String,
    sparse: true,
    unique: true
  },
  estado: {
    type: String,
    enum: ['activo', 'discontinuado', 'agotado'],
    default: 'activo'
  },
  
  // Campos para análisis
  tendenciaVentas: {
    diaria: Number,
    semanal: Number,
    mensual: Number
  },
  diasHastaAgotamiento: {
    type: Number
  },
  alertaStockBajo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Mantener createdAt y updatedAt automáticamente
});

// Middleware para actualizar campos calculados automáticamente
productoSchema.pre('save', async function(next) {
  // Mantener el middleware existente para validar combos
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
    } catch (error) {
      return next(error);
    }
  }
  
  // Nuevo: Actualizar alerta de stock bajo
  if (this.isModified('stock') || this.isModified('stockMinimo')) {
    this.alertaStockBajo = this.stock <= this.stockMinimo;
  }
  
  // Nuevo: Al modificar el precio, agregar al historial
  if (this.isModified('precio') && !this.isNew) {
    // Solo si ya existe un precio anterior (evitar duplicados en creación)
    const precioAnterior = this._original ? this._original.precio : null;
    
    if (precioAnterior !== null && precioAnterior !== this.precio) {
      if (!this.historialPrecios) {
        this.historialPrecios = [];
      }
      
      this.historialPrecios.push({
        precio: this.precio,
        fecha: new Date()
      });
    }
  }
  
  next();
});

// Índices para optimización de consultas
productoSchema.index({ nombre: 1 });
productoSchema.index({ categoria: 1, subCategoria: 1 });
productoSchema.index({ marca: 1 });
productoSchema.index({ 'proveedor.nombre': 1 });
productoSchema.index({ stock: 1 });
productoSchema.index({ alertaStockBajo: 1 }); // Para consultar productos con alerta
productoSchema.index({ precio: 1 }); // Para filtrar por precio
productoSchema.index({ vendidos: -1 }); // Para productos más vendidos
productoSchema.index({ estado: 1 }); // Para filtrar por estado
productoSchema.index({ 'itemsCombo.productoId': 1 }); // Para búsquedas en combos
productoSchema.index({ updatedAt: -1 }); // Para ordenar por última actualización
productoSchema.index({ codigoBarras: 1 }); // Para búsquedas por código de barras
productoSchema.index({ codigoInterno: 1 }); // Para búsquedas por código interno

// Índice de texto para búsquedas
productoSchema.index(
  { 
    nombre: 'text', 
    descripcion: 'text', 
    'proveedor.nombre': 'text',
    marca: 'text'
  },
  {
    weights: {
      nombre: 10,
      descripcion: 5,
      marca: 3,
      'proveedor.nombre': 1
    },
    name: 'producto_text_index'
  }
);

// Métodos virtuales
productoSchema.virtual('diasSinVender').get(function() {
  if (!this.ultimaVenta) return null;
  const hoy = new Date();
  const diff = hoy - this.ultimaVenta;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('Producto', productoSchema);