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

// Función mejorada para obtener todos los productos
async function obtenerTodos(userSeccion = null) {
    return (await obtenerProductosPaginados({}, 1, 1000, userSeccion)).items;
}

// Obtener un producto por ID (mantenemos la existente)
async function obtenerPorId(id) {
    const cacheKey = `producto_${id}`;
    const cachedProduct = productoCache.get(cacheKey);
    
    if (cachedProduct) {
        return cachedProduct;
    }
    
    const producto = await Producto.findById(id)
        .populate('itemsCombo.productoId')
        .lean();
    
    if (producto) {
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

// Función para obtener productos por sección
async function obtenerProductosPorSeccion(seccion) {
    let query = {};
    
    if (seccion && seccion !== 'ambos') {
        query.categoria = seccion;
    }
    
    return (await obtenerProductosPaginados(query, 1, 1000, seccion)).items;
}

// NUEVA FUNCIÓN: Obtener productos por marca
async function obtenerProductosPorMarca(marca, userSeccion = null) {
    let query = { marca };
    
    if (userSeccion && userSeccion !== 'ambos') {
        query.categoria = userSeccion;
    }
    
    return (await obtenerProductosPaginados(query, 1, 1000, userSeccion)).items;
}

// NUEVA FUNCIÓN: Obtener productos por proveedor
async function obtenerProductosPorProveedor(proveedorNombre, userSeccion = null) {
    let query = { 'proveedor.nombre': proveedorNombre };
    
    if (userSeccion && userSeccion !== 'ambos') {
        query.categoria = userSeccion;
    }
    
    return (await obtenerProductosPaginados(query, 1, 1000, userSeccion)).items;
}

// NUEVA FUNCIÓN: Buscar productos por rango de precios
async function obtenerProductosPorRangoPrecio(precioMin, precioMax, userSeccion = null) {
    let query = {
        precio: { $gte: precioMin, $lte: precioMax }
    };
    
    if (userSeccion && userSeccion !== 'ambos') {
        query.categoria = userSeccion;
    }
    
    return (await obtenerProductosPaginados(query, 1, 1000, userSeccion)).items;
}

// NUEVA FUNCIÓN: Obtener productos con stock bajo
async function obtenerProductosStockBajo(threshold = null, userSeccion = null) {
    let query = {};
    
    if (threshold !== null) {
        // Si se proporciona un umbral personalizado
        query.stock = { $lte: threshold, $gt: 0 };
    } else {
        // Usar el campo de alertaStockBajo calculado automáticamente
        query.alertaStockBajo = true;
        query.stock = { $gt: 0 }; // Excluir productos sin stock
    }
    
    if (userSeccion && userSeccion !== 'ambos') {
        query.categoria = userSeccion;
    }
    
    return (await obtenerProductosPaginados(query, 1, 1000, userSeccion)).items;
}

// NUEVA FUNCIÓN: Obtener productos sin stock
async function obtenerProductosSinStock(userSeccion = null) {
    let query = { stock: 0 };
    
    if (userSeccion && userSeccion !== 'ambos') {
        query.categoria = userSeccion;
    }
    
    return (await obtenerProductosPaginados(query, 1, 1000, userSeccion)).items;
}

// NUEVA FUNCIÓN: Obtener productos más vendidos
async function obtenerProductosMasVendidos(limite = 10, userSeccion = null) {
    let query = { vendidos: { $gt: 0 } };
    
    if (userSeccion && userSeccion !== 'ambos') {
        query.categoria = userSeccion;
    }
    
    const productos = await Producto.find(query)
        .sort({ vendidos: -1 })
        .limit(limite)
        .lean();
        
    return productos;
}

// Función mejorada para obtener productos paginados y filtrados
async function obtenerProductosPaginados(query = {}, page = 1, limit = 20, userSeccion = null, sortBy = 'nombre', sortDir = 1) {
    // Procesamiento de filtros especiales
    // Verificar si debemos filtrar por productos sin stock (prioridad más alta)
    if (query.noStock === 'true' || query.noStock === true) {
        delete query.noStock;
        query.stock = 0;
    }
    // Verificar si debemos filtrar por stock bajo (segunda prioridad)
    else if (query.lowStock === 'true' || query.lowStock === true) {
        // Obtener umbral desde query, por defecto 10
        const threshold = parseInt(query.threshold) || 10;
        delete query.lowStock;
        delete query.threshold;
        
        // Añadir condición de stock bajo a la query
        query.stock = { $lte: threshold, $gt: 0 };
    }
    
    // NUEVA FUNCIONALIDAD: Filtrar por estado
    if (query.estado) {
        query.estado = query.estado;
    }
    
    // NUEVA FUNCIONALIDAD: Filtrar por rango de precios
    if (query.precioMin !== undefined || query.precioMax !== undefined) {
        query.precio = {};
        
        if (query.precioMin !== undefined) {
            query.precio.$gte = parseFloat(query.precioMin);
            delete query.precioMin;
        }
        
        if (query.precioMax !== undefined) {
            query.precio.$lte = parseFloat(query.precioMax);
            delete query.precioMax;
        }
    }
    
    // NUEVA FUNCIONALIDAD: Filtrar por marca
    if (query.marca) {
        query.marca = query.marca;
    }
    
    // NUEVA FUNCIONALIDAD: Filtrar por proveedor
    if (query.proveedor) {
        query['proveedor.nombre'] = query.proveedor;
        delete query.proveedor;
    }
    
    // NUEVA FUNCIONALIDAD: Filtrar por fecha de actualización
    if (query.updatedAfter) {
        query.updatedAt = { $gte: new Date(query.updatedAfter) };
        delete query.updatedAfter;
    }
    
    // NUEVA FUNCIONALIDAD: Búsqueda de texto
    if (query.texto) {
        query.$text = { $search: query.texto };
        delete query.texto;
    }
    
    // Generar clave de caché única
    const cacheKey = `productos_${JSON.stringify(query)}_${page}_${limit}_${userSeccion || 'all'}_${sortBy}_${sortDir}`;
    
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
    
    // Determinar orden de resultados
    const sort = {};
    sort[sortBy] = sortDir;
    
    // Proyección para seleccionar solo los campos necesarios (optimizada)
    const projection = {
        nombre: 1,
        descripcion: 1, 
        categoria: 1,
        subCategoria: 1,
        marca: 1,
        precio: 1,
        stock: 1,
        vendidos: 1,
        esCombo: 1,
        'proveedor.nombre': 1,
        'ubicacion.deposito': 1,
        estado: 1,
        alertaStockBajo: 1,
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
            .sort(sort)
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
        hasPrevPage: page > 1,
        sortBy,
        sortDir
    };
    
    // Guardar en caché
    productoCache.set(cacheKey, result);
    
    return result;
}

// NUEVA FUNCIÓN: Generar reporte de inventario con cortes de control
async function generarReporteInventario(userSeccion = null) {
    const match = {};
    if (userSeccion && userSeccion !== 'ambos') {
        match.categoria = userSeccion;
    }
    
    // Usamos agregación para generar el reporte con cortes de control
    const resultado = await Producto.aggregate([
        { $match: match },
        { 
            $project: {
                _id: 1,
                nombre: 1, 
                categoria: 1,
                subCategoria: 1,
                marca: { $ifNull: ['$marca', 'Sin marca'] },
                'proveedor.nombre': { $ifNull: ['$proveedor.nombre', 'Sin proveedor'] },
                precio: 1,
                stock: 1,
                valorInventario: { $multiply: ['$precio', '$stock'] }
            }
        },
        {
            $sort: {
                categoria: 1,
                subCategoria: 1,
                marca: 1,
                'proveedor.nombre': 1
            }
        },
        {
            $group: {
                _id: {
                    categoria: '$categoria',
                    subCategoria: '$subCategoria',
                    marca: '$marca'
                },
                productos: { $push: '$$ROOT' },
                cantidadProductos: { $sum: 1 },
                stockTotal: { $sum: '$stock' },
                valorTotal: { $sum: '$valorInventario' }
            }
        },
        {
            $sort: {
                '_id.categoria': 1,
                '_id.subCategoria': 1,
                '_id.marca': 1
            }
        }
    ]);
    
    // Estructurar el reporte final
    const reporte = {
        totalProductos: 0,
        totalStock: 0,
        valorTotalInventario: 0,
        cortes: []
    };
    
    // Procesar resultados
    resultado.forEach(grupo => {
        reporte.totalProductos += grupo.cantidadProductos;
        reporte.totalStock += grupo.stockTotal;
        reporte.valorTotalInventario += grupo.valorTotal;
        
        // Estructurar el corte de control
        reporte.cortes.push({
            // Estilo corte de control
            tipo: 'CATEGORIA',
            CATEGORIA: grupo._id.categoria,
            SUBCATEGORIA: grupo._id.subCategoria,
            MARCA: grupo._id.marca,
            cantidadProductos: grupo.cantidadProductos,
            stockTotal: grupo.stockTotal,
            valorTotal: grupo.valorTotal,
            productos: grupo.productos
        });
    });
    
    return reporte;
}

// NUEVA FUNCIÓN: Generar estadísticas por categoría
async function obtenerEstadisticasPorCategoria() {
    const resultado = await Producto.aggregate([
        {
            $group: {
                _id: '$categoria',
                cantidadProductos: { $sum: 1 },
                stockTotal: { $sum: '$stock' },
                valorTotal: { $sum: { $multiply: ['$precio', '$stock'] } },
                productosStockBajo: { 
                    $sum: { 
                        $cond: [{ $eq: ['$alertaStockBajo', true] }, 1, 0] 
                    } 
                },
                productosSinStock: { 
                    $sum: { 
                        $cond: [{ $eq: ['$stock', 0] }, 1, 0] 
                    } 
                },
                ventasTotal: { $sum: '$vendidos' }
            }
        },
        {
            $project: {
                categoria: '$_id',
                cantidadProductos: 1,
                stockTotal: 1,
                valorTotal: 1,
                productosStockBajo: 1,
                productosSinStock: 1,
                ventasTotal: 1,
                promedioStock: { 
                    $cond: [
                        { $eq: ['$cantidadProductos', 0] },
                        0,
                        { $divide: ['$stockTotal', '$cantidadProductos'] }
                    ]
                },
                porcentajeStockBajo: { 
                    $cond: [
                        { $eq: ['$cantidadProductos', 0] },
                        0,
                        { 
                            $multiply: [
                                { $divide: ['$productosStockBajo', '$cantidadProductos'] },
                                100
                            ] 
                        }
                    ]
                }
            }
        },
        {
            $sort: { 'categoria': 1 }
        }
    ]);
    
    return resultado;
}

// NUEVA FUNCIÓN: Generar pronóstico de agotamiento
async function generarPronosticoAgotamiento() {
    const productos = await Producto.find({
        stock: { $gt: 0 },
        vendidos: { $gt: 0 }
    }).select('_id nombre categoria stock vendidos precio').lean();
    
    // Cálculo simple basado en ventas históricas
    // En una implementación más avanzada, se analizaría el historial detallado
    const pronosticos = productos.map(producto => {
        // Suponiendo que vendidos representa ventas en los últimos 30 días
        const ventasDiarias = producto.vendidos / 30;
        const diasHastaAgotamiento = ventasDiarias > 0 
            ? Math.round(producto.stock / ventasDiarias)
            : null;
            
        return {
            _id: producto._id,
            nombre: producto.nombre,
            categoria: producto.categoria,
            stock: producto.stock,
            vendidos: producto.vendidos,
            precio: producto.precio,
            ventasDiarias,
            diasHastaAgotamiento,
            valorInventario: producto.stock * producto.precio,
            prioridad: diasHastaAgotamiento !== null && diasHastaAgotamiento <= 15
                ? 'ALTA'
                : diasHastaAgotamiento !== null && diasHastaAgotamiento <= 30
                    ? 'MEDIA'
                    : 'BAJA'
        };
    });
    
    // Ordenar por días hasta agotamiento (priorizando los que se agotan pronto)
    return pronosticos.sort((a, b) => {
        // Null values last
        if (a.diasHastaAgotamiento === null) return 1;
        if (b.diasHastaAgotamiento === null) return -1;
        
        return a.diasHastaAgotamiento - b.diasHastaAgotamiento;
    });
}

// Función mejorada para crear productos
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
    
    // NUEVA FUNCIONALIDAD: Inicializar historialPrecios al crear producto
    if (!datos.historialPrecios || !datos.historialPrecios.length) {
        datos.historialPrecios = [{
            precio: datos.precio,
            fecha: new Date()
        }];
    }
    
    // Establecer alerta de stock bajo
    datos.alertaStockBajo = datos.stock <= (datos.stockMinimo || 5);
    
    const producto = new Producto(datos);
    const result = await producto.save();
    
    // Invalidar caché tras crear un producto
    invalidarCache();
    
    return result;
}

// Función mejorada para actualizar productos
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
    
    // NUEVA FUNCIONALIDAD: Si cambia el precio, actualizar en el historial
    if (datos.precio !== undefined) {
        const productoActual = await Producto.findById(id);
        if (productoActual && productoActual.precio !== datos.precio) {
            // Utilizamos $push para añadir un elemento al array sin traer todo el historial
            await Producto.updateOne(
                { _id: id },
                { 
                    $push: { 
                        historialPrecios: {
                            precio: datos.precio,
                            fecha: new Date()
                        } 
                    }
                }
            );
        }
    }
    
    // NUEVA FUNCIONALIDAD: Actualizar alerta de stock bajo automáticamente
    if (datos.stock !== undefined || datos.stockMinimo !== undefined) {
        const productoActual = await Producto.findById(id);
        if (productoActual) {
            const nuevoStock = datos.stock !== undefined ? datos.stock : productoActual.stock;
            const nuevoStockMinimo = datos.stockMinimo !== undefined ? datos.stockMinimo : productoActual.stockMinimo;
            
            datos.alertaStockBajo = nuevoStock <= nuevoStockMinimo;
        }
    }
    
    const result = await Producto.findByIdAndUpdate(id, datos, { new: true, runValidators: true });
    
    // Invalidar caché del producto específico y listas
    invalidarCachePorClave(`producto_${id}`);
    invalidarCache(); // También podríamos ser más selectivos
    
    return result;
}

// Función para eliminar productos 
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

// Función para vender un producto
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
        
        // NUEVA FUNCIONALIDAD: Actualizar historial de ventas
        const fechaActual = new Date();
        producto.ultimaVenta = fechaActual;
        
        // Registrar venta con la cantidad actual (siempre 1)
        if (!producto.historialVentas) {
            producto.historialVentas = [];
        }
        
        producto.historialVentas.push({
            cantidad: 1,
            fecha: fechaActual
        });
        
        // Actualizar stock y contador de vendidos
        producto.stock -= 1;
        producto.vendidos += 1;
        
        // Actualizar alerta de stock bajo
        producto.alertaStockBajo = producto.stock <= producto.stockMinimo;
        
        const result = await producto.save();
        
        // Invalidar caché del producto específico
        invalidarCachePorClave(`producto_${id}`);
        
        return result;
    }
    
    return null;
}

// Función para cancelar una venta
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
    
    // Actualizar alerta de stock bajo
    producto.alertaStockBajo = producto.stock <= producto.stockMinimo;
    
    const result = await producto.save();
    
    // Invalidar caché del producto específico
    invalidarCachePorClave(`producto_${id}`);
    
    return result;
}

// Función para actualizar imagen
async function updateImagen(productoId, imageBuffer) {
    try {
      const producto = await Producto.findById(productoId);
      
      if (!producto) {
        throw new Error('Producto no encontrado');
      }
      
      producto.imagen = imageBuffer;
      
      // NUEVA FUNCIONALIDAD: Añadir metadatos de la imagen
      producto.imagenInfo = {
        tamano: imageBuffer.length,
        ultimaActualizacion: new Date()
      };
      
      await producto.save();
      
      // Invalidar caché del producto específico
      invalidarCachePorClave(`producto_${productoId}`);
      
      return { success: true, message: 'Imagen actualizada correctamente' };
    } catch (error) {
      throw error;
    }
}

// Función para actualizar imagen en formato base64
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
        let mimetype = 'image/png'; // Por defecto
        
        if (base64String.startsWith('data:image/')) {
            const matches = base64String.match(/^data:image\/([a-zA-Z0-9+/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimetype = `image/${matches[1]}`;
                base64Data = matches[2];
            } else {
                throw new Error('Formato base64 inválido');
            }
        }
        
        // Convertir base64 a buffer para almacenamiento
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        producto.imagen = imageBuffer;
        
        // NUEVA FUNCIONALIDAD: Añadir metadatos de la imagen
        producto.imagenInfo = {
            mimetype,
            tamano: imageBuffer.length,
            ultimaActualizacion: new Date()
        };
        
        await producto.save();
        
        // Invalidar caché del producto específico
        invalidarCachePorClave(`producto_${productoId}`);
        
        return { success: true, message: 'Imagen base64 actualizada correctamente' };
    } catch (error) {
        throw error;
    }
}

// Función para obtener imagen
async function getImagen(productoId) {
    try {
        const producto = await Producto.findById(productoId).select('imagen imagenInfo');
        
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

// Función para obtener imagen en formato base64
async function getImagenBase64(productoId) {
    try {
        const producto = await Producto.findById(productoId).select('imagen imagenInfo');
        
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        if (!producto.imagen) {
            throw new Error('El producto no tiene una imagen');
        }
        
        // Convertir buffer a base64
        const base64Image = producto.imagen.toString('base64');
        
        // Usar el tipo MIME guardado o asumir PNG por defecto
        const mimetype = producto.imagenInfo && producto.imagenInfo.mimetype
            ? producto.imagenInfo.mimetype
            : 'image/png';
            
        const base64String = `data:${mimetype};base64,${base64Image}`;
        
        return base64String;
    } catch (error) {
        throw error;
    }
}

// Función para eliminar imagen
async function deleteImagen(productoId) {
    try {
        const producto = await Producto.findById(productoId);
        
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        
        producto.imagen = undefined;
        producto.imagenInfo = undefined;
        await producto.save();
        
        // Invalidar caché del producto específico
        invalidarCachePorClave(`producto_${productoId}`);
        
        return { success: true, message: 'Imagen eliminada correctamente' };
    } catch (error) {
        throw error;
    }
}

// Función para calcular precio de combo
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

// NUEVA FUNCIÓN: Exportar datos para reportes CSV/Excel
async function exportarDatosProductos(formato = 'csv', filtros = {}) {
    // Obtener productos según filtros
    const productos = await Producto.find(filtros)
        .sort({ categoria: 1, subCategoria: 1, nombre: 1 })
        .lean();
    
    // Preparar datos para formato tabular
    return productos.map(producto => ({
        id: producto._id.toString(),
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        categoria: producto.categoria,
        subCategoria: producto.subCategoria,
        marca: producto.marca || '',
        proveedor: producto.proveedor?.nombre || '',
        precio: producto.precio,
        stock: producto.stock,
        stockMinimo: producto.stockMinimo || 0,
        vendidos: producto.vendidos || 0,
        alertaStockBajo: producto.alertaStockBajo ? 'Sí' : 'No',
        esCombo: producto.esCombo ? 'Sí' : 'No',
        estado: producto.estado || 'activo',
        fechaCreacion: producto.createdAt,
        ultimaActualizacion: producto.updatedAt
    }));
}

// NUEVA FUNCIÓN: Actualizar estadísticas de productos
async function actualizarEstadisticasProductos() {
    // Esta función podría ejecutarse periódicamente (cron job)
    console.log('Actualizando estadísticas de productos...');
    
    // Obtener todos los productos activos
    const productos = await Producto.find({ estado: 'activo' });
    
    // Actualizar estadísticas para cada producto
    for (const producto of productos) {
        try {
            // Calcular tendencia de ventas si hay suficientes datos
            if (producto.historialVentas && producto.historialVentas.length > 0) {
                // Fecha actual
                const ahora = new Date();
                
                // Calcular ventas diarias (últimos 30 días)
                const ventasUltimos30Dias = producto.historialVentas.filter(v => {
                    const diff = (ahora - v.fecha) / (1000 * 60 * 60 * 24);
                    return diff <= 30;
                }).reduce((total, v) => total + v.cantidad, 0);
                
                // Calcular ventas semanales (últimos 7 días)
                const ventasUltimos7Dias = producto.historialVentas.filter(v => {
                    const diff = (ahora - v.fecha) / (1000 * 60 * 60 * 24);
                    return diff <= 7;
                }).reduce((total, v) => total + v.cantidad, 0);
                
                // Calcular tendencias
                producto.tendenciaVentas = {
                    diaria: ventasUltimos7Dias / 7,
                    semanal: ventasUltimos7Dias,
                    mensual: ventasUltimos30Dias
                };
                
                // Calcular días hasta agotamiento
                if (producto.tendenciaVentas.diaria > 0) {
                    producto.diasHastaAgotamiento = Math.round(producto.stock / producto.tendenciaVentas.diaria);
                }
            }
            
            // Guardar cambios
            await producto.save();
            
        } catch (error) {
            console.error(`Error al actualizar estadísticas para producto ${producto._id}:`, error);
        }
    }
    
    console.log('Actualización de estadísticas completada');
    
    // Invalida toda la caché para reflejar los cambios
    invalidarCache();
    
    return { actualizados: productos.length };
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
    invalidarCache,
    obtenerProductosPorMarca,
    obtenerProductosPorProveedor,
    obtenerProductosPorRangoPrecio,
    obtenerProductosStockBajo,
    obtenerProductosSinStock,
    obtenerProductosMasVendidos,
    generarReporteInventario,
    obtenerEstadisticasPorCategoria,
    generarPronosticoAgotamiento,
    exportarDatosProductos,
    actualizarEstadisticasProductos
};