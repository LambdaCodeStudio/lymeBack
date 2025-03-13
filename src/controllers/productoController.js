// src/controllers/productoController.js
const productoLogic = require('../logic/productoLogic');
const cacheService = require('../services/cacheService');

// Controlador optimizado para obtener todos los productos
async function obtenerTodos(req, res) {
    try {
        // Implementar paginación con valores por defecto optimizados
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        // Obtener parámetros de filtrado
        const searchTerm = req.query.search || '';
        const category = req.query.category || '';
        
        // Obtener sección del usuario
        const userSeccion = req.user ? req.user.secciones : null;
        
        // Construir filtro base
        let query = {};
        
        // Optimizar construcción de query
        if (category && category !== 'all') {
            query.categoria = category;
        } else if (userSeccion && userSeccion !== 'ambos') {
            query.categoria = userSeccion;
        }
        
        // Filtrar por término de búsqueda optimizado
        if (searchTerm) {
            // Usar índice de texto si existe, sino usar expresiones regulares
            if (searchTerm.length >= 3) {
                query.$or = [
                    { nombre: { $regex: searchTerm, $options: 'i' } },
                    { descripcion: { $regex: searchTerm, $options: 'i' } }
                ];
                
                // Solo buscar en proovedorInfo si es necesario (último)
                if (searchTerm.length >= 5) {
                    query.$or.push({ proovedorInfo: { $regex: searchTerm, $options: 'i' } });
                }
            } else {
                // Para términos muy cortos, solo buscar en nombre para mejor rendimiento
                query.nombre = { $regex: searchTerm, $options: 'i' };
            }
        }
        
        // Obtener productos con paginación y filtros
        const result = await productoLogic.obtenerProductosPaginados(
            query, 
            page, 
            limit, 
            userSeccion
        );
        
        // Configurar cache-control en la respuesta
        res.set('Cache-Control', 'private, max-age=60'); // 1 minuto
        res.json(result);
    } catch (error) {
        console.error('Error en obtenerTodos:', error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
}

// Controlador optimizado para obtener producto por ID
async function obtenerPorId(req, res) {
    try {
        const producto = await productoLogic.obtenerPorId(req.params.id);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Verificar permisos de sección
        const userSeccion = req.user ? req.user.secciones : null;
        if (userSeccion && userSeccion !== 'ambos' && producto.categoria !== userSeccion) {
            return res.status(403).json({ 
                error: 'No tiene permisos para ver productos de esta categoría' 
            });
        }
        
        // Configurar cache-control en la respuesta
        res.set('Cache-Control', 'private, max-age=300'); // 5 minutos
        res.json(producto);
    } catch (error) {
        console.error('Error en obtenerPorId:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: 'Error al obtener el producto' });
    }
}

// Controlador optimizado para crear producto
async function crearProducto(req, res) {
    try {
        // Validaciones optimizadas
        if (req.body.precio < 0) {
            return res.status(400).json({ error: 'El precio no puede ser negativo' });
        }
        
        // Validar stock según categoría
        if (req.body.categoria === 'limpieza' && req.body.stock < 1) {
            return res.status(400).json({ 
                error: 'Los productos de limpieza deben tener stock mínimo de 1' 
            });
        }
        
        // Validar combos
        if (req.body.esCombo && (!req.body.itemsCombo || req.body.itemsCombo.length === 0)) {
            return res.status(400).json({ error: 'Un combo debe tener al menos un producto' });
        }

        // Verificar permisos de sección
        const userSeccion = req.user ? req.user.secciones : null;
        if (userSeccion && userSeccion !== 'ambos' && req.body.categoria !== userSeccion) {
            return res.status(403).json({ 
                error: 'No tiene permisos para crear productos en esta categoría' 
            });
        }

        const nuevoProducto = await productoLogic.crearProducto(req.body);
        res.status(201).json(nuevoProducto);
    } catch (error) {
        console.error('Error en crearProducto:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Error al crear el producto' });
    }
}

// Controlador optimizado para actualizar producto
async function actualizarProducto(req, res) {
    try {
        // Validaciones optimizadas
        if (req.body.precio !== undefined && req.body.precio < 0) {
            return res.status(400).json({ error: 'El precio no puede ser negativo' });
        }
        
        // Obtener producto actual para validaciones (versión ligera)
        const productoActual = await productoLogic.obtenerPorIdLigero(req.params.id);
        if (!productoActual) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Validar stock según categoría actual o nueva
        const categoriaFinal = req.body.categoria || productoActual.categoria;
        if (categoriaFinal === 'limpieza' && req.body.stock !== undefined && req.body.stock < 1) {
            return res.status(400).json({ 
                error: 'Los productos de limpieza deben tener stock mínimo de 1' 
            });
        }
        
        // Verificar permisos de sección
        const userSeccion = req.user ? req.user.secciones : null;
        if (userSeccion && userSeccion !== 'ambos') {
            // Si está cambiando la categoría
            if (req.body.categoria && req.body.categoria !== productoActual.categoria) {
                return res.status(403).json({ 
                    error: 'No tiene permisos para cambiar la categoría del producto' 
                });
            }
            
            // Si el producto no es de su sección
            if (productoActual.categoria !== userSeccion) {
                return res.status(403).json({ 
                    error: 'No tiene permisos para modificar productos de esta categoría' 
                });
            }
        }

        const producto = await productoLogic.actualizarProducto(req.params.id, req.body);
        res.json(producto);
    } catch (error) {
        console.error('Error en actualizarProducto:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: error.message || 'Error al actualizar el producto' });
    }
}

// Controlador optimizado para eliminar producto
async function eliminarProducto(req, res) {
    try {
        // Verificar si el producto existe (versión ligera)
        const productoActual = await productoLogic.obtenerPorIdLigero(req.params.id);
        if (!productoActual) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Verificar permisos de sección
        const userSeccion = req.user ? req.user.secciones : null;
        if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
            return res.status(403).json({ 
                error: 'No tiene permisos para eliminar productos de esta categoría' 
            });
        }
        
        await productoLogic.eliminarProducto(req.params.id);
        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error en eliminarProducto:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: error.message || 'Error al eliminar el producto' });
    }
}

// Controlador optimizado para vender producto
async function venderProducto(req, res) {
    try {
        // Verificar si el producto existe (versión ligera)
        const productoActual = await productoLogic.obtenerPorIdLigero(req.params.id);
        if (!productoActual) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Verificar permisos de sección
        const userSeccion = req.user ? req.user.secciones : null;
        if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
            return res.status(403).json({ 
                error: 'No tiene permisos para vender productos de esta categoría' 
            });
        }
        
        const producto = await productoLogic.venderProducto(req.params.id);
        if (!producto) {
            if (productoActual.categoria === 'limpieza') {
                return res.status(400).json({ 
                    error: 'No se puede reducir el stock por debajo del mínimo permitido (1) para productos de limpieza' 
                });
            } else {
                return res.status(400).json({ error: 'No se pudo procesar la venta del producto' });
            }
        }
        
        res.json({ 
            mensaje: 'Venta realizada con éxito',
            producto 
        });
    } catch (error) {
        console.error('Error en venderProducto:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: error.message || 'Error al procesar la venta' });
    }
}

// Controlador optimizado para cancelar venta
async function cancelarVenta(req, res) {
    try {
        // Verificar si el producto existe (versión ligera)
        const productoActual = await productoLogic.obtenerPorIdLigero(req.params.id);
        if (!productoActual) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Verificar permisos de sección
        const userSeccion = req.user ? req.user.secciones : null;
        if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
            return res.status(403).json({ 
                error: 'No tiene permisos para cancelar ventas de productos de esta categoría' 
            });
        }
        
        const producto = await productoLogic.cancelarVenta(req.params.id);
        if (!producto) {
            return res.status(400).json({ error: 'No se pudo cancelar la venta del producto' });
        }
        
        res.json({ 
            mensaje: 'Venta cancelada correctamente',
            producto 
        });
    } catch (error) {
        console.error('Error en cancelarVenta:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: 'Error al cancelar la venta' });
    }
}

// Controlador optimizado para subir imagen
async function uploadImagen(req, res) {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se ha proporcionado ninguna imagen' 
        });
      }
      
      // Verificar si el producto existe (versión ligera)
      const productoActual = await productoLogic.obtenerPorIdLigero(id);
      if (!productoActual) {
          return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      // Verificar permisos de sección
      const userSeccion = req.user ? req.user.secciones : null;
      if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
          return res.status(403).json({ 
              error: 'No tiene permisos para modificar productos de esta categoría' 
          });
      }
      
      // Optimización: comprimir imagen antes de guardar
      const sharp = require('sharp');
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      
      const resultado = await productoLogic.updateImagen(id, optimizedBuffer);
      
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al subir imagen del producto:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
}

// Controlador optimizado para subir imagen en formato base64
async function uploadImagenBase64(req, res) {
    try {
      const { id } = req.params;
      const { base64Image } = req.body;
      
      if (!base64Image) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se ha proporcionado ninguna imagen en formato base64' 
        });
      }
      
      // Verificar si el producto existe (versión ligera)
      const productoActual = await productoLogic.obtenerPorIdLigero(id);
      if (!productoActual) {
          return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      // Verificar permisos de sección
      const userSeccion = req.user ? req.user.secciones : null;
      if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
          return res.status(403).json({ 
              error: 'No tiene permisos para modificar productos de esta categoría' 
          });
      }
      
      const resultado = await productoLogic.updateImagenBase64(id, base64Image);
      
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al subir imagen base64 del producto:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
}
  
// Controlador optimizado para obtener imagen
async function getImagen(req, res) {
    try {
      const { id } = req.params;
      const { quality = 80, width, height } = req.query;
      
      // Crear clave de caché única para esta configuración de imagen
      const cacheKey = `imagen_${id}_${quality}_${width || 'auto'}_${height || 'auto'}`;
      
      // Verificar en caché primero
      const cachedImageResponse = cacheService.productos.get(cacheKey);
      if (cachedImageResponse) {
        // Establecer los encabezados desde la caché
        Object.entries(cachedImageResponse.headers).forEach(([key, value]) => {
          res.set(key, value);
        });
        
        // Devolver la imagen en caché
        return res.send(cachedImageResponse.data);
      }
      
      // Verificar si el producto existe con consulta ligera
      const productoActual = await productoLogic.obtenerPorIdLigero(id);
      if (!productoActual) {
          return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      // Verificar permisos de sección
      const userSeccion = req.user ? req.user.secciones : null;
      if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
          return res.status(403).json({ 
              error: 'No tiene permisos para ver productos de esta categoría' 
          });
      }
      
      // Optimización: Usar ETags para caché
      const etagFromClient = req.headers['if-none-match'];
      
      // Generar ETag basado en fecha de actualización y parámetros
      const etag = `W/"img-${id}-${productoActual.updatedAt}-${quality}-${width || 'auto'}-${height || 'auto'}"`;
      
      // Si el cliente envió un ETag que coincide, responder 304
      if (etagFromClient === etag) {
          return res.status(304).end();
      }
      
      try {
        // Obtener la imagen
        const imagen = await productoLogic.getImagen(id);
        
        // Proceso optimizado con sharp
        const sharp = require('sharp');
        let sharpInstance = sharp(imagen);
        
        // Redimensionar si se especifican width o height
        if (width || height) {
          sharpInstance = sharpInstance.resize({
            width: width ? parseInt(width) : null,
            height: height ? parseInt(height) : null,
            fit: 'inside',
            withoutEnlargement: true
          });
        }
        
        // Convertir a WebP con calidad optimizada
        const webpQuality = Math.max(1, Math.min(100, parseInt(quality) || 80));
        const webpImage = await sharpInstance
          .webp({ quality: webpQuality })
          .toBuffer();
        
        // Configurar headers para la imagen
        const headers = {
          'Content-Type': 'image/webp',
          'ETag': etag,
          'Cache-Control': 'public, max-age=86400' // 1 día
        };
        
        // Guardar respuesta en caché
        cacheService.productos.set(cacheKey, {
          headers,
          data: webpImage
        }, 3600); // Caché por 1 hora
        
        // Establecer headers
        Object.entries(headers).forEach(([key, value]) => {
          res.set(key, value);
        });
        
        return res.send(webpImage);
        
      } catch (error) {
        if (error.message === 'El producto no tiene una imagen') {
          return res.status(204).end();
        }
        throw error;
      }
    } catch (error) {
      console.error('Error al obtener imagen:', error);
      return res.status(error.message === 'Producto no encontrado' ? 404 : 500).json({ 
        success: false, 
        message: error.message 
      });
    }
}

// Controlador optimizado para obtener imagen en formato base64
async function getImagenBase64(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el producto existe con consulta ligera
      const productoActual = await productoLogic.obtenerPorIdLigero(id);
      if (!productoActual) {
          return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      // Verificar permisos de sección
      const userSeccion = req.user ? req.user.secciones : null;
      if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
          return res.status(403).json({ 
              error: 'No tiene permisos para ver productos de esta categoría' 
          });
      }
      
      try {
        // Intentar obtener la imagen en formato base64
        const base64Image = await productoLogic.getImagenBase64(id);
        
        // Configurar caché para la respuesta
        res.set('Cache-Control', 'private, max-age=3600'); // 1 hora
        
        // Devolver la imagen en formato JSON con el base64
        return res.status(200).json({ 
          success: true, 
          image: base64Image 
        });
        
      } catch (error) {
        // Si el error es específicamente que el producto no tiene imagen, 
        // devolvemos un estado 204 (No Content) en lugar de un error
        if (error.message === 'El producto no tiene una imagen') {
          return res.status(204).json({ 
            success: false, 
            message: 'El producto no tiene una imagen' 
          });
        }
        
        // Para otros errores, seguimos lanzando la excepción
        throw error;
      }
    } catch (error) {
      console.error('Error al obtener imagen base64 del producto:', error);
      return res.status(error.message === 'Producto no encontrado' ? 404 : 500).json({ 
        success: false, 
        message: error.message 
      });
    }
}
  
// Controlador optimizado para eliminar imagen
async function deleteImagen(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el producto existe (versión ligera)
      const productoActual = await productoLogic.obtenerPorIdLigero(id);
      if (!productoActual) {
          return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      // Verificar permisos de sección
      const userSeccion = req.user ? req.user.secciones : null;
      if (userSeccion && userSeccion !== 'ambos' && productoActual.categoria !== userSeccion) {
          return res.status(403).json({ 
              error: 'No tiene permisos para modificar productos de esta categoría' 
          });
      }
      
      const resultado = await productoLogic.deleteImagen(id);
      
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al eliminar imagen del producto:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
}

// Controlador optimizado para calcular precio total de un combo
async function calcularPrecioCombo(req, res) {
    try {
        const { id } = req.params;
        
        // Verificar si el producto existe
        const producto = await productoLogic.obtenerPorId(id);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        if (!producto.esCombo) {
            return res.status(400).json({ error: 'El producto no es un combo' });
        }
        
        // Verificar permisos de sección
        const userSeccion = req.user ? req.user.secciones : null;
        if (userSeccion && userSeccion !== 'ambos' && producto.categoria !== userSeccion) {
            return res.status(403).json({ 
                error: 'No tiene permisos para acceder a productos de esta categoría' 
            });
        }
        
        const precioTotal = await productoLogic.calcularPrecioCombo(id);
        
        res.json({
            success: true,
            producto: producto.nombre,
            precioAsignado: producto.precio,
            precioCalculado: precioTotal
        });
    } catch (error) {
        console.error('Error al calcular precio del combo:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
}

// Exportar todas las funciones del controlador
module.exports = {
    obtenerTodos,
    obtenerPorId,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    venderProducto,
    cancelarVenta,
    uploadImagen,
    getImagen, 
    deleteImagen,
    uploadImagenBase64,
    getImagenBase64,
    calcularPrecioCombo
};