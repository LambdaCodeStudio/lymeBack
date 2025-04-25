// migrate-pedidos.js
const mongoose = require('mongoose');
const { Pedido } = require('./src/models/pedidoSchema');
const Producto = require('./src/models/productoSchema');

// Configuración de la base de datos (ajusta según tu entorno)
const DB_URI = 'mongodb://lymeAdmin:TAMVung@179.43.118.101:27018/lyme_db?authSource=lyme_db';

// Contadores para estadísticas
let totalPedidos = 0;
let actualizados = 0;
let errores = 0;
let sinCambios = 0;
let pedidosConCombos = 0;

// Tamaño del lote para procesar pedidos
const BATCH_SIZE = 30;

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
 * Obtiene información completa de un producto
 */
async function obtenerInfoProducto(productoId) {
  try {
    if (!productoId) {
      console.warn('ID de producto no válido');
      return null;
    }

    const producto = await Producto.findById(productoId);
    if (!producto) {
      console.warn(`Producto no encontrado: ${productoId}`);
      return {
        nombre: 'Producto no encontrado',
        precio: 0,
        categoria: 'desconocida',
        subCategoria: 'desconocida',
        esCombo: false
      };
    }
    
    return {
      nombre: producto.nombre,
      precio: producto.precio,
      categoria: producto.categoria || 'sin categoría',
      subCategoria: producto.subCategoria || 'sin subcategoría',
      esCombo: producto.esCombo || false,
      itemsCombo: producto.itemsCombo || []
    };
  } catch (err) {
    console.error(`Error al obtener producto ${productoId}:`, err);
    return {
      nombre: 'Error al obtener producto',
      precio: 0,
      categoria: 'error',
      subCategoria: 'error',
      esCombo: false
    };
  }
}

/**
 * Actualiza un pedido con información completa de productos
 */
async function actualizarPedido(pedido) {
  // Verificar si el pedido ya tiene la información completa
  if (pedido.productos && pedido.productos.length > 0 && 
      pedido.productos[0].nombre && 
      pedido.productos[0].categoria) {
    console.log(`Pedido #${pedido.nPedido || pedido._id} ya tiene información completa. Omitiendo.`);
    sinCambios++;
    return false;
  }

  let modificado = false;
  let tieneCombo = false;
  
  // Procesar productos
  if (pedido.productos && Array.isArray(pedido.productos)) {
    const productosActualizados = [];
    
    for (const producto of pedido.productos) {
      // Obtener ID del producto
      const productoId = typeof producto.productoId === 'object' 
        ? producto.productoId._id || producto.productoId
        : producto.productoId;
        
      // Obtener información completa del producto
      const productoInfo = await obtenerInfoProducto(productoId);
      
      if (!productoInfo) {
        console.warn(`No se pudo obtener información para el producto ${productoId} en pedido ${pedido._id}`);
        continue;
      }
      
      // Crear objeto actualizado del producto
      const productoActualizado = {
        productoId: productoId,
        cantidad: producto.cantidad,
        // Mantener el precio unitario que ya existe o usar el del producto
        precio: producto.precioUnitario || productoInfo.precio,
        // Añadir información nueva
        nombre: productoInfo.nombre,
        categoria: productoInfo.categoria,
        subCategoria: productoInfo.subCategoria,
        esCombo: productoInfo.esCombo || false
      };
      
      // Si es un combo, procesar los items del combo
      if (productoInfo.esCombo && productoInfo.itemsCombo && productoInfo.itemsCombo.length > 0) {
        tieneCombo = true;
        const comboItems = [];
        
        for (const item of productoInfo.itemsCombo) {
          const itemId = typeof item.productoId === 'object' 
            ? item.productoId._id || item.productoId 
            : item.productoId;
            
          const itemInfo = await obtenerInfoProducto(itemId);
          
          if (itemInfo) {
            comboItems.push({
              productoId: itemId,
              nombre: itemInfo.nombre,
              cantidad: item.cantidad || 1,
              precio: itemInfo.precio || 0
            });
          } else {
            // Si no podemos obtener la info, al menos guardar lo que tenemos
            comboItems.push({
              productoId: itemId,
              nombre: 'Producto no disponible',
              cantidad: item.cantidad || 1,
              precio: 0
            });
          }
        }
        
        productoActualizado.comboItems = comboItems;
      }
      
      productosActualizados.push(productoActualizado);
    }
    
    // Reemplazar productos con versión actualizada
    if (productosActualizados.length > 0) {
      pedido.productos = productosActualizados;
      modificado = true;
      
      if (tieneCombo) {
        pedidosConCombos++;
      }
    }
  }
  
  if (modificado) {
    try {
      // Guardar pedido actualizado
      await pedido.save();
      console.log(`Pedido #${pedido.nPedido || pedido._id} actualizado correctamente${tieneCombo ? ' (incluye combos)' : ''}`);
      actualizados++;
      return true;
    } catch (err) {
      console.error(`Error al guardar pedido ${pedido._id}:`, err);
      errores++;
      return false;
    }
  } else {
    sinCambios++;
    return false;
  }
}

/**
 * Procesa todos los pedidos en lotes
 */
async function procesarPedidos() {
  try {
    // Contar total de pedidos
    totalPedidos = await Pedido.countDocuments();
    console.log(`Total de pedidos a procesar: ${totalPedidos}`);
    
    let skip = 0;
    let procesados = 0;
    
    // Procesar en lotes
    while (procesados < totalPedidos) {
      const pedidos = await Pedido.find()
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
          await actualizarPedido(pedido);
        } catch (err) {
          console.error(`Error procesando pedido ${pedido._id}:`, err);
          errores++;
        }
      }
      
      procesados += pedidos.length;
      skip += BATCH_SIZE;
      
      console.log(`Progreso: ${Math.round((procesados / totalPedidos) * 100)}%`);
    }
    
    console.log('\nMigración completada');
    console.log('-------------------');
    console.log(`Total pedidos: ${totalPedidos}`);
    console.log(`Actualizados: ${actualizados}`);
    console.log(`Pedidos con combos: ${pedidosConCombos}`);
    console.log(`Sin cambios: ${sinCambios}`);
    console.log(`Errores: ${errores}`);
  } catch (err) {
    console.error('Error durante el proceso de migración:', err);
  }
}

/**
 * Modo de prueba que muestra cambios sin aplicarlos
 */
async function modoSimulacion() {
  try {
    // Tomar una muestra de pedidos para simular cambios
    console.log('MODO SIMULACIÓN - No se realizarán cambios reales');
    
    const muestraPedidos = await Pedido.find().limit(5);
    console.log(`Simulando con ${muestraPedidos.length} pedidos de muestra`);
    
    for (const pedido of muestraPedidos) {
      console.log(`\nSimulando actualización para pedido #${pedido.nPedido || pedido._id}:`);
      
      // Mostrar estructura actual de productos (solo primeros 2)
      console.log('\nEstructura ANTES:');
      const muestraProductos = pedido.productos.slice(0, 2);
      console.log(JSON.stringify(muestraProductos, null, 2));
      
      // Obtener información que se agregaría (sin guardar)
      if (pedido.productos && pedido.productos.length > 0) {
        const primerProducto = pedido.productos[0];
        const productoId = typeof primerProducto.productoId === 'object' 
          ? primerProducto.productoId._id || primerProducto.productoId
          : primerProducto.productoId;
          
        const productoInfo = await obtenerInfoProducto(productoId);
        
        if (productoInfo) {
          console.log('\nInformación que se añadiría:');
          console.log({
            nombre: productoInfo.nombre,
            precio: primerProducto.precioUnitario || productoInfo.precio,
            categoria: productoInfo.categoria,
            subCategoria: productoInfo.subCategoria,
            esCombo: productoInfo.esCombo,
            // Solo mostrar si es combo
            ...(productoInfo.esCombo && productoInfo.itemsCombo ? {
              comboItems: productoInfo.itemsCombo.length + ' productos en combo'
            } : {})
          });
        }
      }
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
    
    readline.question('¿Qué acción deseas realizar?\n1. Migrar todos los pedidos\n2. Ejecutar simulación (sin cambios reales)\n3. Cancelar\nElige una opción (1-3): ', async (answer) => {
      if (answer === '1') {
        readline.question('¿Estás seguro de que deseas migrar TODOS los pedidos? Esta acción modificará datos en la base. (s/n): ', async (confirm) => {
          if (confirm.toLowerCase() === 's') {
            console.log('Iniciando migración completa...');
            await procesarPedidos();
          } else {
            console.log('Migración cancelada');
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
      } 
      else {
        console.log('Operación cancelada');
        readline.close();
        await mongoose.connection.close();
      }
    });
  } catch (err) {
    console.error('Error en proceso de migración:', err);
    process.exit(1);
  }
}

// Ejecutar script
main();