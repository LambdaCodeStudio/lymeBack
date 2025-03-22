// update-image-urls.js
// Script para actualizar todos los productos con imagen=null e imagenInfo 
// añadiendo el campo imageUrl basado en su ID

require('dotenv').config();
const mongoose = require('mongoose');

// Configuración
const MONGODB_URI = process.env.MONGODB_URI;
const IMAGE_URL_PREFIX = process.argv[2] || '/images/products'; // Prefijo para la URL
const IMAGE_FORMAT = process.argv[3] || 'webp'; // Formato de imagen (extensión)
const DRY_RUN = process.argv.includes('--dry-run'); // Modo prueba sin hacer cambios

// Definir esquema simplificado de producto para la actualización
const productoSchema = new mongoose.Schema({
  nombre: String,
  imagen: Buffer,
  imageUrl: String,
  imagenInfo: {
    mimetype: String,
    ultimaActualizacion: Date
  }
}, { timestamps: true });

// Crear modelo
const Producto = mongoose.model('Producto', productoSchema);

// Función para conectar a MongoDB
async function conectarDB() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conexión exitosa a MongoDB');
    return true;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    return false;
  }
}

// Función para actualizar imageUrl para productos procesados
async function actualizarImageUrl() {
  console.log(`${DRY_RUN ? '🧪 MODO PRUEBA - NO SE HARÁN CAMBIOS' : '🔄 MODO ACTUALIZACIÓN - SE MODIFICARÁ LA BASE DE DATOS'}`);
  console.log('Iniciando actualización de URLs de imágenes...');

  try {
    // Buscar productos que tienen imagen=null e imagenInfo pero no tienen imageUrl
    const query = {
      imagen: null,
      'imagenInfo.mimetype': { $exists: true },
      imageUrl: { $exists: false }
    };

    // Contar cuántos productos necesitan actualización
    const count = await Producto.countDocuments(query);
    console.log(`Se encontraron ${count} productos que necesitan actualización`);

    if (count === 0) {
      console.log('No hay productos para actualizar.');
      return;
    }

    if (DRY_RUN) {
      console.log('Ejemplos de productos que serían actualizados:');
      const ejemplos = await Producto.find(query).limit(5);
      
      ejemplos.forEach(producto => {
        const id = producto._id.toString();
        const imageUrl = `${IMAGE_URL_PREFIX}/${id}.${IMAGE_FORMAT}`;
        console.log(`- Producto: ${producto.nombre} (ID: ${id})`);
        console.log(`  Nueva URL: ${imageUrl}`);
        console.log('  Estado actual:');
        console.log(`  - imagen: ${producto.imagen === null ? 'null' : 'presente'}`);
        console.log(`  - imagenInfo: ${JSON.stringify(producto.imagenInfo || {})}`);
        console.log(`  - imageUrl: ${producto.imageUrl || 'ausente'}`);
        console.log('');
      });
      
      console.log('Esta es una ejecución de prueba. Para realizar la actualización real, ejecute sin --dry-run');
      return;
    }

    // Procesar todos los productos en lotes
    const BATCH_SIZE = 100;
    let actualizados = 0;
    let errores = 0;

    console.log('Iniciando actualización en lotes...');

    // Obtener todos los IDs que necesitan actualización
    const productos = await Producto.find(query).select('_id').lean();

    // Procesar en lotes para evitar problemas de memoria con grandes colecciones
    for (let i = 0; i < productos.length; i += BATCH_SIZE) {
      const lote = productos.slice(i, i + BATCH_SIZE);
      console.log(`Procesando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(productos.length/BATCH_SIZE)}`);
      
      for (const producto of lote) {
        const id = producto._id.toString();
        const imageUrl = `${IMAGE_URL_PREFIX}/${id}.${IMAGE_FORMAT}`;
        
        try {
          // Actualizar producto
          const resultado = await Producto.updateOne(
            { _id: id, imageUrl: { $exists: false } }, // Doble verificación para evitar duplicados
            { 
              $set: { 
                imageUrl: imageUrl,
                'imagenInfo.mimetype': `image/${IMAGE_FORMAT}`
              }
            }
          );
          
          if (resultado.modifiedCount > 0) {
            actualizados++;
            if (actualizados % 10 === 0 || actualizados === productos.length) {
              process.stdout.write(`\rProductos actualizados: ${actualizados}/${productos.length} (${Math.round(actualizados/productos.length*100)}%)`);
            }
          }
        } catch (error) {
          console.error(`Error al actualizar producto ${id}:`, error.message);
          errores++;
        }
      }
    }

    console.log('\n\n===== RESUMEN =====');
    console.log(`Total de productos procesados: ${productos.length}`);
    console.log(`Productos actualizados exitosamente: ${actualizados}`);
    console.log(`Errores: ${errores}`);
    
    // Verificación final
    const pendientes = await Producto.countDocuments(query);
    console.log(`Productos pendientes de actualización: ${pendientes}`);
    
    if (pendientes > 0) {
      console.log(`⚠️ Algunos productos no se actualizaron. Puede volver a ejecutar el script.`);
    } else {
      console.log(`✅ Todos los productos fueron actualizados correctamente.`);
    }

  } catch (error) {
    console.error('Error general durante la actualización:', error);
  }
}

// Verificar la estructura actual de la base de datos
async function verificarBaseDatos() {
  console.log('\n===== ESTADO DE LA BASE DE DATOS =====');
  
  // Total de productos
  const totalProductos = await Producto.countDocuments();
  console.log(`Productos totales: ${totalProductos}`);
  
  // Productos con imagen binaria
  const conImagenBinaria = await Producto.countDocuments({
    imagen: { $ne: null }
  });
  console.log(`Productos con imagen binaria: ${conImagenBinaria}`);
  
  // Productos con imagen = null pero imagenInfo
  const conImagenInfo = await Producto.countDocuments({
    imagen: null,
    'imagenInfo.mimetype': { $exists: true }
  });
  console.log(`Productos con imagen=null e imagenInfo: ${conImagenInfo}`);
  
  // Productos con imageUrl
  const conImageUrl = await Producto.countDocuments({
    imageUrl: { $exists: true }
  });
  console.log(`Productos con campo imageUrl: ${conImageUrl}`);
  
  // Productos que necesitan actualización
  const necesitanActualizacion = await Producto.countDocuments({
    imagen: null,
    'imagenInfo.mimetype': { $exists: true },
    imageUrl: { $exists: false }
  });
  console.log(`Productos que necesitan actualización: ${necesitanActualizacion}`);
  
  console.log('========================================\n');
}

// Función principal
async function main() {
  if (await conectarDB()) {
    try {
      await verificarBaseDatos();
      
      if (DRY_RUN) {
        console.log('EJECUTANDO EN MODO PRUEBA - No se realizarán cambios');
      }
      
      await actualizarImageUrl();
      await verificarBaseDatos();
      
      console.log('\n===== INSTRUCCIONES ADICIONALES =====');
      console.log('1. Asegúrate de que todas las imágenes existen en la ubicación:');
      console.log(`   ${IMAGE_URL_PREFIX}/[ID_PRODUCTO].${IMAGE_FORMAT}`);
      console.log('2. Para facilitar el acceso en el frontend, puedes usar la URL:');
      console.log(`   <img src="${IMAGE_URL_PREFIX}/[ID_PRODUCTO].${IMAGE_FORMAT}" />`);
      console.log('==========================================');
      
    } catch (error) {
      console.error('Error en el proceso:', error);
    } finally {
      // Cerrar conexión
      await mongoose.connection.close();
      console.log('Conexión a MongoDB cerrada');
    }
  }
  process.exit(0);
}

// Ejecutar el script
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});