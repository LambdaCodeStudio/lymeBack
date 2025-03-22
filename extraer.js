// extract-images-frontend.js
// Script para extraer imágenes de productos de MongoDB, guardarlas en el frontend,
// y actualizar los documentos en MongoDB con la URL correcta

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');

// Configuración
const FRONTEND_PATH = process.argv[2] || '../lymefront/public'; // Ruta a la carpeta public del frontend
const IMAGES_PATH = 'images/products'; // Subcarpeta dentro de public
const OUTPUT_DIR = path.join(FRONTEND_PATH, IMAGES_PATH); // Directorio completo donde guardar las imágenes
const IMAGE_FORMAT = process.argv[3] || 'webp'; // Formato por defecto: webp
const MONGODB_URI = process.env.MONGODB_URI;
const IMAGE_URL_PREFIX = process.argv[4] || '/images/products'; // URL base para acceder a las imágenes

// Definir esquema del producto (versión simplificada del real)
const productoSchema = new mongoose.Schema({
  nombre: String,
  imagen: Buffer,
  imageUrl: String, // Campo que vamos a añadir
  imagenInfo: {
    mimetype: String,
    tamano: Number,
    ultimaActualizacion: Date
  },
  // Otros campos del esquema...
  alertaStockBajo: Boolean,
  historialPrecios: Array,
  // etc.
});

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

// Función para extraer y guardar imágenes, y actualizar referencias en la base de datos
async function extraerImagenes() {
  console.log('Iniciando extracción de imágenes...');

  try {
    // Buscar productos con imágenes (aquellos que tienen el campo imagen y no es null)
    const count = await Producto.countDocuments({
      imagen: { $exists: true, $ne: null }
    });

    console.log(`Se encontraron ${count} productos con imágenes`);

    if (count === 0) {
      console.log('No hay imágenes para extraer.');
      return;
    }

    // Procesar los productos en lotes para evitar problemas de memoria
    const BATCH_SIZE = 20;
    let procesados = 0;
    let exitosos = 0;
    let fallidos = 0;
    let actualizacionesExitosas = 0;

    // Iterar productos en lotes
    for (let skip = 0; skip < count; skip += BATCH_SIZE) {
      const productos = await Producto.find({
        imagen: { $exists: true, $ne: null }
      })
      .select('_id nombre imagen imagenInfo')
      .skip(skip)
      .limit(BATCH_SIZE);

      console.log(`Procesando lote ${Math.floor(skip/BATCH_SIZE) + 1}/${Math.ceil(count/BATCH_SIZE)}`);

      for (const producto of productos) {
        procesados++;
        
        try {
          const id = producto._id.toString();
          // Usar el ID del producto como nombre del archivo
          const nombreArchivo = `${id}.${IMAGE_FORMAT}`;
          const rutaCompleta = path.join(OUTPUT_DIR, nombreArchivo);
          // URL para guardar en la base de datos (URL relativa, no ruta del sistema)
          const imageUrl = `${IMAGE_URL_PREFIX}/${nombreArchivo}`;

          // Verificar si la imagen es un Buffer válido
          if (!producto.imagen || !Buffer.isBuffer(producto.imagen)) {
            console.log(`⚠️ El producto ${id} tiene un campo imagen que no es un Buffer válido. Saltando...`);
            fallidos++;
            continue;
          }

          // Procesar la imagen con sharp
          let imagenGuardada = false;
          try {
            await sharp(producto.imagen)
              .toFormat(IMAGE_FORMAT)
              .toFile(rutaCompleta);

            console.log(`✅ Imagen guardada: ${nombreArchivo} (ID: ${id})`);
            imagenGuardada = true;
          } catch (sharpError) {
            console.error(`❌ Error al procesar la imagen para producto ${id}:`, sharpError.message);
            
            // Intento alternativo: guardar directamente el buffer
            try {
              fs.writeFileSync(rutaCompleta, producto.imagen);
              console.log(`⚠️ Imagen guardada sin procesar: ${nombreArchivo} (ID: ${id})`);
              imagenGuardada = true;
            } catch (fsError) {
              console.error(`❌ Error al guardar imagen directamente para producto ${id}:`, fsError.message);
              fallidos++;
            }
          }

          // Si la imagen se guardó correctamente, actualizar el registro en la base de datos
          if (imagenGuardada) {
            exitosos++;
            
            try {
              // Actualizar el registro en MongoDB
              // IMPORTANTE: Aquí aseguramos que se añada el campo imageUrl
              const resultado = await Producto.updateOne(
                { _id: producto._id },
                { 
                  $set: { 
                    // Quitar la imagen binaria
                    imagen: null,
                    // Añadir URL relativa a la imagen
                    imageUrl: imageUrl,
                    // Actualizar informacion
                    imagenInfo: {
                      mimetype: `image/${IMAGE_FORMAT}`,
                      tamano: fs.statSync(rutaCompleta).size,
                      ultimaActualizacion: new Date()
                    }
                  }
                }
              );
              
              if (resultado.modifiedCount > 0) {
                console.log(`✅ Base de datos actualizada para producto ${id} (URL: ${imageUrl})`);
                actualizacionesExitosas++;
              } else {
                console.log(`⚠️ No se pudo actualizar la base de datos para producto ${id}`);
              }
            } catch (dbError) {
              console.error(`❌ Error al actualizar la base de datos para producto ${id}:`, dbError.message);
            }
          }
        } catch (error) {
          console.error(`❌ Error general procesando producto ${producto._id}:`, error.message);
          fallidos++;
        }

        // Mostrar progreso
        if (procesados % 10 === 0 || procesados === count) {
          console.log(`Progreso: ${procesados}/${count} (${Math.round(procesados/count*100)}%)`);
        }
      }
    }

    console.log('\n===== RESUMEN =====');
    console.log(`Total procesados: ${procesados}`);
    console.log(`Imágenes guardadas: ${exitosos}`);
    console.log(`Registros actualizados: ${actualizacionesExitosas}`);
    console.log(`Fallidos: ${fallidos}`);
    console.log(`Ruta de las imágenes: ${path.resolve(OUTPUT_DIR)}`);
    console.log(`URL de acceso a imágenes: ${IMAGE_URL_PREFIX}/[ID_PRODUCTO].${IMAGE_FORMAT}`);

    // Verificar que todas las imágenes tengan la URL correcta
    const verificacion = await Producto.countDocuments({
      imageUrl: { $exists: true },
      imagen: null
    });
    
    console.log(`\nProductos con campo imageUrl: ${verificacion}`);
    console.log(`Productos que aún tienen imagen binaria: ${await Producto.countDocuments({ imagen: { $ne: null } })}`);

  } catch (error) {
    console.error('Error durante la extracción de imágenes:', error);
  }
}

// Verificar actualizaciones en MongoDB (para ejecutar después)
async function verificarActualizaciones() {
  console.log('\n===== VERIFICANDO ACTUALIZACIONES EN LA BASE DE DATOS =====');
  
  // Contar productos con imageUrl
  const conUrl = await Producto.countDocuments({
    imageUrl: { $exists: true }
  });
  
  // Contar productos sin imagen binaria
  const sinImagen = await Producto.countDocuments({
    imagen: null
  });
  
  // Consulta ejemplo
  const ejemplos = await Producto.find({
    imageUrl: { $exists: true }
  }).limit(3).select('_id imageUrl imagenInfo');
  
  console.log(`Productos con imageUrl: ${conUrl}`);
  console.log(`Productos sin imagen binaria: ${sinImagen}`);
  console.log('Ejemplos de productos actualizados:');
  console.log(JSON.stringify(ejemplos.map(e => ({id: e._id, imageUrl: e.imageUrl, info: e.imagenInfo})), null, 2));
}

// Crear directorios necesarios
function crearDirectorios() {
  console.log(`Verificando directorio de salida: ${OUTPUT_DIR}`);
  
  // Verificar directorio frontend/public
  if (!fs.existsSync(FRONTEND_PATH)) {
    console.log(`Creando directorio frontend: ${FRONTEND_PATH}`);
    fs.mkdirSync(FRONTEND_PATH, { recursive: true });
  }
  
  // Verificar directorio completo para imágenes
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`Creando directorio para imágenes: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Función principal
async function main() {
  if (await conectarDB()) {
    try {
      // Crear directorios necesarios
      crearDirectorios();
      
      // Extraer imágenes
      await extraerImagenes();
      
      // Verificar actualizaciones
      await verificarActualizaciones();
      
      console.log('\n===== INSTRUCCIONES =====');
      console.log(`1. Asegúrate de que las imágenes se guardaron correctamente en: ${OUTPUT_DIR}`);
      console.log(`2. Verifica que los productos tienen el campo imageUrl actualizado`);
      console.log(`3. Modifica tu frontend para que use la URL: ${IMAGE_URL_PREFIX}/[ID_PRODUCTO].${IMAGE_FORMAT}`);
      console.log('4. Si necesitas verificar un producto específico, usa:');
      console.log('   db.Producto.findOne({_id: ObjectId("ID_DEL_PRODUCTO")})');
      
    } catch (error) {
      console.error('Error en el proceso principal:', error);
    } finally {
      // Cerrar conexión
      await mongoose.connection.close();
      console.log('Conexión a MongoDB cerrada');
    }
  }
  process.exit(0);
}

// Ejecutar script
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});