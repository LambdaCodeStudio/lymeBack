// src/logic/productoLogic.js
const Producto = require('../models/productoSchema');
const mongoose = require('mongoose');
const cacheService = require('../services/cacheService');

// Función optimizada para obtener productos paginados y filtrados
async function obtenerProductosPaginados(query = {}, page = 1, limit = 20, userSeccion = null) {
  // Generar clave de caché única
  const cacheKey = `productos_${JSON.stringify(query)}_${page}_${limit}_${userSeccion || 'all'}`;
  
  // Verificar si tenemos estos datos en caché
  const cachedData = cacheService.productos.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  const skip = (page - 1) * limit;
  
  // Filtrar automáticamente por sección del usuario si es necesario
  if (userSeccion && userSeccion !== 'ambos' && !query.categoria) {
    query.categoria = userSeccion;
  }
  
  // Proyección selectiva para reducir tamaño de respuesta
  const projection = {
    nombre: 1,
    descripcion: 1, 
    categoria: 1,
    subCategoria: 1,
    precio: 1,
    stock: 1,
    vendidos: 1,
    esCombo: 1,
    'itemsCombo.productoId': 1,
    'itemsCombo.cantidad': 1,
    updatedAt: 1,
    createdAt: 1
  };
  
  try {
    // Ejecutar consultas en paralelo para mejor rendimiento
    const [productos, totalItems] = await Promise.all([
      Producto.find(query, projection)
        .populate({
          path: 'itemsCombo.productoId',
          select: 'nombre precio' // Solo campos necesarios
        })
        .sort({ nombre: 1 }) 
        .skip(skip)
        .limit(limit)
        .lean() // Usar lean() para mejor rendimiento
        .exec(),
        
      Producto.countDocuments(query)
    ]);
    
    // Verificar qué productos tienen imágenes (sin cargar los bytes)
    // Optimizado para usar una sola consulta en lugar de múltiples
    const productIds = productos.map(p => p._id);
    const productsWithImages = await Producto.find(
      { _id: { $in: productIds }, imagen: { $exists: true, $ne: null } },
      { _id: 1 }
    ).lean();
    
    // Crear mapa para búsqueda rápida
    const hasImageMap = new Map();
    productsWithImages.forEach(p => {
      hasImageMap.set(p._id.toString(), true);
    });
    
    // Añadir flag hasImage a cada producto
    const enhancedProducts = productos.map(p => ({
      ...p,
      hasImage: hasImageMap.has(p._id.toString())
    }));
    
    // Preparar respuesta con metadatos de paginación
    const result = {
      items: enhancedProducts,
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNextPage: page < Math.ceil(totalItems / limit),
      hasPrevPage: page > 1
    };
    
    // Guardar en caché con TTL diferente según cantidad de elementos
    const cacheTTL = productos.length > 100 ? 180 : 300; // 3-5 minutos
    cacheService.productos.set(cacheKey, result, cacheTTL);
    
    return result;
  } catch (error) {
    console.error('Error al obtener productos paginados:', error);
    throw error;
  }
}

// Función optimizada para obtener un producto por ID
async function obtenerPorId(id) {
  // Validar el ID antes de continuar
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  
  // Clave de caché para el producto
  const cacheKey = `producto_${id}`;
  
  // Verificar si está en caché
  const cachedProduct = cacheService.productos.get(cacheKey);
  if (cachedProduct) {
    return cachedProduct;
  }
  
  try {
    // Obtener de la base de datos 
    const producto = await Producto.findById(id)
      .populate('itemsCombo.productoId')
      .lean();
    
    if (producto) {
      // Almacenar en caché
      cacheService.productos.set(cacheKey, producto);
    }
    
    return producto;
  } catch (error) {
    console.error(`Error al obtener producto ${id}:`, error);
    throw error;
  }
}

// Versión ligera para verificación rápida
async function obtenerPorIdLigero(id) {
  // Validar el ID antes de continuar
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  
  const cacheKey = `producto_ligero_${id}`;
  const cachedProduct = cacheService.frequent.get(cacheKey);
  
  if (cachedProduct) {
    return cachedProduct;
  }
  
  try {
    const producto = await Producto.findById(id, { 
      _id: 1, 
      categoria: 1,
      updatedAt: 1
    }).lean();
    
    if (producto) {
      // Caché por corto tiempo para datos ligeros
      cacheService.frequent.set(cacheKey, producto, 60);
    }
    
    return producto;
  } catch (error) {
    console.error(`Error al obtener producto ligero ${id}:`, error);
    throw error;
  }
}

// Versión antigua para compatibilidad
async function obtenerTodos(userSeccion = null) {
  const cacheKey = `todos_productos_${userSeccion || 'all'}`;
  const cachedProducts = cacheService.productos.get(cacheKey);
  
  if (cachedProducts) {
    return cachedProducts;
  }
  
  try {
    const result = await obtenerProductosPaginados({}, 1, 1000, userSeccion);
    const productos = result.items;
    
    // Caché más corto para listas completas (2 minutos)
    cacheService.productos.set(cacheKey, productos, 120);
    
    return productos;
  } catch (error) {
    console.error('Error al obtener todos los productos:', error);
    throw error;
  }
}

// Versión antigua para compatibilidad
async function obtenerProductosPorSeccion(seccion) {
  if (!seccion || seccion === 'ambos') {
    return obtenerTodos();
  }
  
  const cacheKey = `productos_seccion_${seccion}`;
  const cachedProducts = cacheService.productos.get(cacheKey);
  
  if (cachedProducts) {
    return cachedProducts;
  }
  
  try {
    const query = { categoria: seccion };
    const result = await obtenerProductosPaginados(query, 1, 1000, seccion);
    const productos = result.items;
    
    // Caché más corto para listas por sección (2 minutos)
    cacheService.productos.set(cacheKey, productos, 120);
    
    return productos;
  } catch (error) {
    console.error(`Error al obtener productos por sección ${seccion}:`, error);
    throw error;
  }
}

// Función optimizada para crear producto
async function crearProducto(datos) {
  try {
    // Si es un combo, validar los productos incluidos en una sola consulta
    if (datos.esCombo && datos.itemsCombo && datos.itemsCombo.length > 0) {
      const productIds = datos.itemsCombo.map(item => 
        mongoose.Types.ObjectId.isValid(item.productoId) ? 
        new mongoose.Types.ObjectId(item.productoId) : null
      ).filter(id => id !== null);
      
      const existingProducts = await Producto.find({ 
        _id: { $in: productIds },
        esCombo: false  // No permitir combos dentro de combos
      }, { _id: 1 }).lean();
      
      if (existingProducts.length !== productIds.length) {
        throw new Error('Algunos productos del combo no existen o son combos');
      }
    }
    
    // Validar stock según categoría
    if (datos.categoria === 'limpieza' && datos.stock < 1) {
      throw new Error('Los productos de limpieza deben tener stock mínimo de 1');
    }
    
    // Crear el producto
    const producto = new Producto(datos);
    const result = await producto.save();
    
    // Invalidar caché de productos
    invalidarCachePorCategoria(datos.categoria);
    
    return result;
  } catch (error) {
    console.error('Error al crear producto:', error);
    throw error;
  }
}

// Función optimizada para actualizar producto
async function actualizarProducto(id, datos) {
  try {
    // Validaciones con consultas optimizadas
    if (datos.itemsCombo && datos.itemsCombo.length > 0) {
      const productIds = datos.itemsCombo.map(item => 
        mongoose.Types.ObjectId.isValid(item.productoId) ? 
        new mongoose.Types.ObjectId(item.productoId) : null
      ).filter(id => id !== null);
      
      const existingProducts = await Producto.find({ 
        _id: { $in: productIds },
        esCombo: false  // No permitir combos dentro de combos
      }, { _id: 1 }).lean();
      
      if (existingProducts.length !== productIds.length) {
        throw new Error('Algunos productos del combo no existen o son combos');
      }
    }
    
    // Validación de stock para productos de limpieza
    if (datos.stock !== undefined) {
      if (datos.categoria === 'limpieza' && datos.stock < 1) {
        throw new Error('Los productos de limpieza deben tener stock mínimo de 1');
      } 
      else if (datos.categoria === undefined) {
        const productoActual = await Producto.findById(id, { categoria: 1 }).lean();
        if (productoActual && productoActual.categoria === 'limpieza' && datos.stock < 1) {
          throw new Error('Los productos de limpieza deben tener stock mínimo de 1');
        }
      }
    }
    
    // Actualizar producto
    const result = await Producto.findByIdAndUpdate(
      id, 
      datos, 
      { 
        new: true, 
        runValidators: true 
      }
    );
    
    if (result) {
      // Invalidar caché del producto específico
      invalidarCachePorId(id);
      
      // Invalidar caché de categoría si cambia
      if (datos.categoria) {
        invalidarCachePorCategoria(datos.categoria);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error al actualizar producto ${id}:`, error);
    throw error;
  }
}

// Función optimizada para eliminar producto
async function eliminarProducto(id) { 
  try {
    // Verificar si hay combos que incluyen este producto
    const combosConProducto = await Producto.find({
      esCombo: true,
      'itemsCombo.productoId': new mongoose.Types.ObjectId(id)
    }, { _id: 1, nombre: 1 }).lean();
    
    if (combosConProducto.length > 0) {
      const comboNames = combosConProducto.map(c => c.nombre).join(', ');
      throw new Error(`No se puede eliminar el producto porque está incluido en los siguientes combos: ${comboNames}`);
    }
    
    // Optimización: eliminar en una sola operación
    const producto = await Producto.findById(id, { categoria: 1 }).lean();
    if (!producto) {
      return null;
    }
    
    const result = await Producto.deleteOne({ _id: id });
    
    if (result.deletedCount > 0) {
      // Invalidar caché
      invalidarCachePorId(id);
      invalidarCachePorCategoria(producto.categoria);
    }
    
    return result;
  } catch (error) {
    console.error(`Error al eliminar producto ${id}:`, error);
    throw error;
  }
}

// Función optimizada para vender producto
async function venderProducto(id) {
  // Usar sesiones de MongoDB para operaciones atómicas
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const producto = await Producto.findById(id).session(session);
    
    if (!producto) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }
    
    // Verificar disponibilidad según categoría
    if (producto.categoria === 'limpieza' && producto.stock <= 1) {
      await session.abortTransaction();
      session.endSession();
      return null; // No se puede reducir por debajo de 1
    }
    
    // Para productos de mantenimiento, permitir stock negativo
    if (producto.categoria === 'mantenimiento' || producto.stock > 0) {
      // Si es un combo, reducir stock de los componentes en una sola operación
      if (producto.esCombo && producto.itemsCombo.length > 0) {
        // Obtener todos los productos de una vez
        const itemIds = producto.itemsCombo.map(item => item.productoId);
        const componentProducts = await Producto.find({
          _id: { $in: itemIds }
        }).session(session);
        
        // Crear un mapa para acceso rápido
        const componentMap = new Map();
        componentProducts.forEach(p => componentMap.set(p._id.toString(), p));
        
        // Verificar stock de todos los componentes
        for (const item of producto.itemsCombo) {
          const componenteProducto = componentMap.get(item.productoId.toString());
          
          if (!componenteProducto) {
            await session.abortTransaction();
            session.endSession();
            return null;
          }
          
          // Para componentes de limpieza, no permitir reducir por debajo de 1
          if (componenteProducto.categoria === 'limpieza' && 
              componenteProducto.stock - item.cantidad < 1) {
            await session.abortTransaction();
            session.endSession();
            return null;
          }
        }
        
        // Reducir stock de cada componente en una operación bulk
        const bulkOps = producto.itemsCombo.map(item => ({
          updateOne: {
            filter: { _id: item.productoId },
            update: { 
              $inc: { 
                stock: -item.cantidad,
                vendidos: item.cantidad
              } 
            }
          }
        }));
        
        await Producto.bulkWrite(bulkOps, { session });
      }
      
      // Actualizar el producto principal
      producto.stock -= 1;
      producto.vendidos += 1;
      
      await producto.save({ session });
      
      // Confirmar transacción
      await session.commitTransaction();
      
      // Invalidar caché
      invalidarCachePorId(id);
      
      return producto;
    }
    
    await session.abortTransaction();
    return null;
  } catch (error) {
    await session.abortTransaction();
    console.error(`Error al vender producto ${id}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Función optimizada para cancelar venta
async function cancelarVenta(id) {
  // Usar sesiones para transacciones atómicas
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const producto = await Producto.findById(id).session(session);
    
    if (!producto || producto.vendidos <= 0) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }
    
    // Si es un combo, aumentar stock de los componentes
    if (producto.esCombo && producto.itemsCombo.length > 0) {
      // Operación bulk para actualizar todos los componentes a la vez
      const bulkOps = producto.itemsCombo.map(item => ({
        updateOne: {
          filter: { _id: item.productoId },
          update: { 
            $inc: { 
              stock: item.cantidad,
              vendidos: -item.cantidad
            } 
          }
        }
      }));
      
      await Producto.bulkWrite(bulkOps, { session });
    }
    
    // Actualizar producto principal
    producto.stock += 1;
    producto.vendidos -= 1;
    
    await producto.save({ session });
    
    // Confirmar transacción
    await session.commitTransaction();
    
    // Invalidar caché
    invalidarCachePorId(id);
    
    return producto;
  } catch (error) {
    await session.abortTransaction();
    console.error(`Error al cancelar venta ${id}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Método optimizado para agregar o actualizar la imagen de un producto
async function updateImagen(productoId, imageBuffer) {
  try {
    const updateResult = await Producto.updateOne(
      { _id: productoId },
      { $set: { imagen: imageBuffer } }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error('Producto no encontrado');
    }
    
    // Invalidar caché del producto específico
    invalidarCachePorId(productoId);
    
    return { success: true, message: 'Imagen actualizada correctamente' };
  } catch (error) {
    console.error(`Error al actualizar imagen ${productoId}:`, error);
    throw error;
  }
}

// Método optimizado para agregar o actualizar la imagen en formato Base64
async function updateImagenBase64(productoId, base64String) {
  try {
    // Verificar que sea un formato base64 válido
    if (!base64String || typeof base64String !== 'string') {
      throw new Error('Formato de imagen inválido');
    }
    
    // Extraer la parte de datos del base64 si tiene el formato data:image
    let base64Data = base64String;
    if (base64String.startsWith('data:image/')) {
      const matches = base64String.match(/^data:image\/([a-zA-Z0-9+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        base64Data = matches[2];
      } else {
        throw new Error('Formato base64 inválido');
      }
    }
    
    // Convertir base64 a buffer para almacenamiento
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Actualizar directamente con operación optimizada
    const updateResult = await Producto.updateOne(
      { _id: productoId },
      { $set: { imagen: imageBuffer } }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error('Producto no encontrado');
    }
    
    // Invalidar caché del producto
    invalidarCachePorId(productoId);
    
    return { success: true, message: 'Imagen base64 actualizada correctamente' };
  } catch (error) {
    console.error(`Error al actualizar imagen base64 ${productoId}:`, error);
    throw error;
  }
}
  
// Método optimizado para obtener la imagen de un producto
async function getImagen(productoId) {
  try {
    // Clave de caché para la imagen
    const cacheKey = `imagen_buffer_${productoId}`;
    const cachedImage = cacheService.productos.get(cacheKey);
    
    if (cachedImage) {
      return cachedImage;
    }
    
    // No está en caché, obtener de la base de datos
    const producto = await Producto.findById(productoId).select('imagen');
    
    if (!producto) {
      throw new Error('Producto no encontrado');
    }
    
    if (!producto.imagen) {
      throw new Error('El producto no tiene una imagen');
    }
    
    // Almacenar en caché por más tiempo (1 hora) ya que las imágenes cambian poco
    cacheService.productos.set(cacheKey, producto.imagen, 3600);
    
    return producto.imagen;
  } catch (error) {
    console.error(`Error al obtener imagen ${productoId}:`, error);
    throw error;
  }
}

// Método optimizado para obtener la imagen en formato base64
async function getImagenBase64(productoId) {
  try {
    // Clave de caché para la imagen base64
    const cacheKey = `imagen_base64_${productoId}`;
    const cachedImage = cacheService.productos.get(cacheKey);
    
    if (cachedImage) {
      return cachedImage;
    }
    
    // No está en caché, obtener buffer
    const imageBuffer = await getImagen(productoId);
    
    // Convertir buffer a base64
    const base64Image = imageBuffer.toString('base64');
    const base64String = `data:image/png;base64,${base64Image}`;
    
    // Almacenar en caché
    cacheService.productos.set(cacheKey, base64String, 3600);
    
    return base64String;
  } catch (error) {
    console.error(`Error al obtener imagen base64 ${productoId}:`, error);
    throw error;
  }
}
  
// Método optimizado para eliminar la imagen de un producto
async function deleteImagen(productoId) {
  try {
    const updateResult = await Producto.updateOne(
      { _id: productoId },
      { $unset: { imagen: "" } }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error('Producto no encontrado');
    }
    
    // Invalidar caché de imágenes
    invalidarCachePorId(productoId);
    cacheService.productos.del(`imagen_buffer_${productoId}`);
    cacheService.productos.del(`imagen_base64_${productoId}`);
    
    return { success: true, message: 'Imagen eliminada correctamente' };
  } catch (error) {
    console.error(`Error al eliminar imagen ${productoId}:`, error);
    throw error;
  }
}

// Función optimizada para calcular precios totales de un combo
async function calcularPrecioCombo(comboId) {
  try {
    // Clave de caché
    const cacheKey = `precio_combo_${comboId}`;
    const cachedPrice = cacheService.frequent.get(cacheKey);
    
    if (cachedPrice !== null) {
      return cachedPrice;
    }
    
    // No está en caché, calcular
    const combo = await Producto.findById(comboId)
      .populate('itemsCombo.productoId', 'precio')
      .lean();
    
    if (!combo || !combo.esCombo) {
      throw new Error('El producto no es un combo');
    }
    
    let precioTotal = 0;
    
    for (const item of combo.itemsCombo) {
      if (item.productoId && item.productoId.precio) {
        precioTotal += item.productoId.precio * item.cantidad;
      }
    }
    
    // Almacenar en caché por tiempo corto (5 minutos)
    // ya que los precios pueden cambiar
    cacheService.frequent.set(cacheKey, precioTotal, 300);
    
    return precioTotal;
  } catch (error) {
    console.error(`Error al calcular precio combo ${comboId}:`, error);
    throw error;
  }
}

// Funciones optimizadas de invalidación de caché
function invalidarCachePorId(id) {
  cacheService.productos.del(`producto_${id}`);
  cacheService.frequent.del(`producto_ligero_${id}`);
}

function invalidarCachePorCategoria(categoria) {
  // Invalidar claves específicas por categoría
  cacheService.productos.del(`productos_seccion_${categoria}`);
  
  // Invalidar listas generales que podrían incluir productos de esta categoría
  cacheService.productos.del('todos_productos_all');
  cacheService.productos.del(`todos_productos_${categoria}`);
  cacheService.productos.del('todos_productos_ambos');
}

function getKeys() {
  return Object.keys(cacheService.productos.keys());
}

// Exportar todas las funciones
module.exports = {
  obtenerTodos,
  obtenerPorId,
  obtenerPorIdLigero,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  venderProducto,
  cancelarVenta,
  updateImagen,
  deleteImagen,
  getImagen,
  updateImagenBase64,
  getImagenBase64,
  obtenerProductosPorSeccion,
  obtenerProductosPaginados,
  calcularPrecioCombo,
  // Funciones de caché
  invalidarCachePorId,
  invalidarCachePorCategoria,
  invalidarCacheTotal: () => cacheService.productos.flush()
};