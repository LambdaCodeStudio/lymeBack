// verify-image-paths.js - Para ejecutar desde el backend
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuración
const MONGODB_URI = process.env.MONGODB_URI;
const PUBLIC_DIR = path.join(__dirname, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images', 'products');

// Esquema simplificado para producto
const productoSchema = new mongoose.Schema({
  nombre: String,
  imageUrl: String,
});

const Producto = mongoose.model('Producto', productoSchema);

async function connectToMongoDB() {
  try {
    console.log(`Conectando a MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('Conexión exitosa a MongoDB');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}

// Verificar que el directorio de imágenes existe
function verifyDirectory() {
  console.log(`\nComprobando directorios:`);
  console.log(`- Directorio público: ${PUBLIC_DIR}`);
  console.log(`- Directorio de imágenes: ${IMAGES_DIR}`);
  
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`ERROR: El directorio público no existe: ${PUBLIC_DIR}`);
    return false;
  }
  
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`ERROR: El directorio de imágenes no existe: ${IMAGES_DIR}`);
    console.log('Creando directorio de imágenes...');
    
    try {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      console.log('Directorio creado correctamente');
    } catch (error) {
      console.error('Error creando directorio:', error.message);
      return false;
    }
  }
  
  console.log('✓ Directorios verificados correctamente');
  return true;
}

// Listar archivos en el directorio de imágenes
function listImageFiles() {
  try {
    console.log('\nArchivos disponibles en el directorio de imágenes:');
    const files = fs.readdirSync(IMAGES_DIR);
    
    if (files.length === 0) {
      console.log('⚠️ No se encontraron archivos en el directorio de imágenes');
      return [];
    }
    
    console.log(`Se encontraron ${files.length} archivos`);
    files.slice(0, 10).forEach(file => {
      console.log(`- ${file}`);
    });
    
    if (files.length > 10) {
      console.log(`... y ${files.length - 10} archivos más`);
    }
    
    return files;
  } catch (error) {
    console.error('Error al listar archivos:', error.message);
    return [];
  }
}

// Verificar que existen los archivos referenciados por productos
async function verifyProductImages() {
  try {
    console.log('\nVerificando imágenes referenciadas en la base de datos:');
    
    // Obtener productos con imageUrl
    const productos = await Producto.find({
      imageUrl: { $exists: true, $ne: null }
    }).select('_id nombre imageUrl');
    
    console.log(`Se encontraron ${productos.length} productos con URL de imagen`);
    
    // Listar archivos existentes
    const files = new Set(fs.readdirSync(IMAGES_DIR));
    
    // Verificar cada producto
    let faltantes = 0;
    let correctos = 0;
    let problemasUrl = 0;
    
    for (const producto of productos) {
      // Extraer nombre de archivo de la URL
      let fileName;
      
      if (producto.imageUrl) {
        // Limpiar URL
        const url = producto.imageUrl.replace(/\\/g, '/');
        fileName = url.split('/').pop();
      } else {
        fileName = `${producto._id}.webp`;
      }
      
      if (!fileName) {
        console.log(`⚠️ URL mal formada para producto "${producto.nombre}" (${producto._id}): ${producto.imageUrl}`);
        problemasUrl++;
        continue;
      }
      
      // Verificar si el archivo existe
      if (files.has(fileName)) {
        correctos++;
      } else {
        console.log(`❌ No se encontró el archivo para producto "${producto.nombre}" (${producto._id}): ${fileName}`);
        faltantes++;
      }
    }
    
    console.log('\nResumen:');
    console.log(`- Total productos con URL: ${productos.length}`);
    console.log(`- Archivos correctos: ${correctos}`);
    console.log(`- Archivos faltantes: ${faltantes}`);
    console.log(`- URLs malformadas: ${problemasUrl}`);
    
    return { total: productos.length, correctos, faltantes, problemasUrl };
  } catch (error) {
    console.error('Error verificando imágenes de productos:', error.message);
    return null;
  }
}

// Función principal
async function main() {
  await connectToMongoDB();
  
  const directoriosOk = verifyDirectory();
  if (!directoriosOk) {
    console.error('\n⚠️ Hay problemas con los directorios. Corrígelos antes de continuar.');
    await mongoose.disconnect();
    return;
  }
  
  const archivos = listImageFiles();
  
  if (archivos.length > 0) {
    const resultado = await verifyProductImages();
    
    if (resultado && resultado.faltantes > 0) {
      console.log('\n📋 Recomendaciones:');
      console.log('1. Verifica que tus imágenes estén en el directorio correcto');
      console.log('2. Asegúrate de que el nombre de los archivos coincida con el formato esperado: ID.webp');
      console.log('3. Actualiza el campo imageUrl en MongoDB si es necesario');
      console.log('4. Si estás usando Windows, asegúrate de que las rutas usen / (slash) no \\ (backslash)');
    }
  }
  
  console.log('\n📌 Información para el frontend:');
  console.log('- Las imágenes deben accederse desde: /images/products/ID.webp');
  console.log('- Ejemplo: <img src="/images/products/67d0f3b303a141a927622228.webp" />');
  
  await mongoose.disconnect();
  console.log('\nVerificación completada.');
}

main().catch(error => {
  console.error('Error general:', error);
  process.exit(1);
});