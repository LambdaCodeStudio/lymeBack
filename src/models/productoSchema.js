const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, mensaje: 'El nombre es requerido' },
  descripcion: { type: String, required: true },
  categoria: { type: String, required: true, enum: ['limpieza', 'mantenimiento'], mensaje: 'La categoria es requerida'},
  subCategoria: { type: String, required: true, enum: ['accesorios','aerosoles','bolsas','estandar','indumentaria','liquidos','papeles','sinClasificarLimpieza','iluminaria','electricidad','cerraduraCortina','pintura','superficiesConstruccion','plomeria'] },
  precio: { type: Number, required: true, mensaje: 'El precio es requerido' },
  stock: { type: Number, required: true,  mensaje: 'El stock es requerido' },
  imagen: { type: Buffer, required: true },
  vendidos: { type: Number, default: 0 }, //este usalo por mas que no tengamos las metricas, por si en algun momento se usan, la idea es que se actualice cada vez que se vende un producto
});


module.exports = mongoose.model('Producto', productoSchema);
