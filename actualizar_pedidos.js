// actualizar-estado-pedidos.js
const mongoose = require('mongoose');
const { Pedido } = require('./src/models/pedidoSchema');

// Configuración de la base de datos (misma que en el script migrate.js)
const DB_URI = 'mongodb://lymeAdmin:TAMVung@179.43.118.101:27018/lyme_db?authSource=lyme_db';

// Contadores para estadísticas
let totalPedidos = 0;
let actualizados = 0;
let sinCambios = 0;
let errores = 0;

// Tamaño del lote para procesar pedidos
const BATCH_SIZE = 50;

/**
 * Conecta a la base de datos
 */
async function connectToDB() {
  console.log('Conectando a la base de datos...');
  await mongoose.connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Conexión establecida');
}

/**
 * Actualiza el estado de un pedido de "aprobado_supervisor" a "en_preparación"
 * si tiene fechaPreparacion y usuarioPreparacion
 */
async function actualizarEstadoPedido(pedido) {
  // Verificar si el pedido tiene fechaPreparacion y usuarioPreparacion
  if (!pedido.fechaPreparacion || !pedido.usuarioPreparacion) {
    console.log(`Pedido #${pedido.nPedido || pedido._id} sin fecha o usuario de preparación. Omitiendo.`);
    sinCambios++;
    return false;
  }

  // Verificar si el estado es "aprobado_supervisor"
  if (pedido.estado !== 'aprobado_supervisor') {
    console.log(`Pedido #${pedido.nPedido || pedido._id} con estado "${pedido.estado}" no es "aprobado_supervisor". Omitiendo.`);
    sinCambios++;
    return false;
  }

  try {
    // Utilizar updateOne con rawResult y skipValidation para evitar problemas de validación
    const result = await Pedido.updateOne(
      { _id: pedido._id },
      { $set: { estado: 'en_preparacion' } } // Sin tilde en "preparacion"
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Pedido #${pedido.nPedido || pedido._id} actualizado: estado cambiado a "en_preparacion"`);
      actualizados++;
      return true;
    } else {
      console.log(`No se pudo actualizar el pedido #${pedido.nPedido || pedido._id}`);
      sinCambios++;
      return false;
    }
  } catch (err) {
    console.error(`Error al actualizar pedido ${pedido._id}:`, err);
    errores++;
    return false;
  }
}

/**
 * Procesa todos los pedidos en lotes
 */
async function procesarPedidos() {
  try {
    // Contar total de pedidos con fechaPreparacion y usuarioPreparacion
    totalPedidos = await Pedido.countDocuments({
      fechaPreparacion: { $exists: true },
      usuarioPreparacion: { $exists: true }
    });
    
    console.log(`Total de pedidos a procesar: ${totalPedidos}`);
    
    let skip = 0;
    let procesados = 0;
    
    // Procesar en lotes
    while (procesados < totalPedidos) {
      // Buscar pedidos con fechaPreparacion y usuarioPreparacion
      const pedidos = await Pedido.find({
        fechaPreparacion: { $exists: true },
        usuarioPreparacion: { $exists: true }
      })
      .skip(skip)
      .limit(BATCH_SIZE);
      
      if (pedidos.length === 0) {
        console.log('No hay más pedidos para procesar');
        break;
      }
      
      console.log(`Procesando lote de ${pedidos.length} pedidos (${procesados + 1} a ${procesados + pedidos.length} de ${totalPedidos})...`);
      
      // Procesar cada pedido en el lote
      for (const pedido of pedidos) {
        try {
          await actualizarEstadoPedido(pedido);
        } catch (err) {
          console.error(`Error procesando pedido ${pedido._id}:`, err);
          errores++;
        }
      }
      
      procesados += pedidos.length;
      skip += BATCH_SIZE;
      
      console.log(`Progreso: ${Math.round((procesados / totalPedidos) * 100)}%`);
    }
    
    console.log('\nActualización completada');
    console.log('----------------------');
    console.log(`Total pedidos procesados: ${totalPedidos}`);
    console.log(`Actualizados a "en_preparación": ${actualizados}`);
    console.log(`Sin cambios: ${sinCambios}`);
    console.log(`Errores: ${errores}`);
  } catch (err) {
    console.error('Error durante el proceso de actualización:', err);
  }
}

/**
 * Modo de prueba que muestra cambios sin aplicarlos
 */
async function modoSimulacion() {
  try {
    console.log('MODO SIMULACIÓN - No se realizarán cambios reales');
    
    // Buscar una muestra de pedidos con fechaPreparacion y usuarioPreparacion
    const muestraPedidos = await Pedido.find({
      fechaPreparacion: { $exists: true },
      usuarioPreparacion: { $exists: true }
    }).limit(5);
    
    console.log(`Simulando con ${muestraPedidos.length} pedidos de muestra`);
    
    for (const pedido of muestraPedidos) {
      console.log(`\nSimulando actualización para pedido #${pedido.nPedido || pedido._id}:`);
      console.log(`- Estado actual: "${pedido.estado}"`);
      
      if (!pedido.fechaPreparacion || !pedido.usuarioPreparacion) {
        console.log('- Sin fecha o usuario de preparación. No se actualizaría.');
        continue;
      }
      
      if (pedido.estado !== 'aprobado_supervisor') {
        console.log(`- Estado no es "aprobado_supervisor". No se actualizaría.`);
        continue;
      }
      
      console.log('- Se cambiaría estado a "en_preparación"');
      console.log(`- Fecha de preparación: ${pedido.fechaPreparacion}`);
      console.log(`- Usuario de preparación: ${pedido.usuarioPreparacion}`);
    }
    
    console.log('\nSimulación completada. No se realizaron cambios reales.');
  } catch (err) {
    console.error('Error en simulación:', err);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    await connectToDB();
    
    // Preguntar modo de ejecución
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('¿Qué acción deseas realizar?\n1. Actualizar todos los pedidos\n2. Ejecutar simulación (sin cambios reales)\n3. Cancelar\nElige una opción (1-3): ', async (answer) => {
      if (answer === '1') {
        readline.question('¿Estás seguro de que deseas actualizar el estado de todos los pedidos con fecha y usuario de preparación? Esta acción modificará datos en la base. (s/n): ', async (confirm) => {
          if (confirm.toLowerCase() === 's') {
            console.log('Iniciando actualización de estados...');
            await procesarPedidos();
          } else {
            console.log('Actualización cancelada');
          }
          
          readline.close();
          await mongoose.connection.close();
          console.log('Conexión a la base de datos cerrada');
        });
      } 
      else if (answer === '2') {
        console.log('Ejecutando simulación (sin cambios reales)...');
        await modoSimulacion();
        readline.close();
        await mongoose.connection.close();
        console.log('Conexión a la base de datos cerrada');
      } 
      else {
        console.log('Operación cancelada');
        readline.close();
        await mongoose.connection.close();
        console.log('Conexión a la base de datos cerrada');
      }
    });
  } catch (err) {
    console.error('Error en proceso de actualización:', err);
    process.exit(1);
  }
}

// Ejecutar script
main();