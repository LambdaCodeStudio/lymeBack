// src/logic/productoLogic.js
const Producto = require('../models/productoSchema');
const mongoose = require('mongoose');
const NodeCache = require('node-cache');

// Configuración de caché en memoria
// stdTTL: tiempo de vida en segundos (5 min)
// checkperiod: período para verificar claves expiradas (1 min)
const productoCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Función para invalidar toda la caché de productos
function invalidarCache() {
    console.log('Invalidando caché de productos');
    productoCache.flushAll();
}

// Función para invalidar una clave específica de caché
function invalidarCachePorClave(key) {
    console.log(`Invalidando caché para ${key}`);
    productoCache.del(key);
}

// Función para obtener productos paginados y filtrados
async function obtenerProductosPaginados(query = {}, page = 1, limit = 20, userSeccion = null) {
    // Generar clave de caché única
    const cacheKey = `productos_${JSON.stringify(query)}_${page}_${limit}_${userSeccion || 'all'}`;
    
    // Verificar si tenemos estos datos en caché
    const cachedData = productoCache.get(cacheKey);
    if (cachedData) {
        console.log(`Cache hit para ${cacheKey}`);
        return cachedData;
    }
    
    console.log(`Cache miss para ${cacheKey}, consultando base de datos`);
    
    const skip = (page - 1) * limit;
    
    // Filtrar automáticamente por sección del usuario si es necesario
    if (userSeccion && userSeccion !== 'ambos' && !query.categoria) {
        query.categoria = userSeccion;
    }
    
    // Proyección para seleccionar solo los campos necesarios
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
    
    // Ejecutar consultas en paralelo para mejor rendimiento
    const [productos, totalItems] = await Promise.all([
        Producto.find(query, projection)
            .populate({
                path: 'itemsCombo.productoId',
                select: 'nombre precio' // Solo los campos necesarios
            })
            .sort({ nombre: 1 }) // Ordenar por nombre
            .skip(skip)
            .limit(limit)
            .lean(), // Usar lean() para mejor rendimiento
            
        Producto.countDocuments(query)
    ]);
    
    // Verificar qué productos tienen imágenes (sin cargar los bytes)
    const productIds = productos.map(p => p._id);
    const productsWithImages = await Producto.find(
        { _id: { $in: productIds }, imagen: { $exists: true, $ne: null } },
        { _id: 1 }
    ).lean();
    
    // Crear mapa para seguimiento rápido
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
    
    // Guardar en caché
    productoCache.set(cacheKey, result);
    
    return result;
}

async function obtenerPorId(id) {
    // Clave de caché para el producto individual
    const cacheKey = `producto_${id}`;
    
    // Verificar si está en caché
    const cachedProduct = productoCache.get(cacheKey);
    if (cachedProduct) {
        return cachedProduct;
    }
    
    // No está en caché, buscar en la base de datos
    const producto = await Producto.findById(id)
        .populate('itemsCombo.productoId')
        .lean();
    
    if (producto) {
        // Almacenar en caché
        productoCache.set(cacheKey, producto);
    }
    
    return producto;
}

// Versión ligera para verificación rápida
async function obtenerPorIdLigero(id) {
    return await Producto.findById(id, { 
        _id: 1, 
        categoria: 1,
        updatedAt: 1
    }).lean();
}

// Versión antigua para compatibilidad
async function obtenerTodos(userSeccion = null) {
    return (await obtenerProductosPaginados({}, 1, 1000, userSeccion)).items;
}

// Versión antigua para compatibilidad
async function obtenerProductosPorSeccion(seccion) {
    let query = {};
    
    if (seccion && seccion !== 'ambos') {
        query.categoria = seccion;
    }
    
    return (await obtenerProductosPaginados(query, 1, 1000, seccion)).items;
}

async function crearProducto(datos) {
    // Si es un combo, validar los productos incluidos
    if (datos.esCombo && datos.itemsCombo && datos.itemsCombo.length > 0) {
        // Verificar que todos los productos existan
        const productIds = datos.itemsCombo.map(item => item.productoId);
        const existingProducts = await Producto.find({ 
            _id: { $in: productIds },
            esCombo: false  // No permitir combos dentro de combos
        });
        
        if (existingProducts.length !== productIds.length) {
            throw new Error('Algunos productos del combo no existen o son combos');
        }
    }
    
    // Validar stock según categoría
    if (datos.categoria === 'limpieza' && datos.stock < 1) {
        throw new Error('Los productos de limpieza deben tener stock mínimo de 1');
    }
    
    const producto = new Producto(datos);
    const result = await producto.save();
    
    // Invalidar caché tras crear un producto
    invalidarCache();
    
    return result;
}

async function actualizarProducto(id, datos) {
    // Si actualizamos items de combo, validar que existan
    if (datos.itemsCombo) {
        const productIds = datos.itemsCombo.map(item => item.productoId);
        const existingProducts = await Producto.find({ 
            _id: { $in: productIds },
            esCombo: false  // No permitir combos dentro de combos
        });
        
        if (existingProducts.length !== productIds.length) {
            throw new Error('Algunos productos del combo no existen o son combos');
        }
    }
    
    // Validación de stock para productos de limpieza
    if (datos.stock !== undefined) {
        // Si se está actualizando la categoría también
        if (datos.categoria === 'limpieza' && datos.stock < 1) {
            throw new Error('Los productos de limpieza deben tener stock mínimo de 1');
        } 
        // Si solo se actualiza el stock, necesitamos verificar la categoría actual
        else if (datos.categoria === undefined) {
            const productoActual = await Producto.findById(id);
            if (productoActual && productoActual.categoria === 'limpieza' && datos.stock < 1) {
                throw new Error('Los productos de limpieza deben tener stock mínimo de 1');
            }
        }
    }
    
    const result = await Producto.findByIdAndUpdate(id, datos, { new: true, runValidators: true });
    
    // Invalidar caché del producto específico y listas
    invalidarCachePorClave(`producto_${id}`);
    invalidarCache(); // También podríamos ser más selectivos
    
    return result;
}

async function eliminarProducto(id) { 
    // Verificar si hay combos que incluyen este producto
    const combosConProducto = await Producto.find({
        esCombo: true,
        'itemsCombo.productoId': new mongoose.Types.ObjectId(id)
    });    
    
    if (combosConProducto.length > 0) {
        const comboNames = combosConProducto.map(c => c.nombre).join(', ');
        throw new Error(`No se puede eliminar el producto porque está incluido en los siguientes combos: ${comboNames}`);
    }
    
    const result = await Producto.findByIdAndDelete(id);
    
    // Invalidar caché tras eliminar
    invalidarCachePorClave(`producto_${id}`);
    invalidarCache();
    
    return result;
}

async function venderProducto(id) {
    const producto = await Producto.findById(id);
    
    // Verificar disponibilidad según categoría
    if (!producto) {
        return null;
    }
    
    // Para productos de limpieza, el stock debe ser > 1 para poder vender
    if (producto.categoria === 'limpieza' && producto.stock <= 1) {
        return null; // No se puede reducir por debajo de 1
    }
    
    // Para productos de mantenimiento, permitir stock negativo
    if (producto.categoria === 'mantenimiento' || producto.stock > 0) {
        // Si es un combo, reducir stock de los componentes
        if (producto.esCombo && producto.itemsCombo.length > 0) {
            // Verificar stock de todos los componentes
            for (const item of producto.itemsCombo) {
                const componenteProducto = await Producto.findById(item.productoId);
                if (!componenteProducto) {
                    return null;
                }
                
                // Para componentes de limpieza, no permitir reducir por debajo de 1
                if (componenteProducto.categoria === 'limpieza' && 
                    componenteProducto.stock - item.cantidad < 1) {
                    return null;
                }
            }
            
            // Reducir stock de cada componente
            for (const item of producto.itemsCombo) {
                await Producto.findByIdAndUpdate(
                    item.productoId,
                    { 
                        $inc: { 
                            stock: -item.cantidad,
                            vendidos: item.cantidad
                        } 
                    }
                );
            }
        }
        
        producto.stock -= 1;
        producto.vendidos += 1;
        
        const result = await producto.save();
        
        // Invalidar caché del producto específico
        invalidarCachePorClave(`producto_${id}`);
        
        return result;
    }
    
    return null;
}

async function cancelarVenta(id) {
    const producto = await Producto.findById(id);
    if (!producto || producto.vendidos <= 0) {
        return null;
    }
    
    // Si es un combo, aumentar stock de los componentes
    if (producto.esCombo && producto.itemsCombo.length > 0) {
        for (const item of producto.itemsCombo) {
            await Producto.findByIdAndUpdate(
                item.productoId,
                { 
                    $inc: { 
                        stock: item.cantidad,
                        vendidos: -item.cantidad
                    } 
                }
            );
        }
    }
    
    producto.stock += 1;
    producto.vendidos -= 1;
    
    const result = await producto.save();
    
    // Invalidar caché del producto específico
    invalidarCachePorClave(`producto_${id}`);
    
    return result;
}

// Método para agregar o actualizar la imagen de un producto
async function updateImagen(productoId, imageBuffer) {
    try {
      const producto = await Producto.findById(productoId);
      
      if (!producto) {
        throw new Error('Producto no encontrado');
      }
      
      producto.imagen = imageBuffer;
      await producto.save();
      
      // Invalidar caché del producto específico
      invalidarCachePorClave(`producto_${productoId}`);
      
      return { success: true, message: 'Imagen actualizada correctamente' };
    } catch (error) {
      throw error;
    }
}

// Método para agregar o actualizar la imagen en formato Base64
async function updateImagenBase64(productoId, base64String) {
    try {
        const producto = await Producto.findById(productoId);
        
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
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
        
        producto.imagen = imageBuffer;
        await producto.save();
        
        // Invalidar caché del producto específico
        invalidarCachePorClave(`producto_${productoId}`);
        
        return { success: true, message: 'Imagen base64 actualizada correctamente' };
    } catch (error) {
        throw error;
    }
}
  
// Método para obtener la imagen de un producto
async function getImagen(productoId) {
    try {
        const producto = await Producto.findById(productoId).select('imagen');
        
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        if (!producto.imagen) {
            throw new Error('El producto no tiene una imagen');
        }
        
        return producto.imagen;
    } catch (error) {
        throw error;
    }
}

// Método para obtener la imagen en formato base64
async function getImagenBase64(productoId) {
    try {
        const producto = await Producto.findById(productoId).select('imagen');
        
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        if (!producto.imagen) {
            throw new Error('El producto no tiene una imagen');
        }
        
        // Convertir buffer a base64
        const base64Image = producto.imagen.toString('base64');
        // Intentar detectar el tipo de imagen (por simplicidad asumimos PNG)
        // En una implementación más robusta debería almacenarse el mimetype junto con la imagen
        const base64String = `data:image/png;base64,${base64Image}`;
        
        return base64String;
    } catch (error) {
        throw error;
    }
}
  
// Método para eliminar la imagen de un producto
async function deleteImagen(productoId) {
    try {
        const producto = await Producto.findById(productoId);
        
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        producto.imagen = undefined;
        await producto.save();
        
        // Invalidar caché del producto específico
        invalidarCachePorClave(`producto_${productoId}`);
        
        return { success: true, message: 'Imagen eliminada correctamente' };
    } catch (error) {
        throw error;
    }
}

// Nueva función para obtener precios totales de un combo
async function calcularPrecioCombo(comboId) {
    const combo = await Producto.findById(comboId).populate('itemsCombo.productoId');
    
    if (!combo || !combo.esCombo) {
        throw new Error('El producto no es un combo');
    }
    
    let precioTotal = 0;
    
    for (const item of combo.itemsCombo) {
        if (item.productoId && item.productoId.precio) {
            precioTotal += item.productoId.precio * item.cantidad;
        }
    }
    
    return precioTotal;
}

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
    invalidarCache
};