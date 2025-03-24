const productoLogic = require('../logic/productoLogic');
const Producto = require('../models/productoSchema');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Definir rutas base como constantes
// Ajusta la ruta para encontrar correctamente la carpeta public
const BASE_DIR = path.resolve(__dirname, '../..'); // Subir un nivel desde /controllers a la raíz del proyecto
const IMAGES_DIR = path.join(BASE_DIR, 'public', 'images', 'products');
const IMAGES_URL_PREFIX = '/images/products'; // URL relativa para el frontend

// Asegurar que el directorio existe al iniciar el controlador
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log(`Directorio de imágenes creado: ${IMAGES_DIR}`);
  }


// Implementar función de fallback para invalidar caché si no está disponible
const invalidarCachePorClave = function(key) {
    if (typeof productoLogic.invalidarCachePorClave === 'function') {
      // Usar la implementación original si existe
      return productoLogic.invalidarCachePorClave(key);
    } else {
      // Función de fallback
      console.log(`[Fallback] Invalidando caché para ${key}`);
      // Si existe una función general de invalidación de caché, usarla
      if (typeof productoLogic.invalidarCache === 'function') {
        productoLogic.invalidarCache();
      }
      return Promise.resolve(); // Devolver una promesa resuelta para mantener la compatibilidad con async/await
    }
  };

// Función mejorada para obtener productos con múltiples filtros
async function obtenerTodos(req, res) {
    try {
        // Paginación mejorada
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        // Ordenamiento
        const sortBy = req.query.sortBy || 'nombre';
        const sortDir = req.query.sortDir === 'desc' ? -1 : 1;
        
        // Filtros básicos
        const searchTerm = req.query.search || '';
        const category = req.query.category || '';
        const subcategory = req.query.subcategory || '';
        const marca = req.query.marca || '';
        const proveedor = req.query.proveedor || '';
        
        // Filtros avanzados
        const showLowStock = req.query.lowStock === 'true';
        const showNoStock = req.query.noStock === 'true';
        const threshold = parseInt(req.query.threshold) || 10;
        const precioMin = req.query.precioMin ? parseFloat(req.query.precioMin) : undefined;
        const precioMax = req.query.precioMax ? parseFloat(req.query.precioMax) : undefined;
        const estado = req.query.estado;
        const updatedAfter = req.query.updatedAfter;
        
        // AÑADIDO: Soporte para filtro de combos
        const esCombo = req.query.esCombo === 'true';
        
        // AÑADIDO: Soporte para búsqueda progresiva con regex
        const regex = req.query.regex || '';
        const regexFields = req.query.regexFields || '';
        const regexOptions = req.query.regexOptions || '';
        
        // Obtener sección del usuario desde el token de autenticación
        const userSeccion = req.user ? req.user.secciones : null;
        
        // Construir filtro base
        let query = {};
        
        // Priorizar filtros de stock sobre otros filtros
        if (showNoStock) {
            query.noStock = true;
        } else if (showLowStock) {
            query.lowStock = true;
            query.threshold = threshold;
        } else {
            // Filtros jerárquicos
            if (category && category !== 'all') {
                query.categoria = category;
            } else if (userSeccion && userSeccion !== 'ambos') {
                query.categoria = userSeccion;
            }
            
            if (subcategory && subcategory !== 'all') {
                query.subCategoria = subcategory;
            }
            
            if (marca && marca !== 'all') {
                query.marca = marca;
            }
            
            if (proveedor && proveedor !== 'all') {
                query.proveedor = proveedor;
            }
            
            // Filtro de precio
            if (precioMin !== undefined || precioMax !== undefined) {
                query.precioMin = precioMin;
                query.precioMax = precioMax;
            }
            
            // Filtro de estado
            if (estado && estado !== 'all') {
                query.estado = estado;
            }
            
            // Filtro de fecha de actualización
            if (updatedAfter) {
                query.updatedAfter = updatedAfter;
            }
            
            // CORREGIDO: Filtro de búsqueda por texto o regex
            if (regex) {
                query.regex = regex;
                if (regexFields) query.regexFields = regexFields;
                if (regexOptions) query.regexOptions = regexOptions;
            } else if (searchTerm) {
                query.texto = searchTerm;
            }
            
            // AÑADIDO: Filtro de combo
            if (esCombo) {
                query.esCombo = true;
            }
        }
        
        // Obtener productos con paginación y filtros
        const result = await productoLogic.obtenerProductosPaginados(
            query, 
            page, 
            limit, 
            userSeccion,
            sortBy,
            sortDir
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error en obtenerTodos:', error);
        res.status(500).json({ error: 'Error al obtener los productos', details: error.message });
    }
}

// Función para obtener un producto por ID
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
        
        res.json(producto);
    } catch (error) {
        console.error('Error en obtenerPorId:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: 'Error al obtener el producto', details: error.message });
    }
}

// Función mejorada para crear productos
async function crearProducto(req, res) {
    try {
        // Validaciones adicionales
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

// Función mejorada para actualizar productos
async function actualizarProducto(req, res) {
    try {
        // Validaciones adicionales
        if (req.body.precio !== undefined && req.body.precio < 0) {
            return res.status(400).json({ error: 'El precio no puede ser negativo' });
        }
        
        // Obtener producto actual para validar categoría
        const productoActual = await productoLogic.obtenerPorId(req.params.id);
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
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
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

// Función para eliminar productos
async function eliminarProducto(req, res) {
    try {
        // Verificar si el producto existe
        const productoActual = await productoLogic.obtenerPorId(req.params.id);
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
        
        const producto = await productoLogic.eliminarProducto(req.params.id);
        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error en eliminarProducto:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: error.message || 'Error al eliminar el producto' });
    }
}

// Función para vender un producto
async function venderProducto(req, res) {
    try {
        // Verificar si el producto existe y pertenece a la sección del usuario
        const productoActual = await productoLogic.obtenerPorId(req.params.id);
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

// Función para cancelar una venta
async function cancelarVenta(req, res) {
    try {
        // Verificar si el producto existe y pertenece a la sección del usuario
        const productoActual = await productoLogic.obtenerPorId(req.params.id);
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
            return res.status(404).json({ error: 'Producto no encontrado' });
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

// Función para subir imagen
async function uploadImagen(req, res) {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se ha proporcionado ninguna imagen' 
        });
      }
      
      // Verificar si el producto existe y pertenece a la sección del usuario
      const productoActual = await productoLogic.obtenerPorId(id);
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
      
      // Configurar rutas y nombres usando constantes
      const nombreArchivo = `${id}.webp`;
      const rutaArchivo = path.join(IMAGES_DIR, nombreArchivo);
      const imageUrl = `${IMAGES_URL_PREFIX}/${nombreArchivo}`;
      
      console.log(`Guardando imagen en: ${rutaArchivo}`);
      console.log(`URL relativa: ${imageUrl}`);
      
      // Procesar y guardar la imagen con Sharp
      try {
        await sharp(req.file.buffer)
          .webp({ quality: 80 }) 
          .toFile(rutaArchivo);
        
        // Verificar que la imagen se guardó correctamente
        if (!fs.existsSync(rutaArchivo)) {
          throw new Error('La imagen no se guardó correctamente');
        }
        
        // Actualizar el documento en MongoDB (solo guardar la URL, no la imagen)
        const resultado = await Producto.findByIdAndUpdate(
          id,
          { 
            $set: { 
              imagen: null, // No guardar imagen binaria
              imageUrl: imageUrl,
              hasImage: true, // Añadir un campo explícito que indique que tiene imagen
              imagenInfo: {
                mimetype: 'image/webp',
                rutaArchivo: rutaArchivo,
                tamano: fs.statSync(rutaArchivo).size,
                ultimaActualizacion: new Date()
              }
            }
          },
          { new: true }
        );
        
        // Invalidar caché para este producto usando la función de fallback
        await invalidarCachePorClave(`producto_${id}`);
        
        return res.status(200).json({
          success: true,
          message: 'Imagen actualizada correctamente',
          imageUrl: imageUrl
        });
      } catch (error) {
        console.error('Error al procesar imagen:', error);
        return res.status(500).json({ 
          success: false, 
          message: `Error al procesar imagen: ${error.message}` 
        });
      }
    } catch (error) {
      console.error('Error al subir imagen del producto:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

/**
 * Función getImagen actualizada para trabajar con imágenes externas
 * Redirecciona a la URL de la imagen en lugar de servirla desde MongoDB
 */
async function getImagen(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el producto existe
      const producto = await productoLogic.obtenerPorId(id);
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      
      // Verificar permisos de sección si es necesario
      const userSeccion = req.user ? req.user.secciones : null;
      if (userSeccion && userSeccion !== 'ambos' && producto.categoria !== userSeccion) {
        return res.status(403).json({ 
          error: 'No tiene permisos para ver productos de esta categoría' 
        });
      }
      
      // Verificar si el producto tiene URL de imagen
      if (!producto.imageUrl) {
        // Si no hay imagen, devolver 204 No Content
        return res.status(204).json({ 
          message: 'El producto no tiene imagen' 
        });
      }
      
      // Redirigir a la URL de la imagen
      return res.redirect(producto.imageUrl);
    } catch (error) {
      console.error('Error al procesar solicitud de imagen:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

// Función para eliminar imagen
async function deleteImagen(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el producto existe y pertenece a la sección del usuario
      const productoActual = await productoLogic.obtenerPorId(id);
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
      
      // Comprobar si tiene imageUrl
      if (productoActual.imageUrl) {
        // Intentar eliminar el archivo físico
        const imagePath = path.join(IMAGES_DIR, path.basename(productoActual.imageUrl));
        
        console.log(`Intentando eliminar imagen en: ${imagePath}`);
        
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log(`Imagen eliminada: ${imagePath}`);
        } else {
          console.log(`Advertencia: Imagen no encontrada en: ${imagePath}`);
        }
      }
      
      // Actualizar el documento para eliminar referencias a la imagen
      await Producto.findByIdAndUpdate(
        id,
        { 
          $set: { 
            imagen: null,
            imageUrl: null,
            hasImage: false, // Actualizar campo explícito
            imagenInfo: null
          }
        }
      );
      
      // Invalidar caché para este producto usando la función de fallback
      await invalidarCachePorClave(`producto_${id}`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Imagen eliminada correctamente' 
      });
    } catch (error) {
      console.error('Error al eliminar imagen del producto:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

// Función para calcular precio de combo
async function calcularPrecioCombo(req, res) {
    try {
        const { id } = req.params;
        
        // Verificar si el producto existe y es un combo
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

// Función para obtener estadísticas de stock bajo
async function getStockStats(req, res) {
    try {
      // Obtener el umbral desde query params, por defecto 10
      const threshold = parseInt(req.query.threshold) || 10;
      const userSeccion = req.user ? req.user.secciones : null;
      
      // Consultar productos con stock bajo
      const productosStockBajo = await productoLogic.obtenerProductosStockBajo(threshold, userSeccion);
      
      res.json({ 
          count: productosStockBajo.length,
          threshold
      });
    } catch (error) {
      console.error('Error al obtener estadísticas de stock:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas de stock' });
    }
}

// NUEVAS FUNCIONES

// Función para obtener productos por marca
async function obtenerProductosPorMarca(req, res) {
    try {
        const { marca } = req.params;
        const userSeccion = req.user ? req.user.secciones : null;
        
        const productos = await productoLogic.obtenerProductosPorMarca(marca, userSeccion);
        
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos por marca:', error);
        res.status(500).json({ error: 'Error al obtener productos por marca' });
    }
}

// Función para obtener productos por proveedor
async function obtenerProductosPorProveedor(req, res) {
    try {
        const { proveedor } = req.params;
        const userSeccion = req.user ? req.user.secciones : null;
        
        const productos = await productoLogic.obtenerProductosPorProveedor(proveedor, userSeccion);
        
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos por proveedor:', error);
        res.status(500).json({ error: 'Error al obtener productos por proveedor' });
    }
}

// Función para obtener productos por rango de precio
async function obtenerProductosPorRangoPrecio(req, res) {
    try {
        const { min, max } = req.query;
        const precioMin = parseFloat(min) || 0;
        const precioMax = parseFloat(max) || Number.MAX_SAFE_INTEGER;
        const userSeccion = req.user ? req.user.secciones : null;
        
        const productos = await productoLogic.obtenerProductosPorRangoPrecio(precioMin, precioMax, userSeccion);
        
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos por rango de precio:', error);
        res.status(500).json({ error: 'Error al obtener productos por rango de precio' });
    }
}

// Función para obtener productos con stock bajo
async function obtenerProductosStockBajo(req, res) {
    try {
        const threshold = req.query.threshold ? parseInt(req.query.threshold) : null;
        const userSeccion = req.user ? req.user.secciones : null;
        
        const productos = await productoLogic.obtenerProductosStockBajo(threshold, userSeccion);
        
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos con stock bajo:', error);
        res.status(500).json({ error: 'Error al obtener productos con stock bajo' });
    }
}

// Función para obtener productos sin stock
async function obtenerProductosSinStock(req, res) {
    try {
        const userSeccion = req.user ? req.user.secciones : null;
        
        const productos = await productoLogic.obtenerProductosSinStock(userSeccion);
        
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos sin stock:', error);
        res.status(500).json({ error: 'Error al obtener productos sin stock' });
    }
}

// Función para obtener productos más vendidos
async function obtenerProductosMasVendidos(req, res) {
    try {
        const limite = req.query.limite ? parseInt(req.query.limite) : 10;
        const userSeccion = req.user ? req.user.secciones : null;
        
        const productos = await productoLogic.obtenerProductosMasVendidos(limite, userSeccion);
        
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos más vendidos:', error);
        res.status(500).json({ error: 'Error al obtener productos más vendidos' });
    }
}

// Función para generar reporte de inventario
async function generarReporteInventario(req, res) {
    try {
        const userSeccion = req.user ? req.user.secciones : null;
        
        const reporte = await productoLogic.generarReporteInventario(userSeccion);
        
        res.json(reporte);
    } catch (error) {
        console.error('Error al generar reporte de inventario:', error);
        res.status(500).json({ error: 'Error al generar reporte de inventario' });
    }
}

// Función para obtener estadísticas por categoría
async function obtenerEstadisticasPorCategoria(req, res) {
    try {
        const estadisticas = await productoLogic.obtenerEstadisticasPorCategoria();
        
        res.json(estadisticas);
    } catch (error) {
        console.error('Error al obtener estadísticas por categoría:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas por categoría' });
    }
}

// Función para generar pronóstico de agotamiento
async function generarPronosticoAgotamiento(req, res) {
    try {
        const pronostico = await productoLogic.generarPronosticoAgotamiento();
        
        res.json(pronostico);
    } catch (error) {
        console.error('Error al generar pronóstico de agotamiento:', error);
        res.status(500).json({ error: 'Error al generar pronóstico de agotamiento' });
    }
}

// Función para exportar datos de productos
async function exportarDatosProductos(req, res) {
    try {
        const { formato = 'csv' } = req.query;
        const userSeccion = req.user ? req.user.secciones : null;
        
        // Construir filtros según permisos de usuario
        const filtros = {};
        if (userSeccion && userSeccion !== 'ambos') {
            filtros.categoria = userSeccion;
        }
        
        // Añadir filtros adicionales desde query params
        if (req.query.categoria) filtros.categoria = req.query.categoria;
        if (req.query.subCategoria) filtros.subCategoria = req.query.subCategoria;
        if (req.query.marca) filtros.marca = req.query.marca;
        if (req.query.stock === 'bajo') filtros.alertaStockBajo = true;
        if (req.query.stock === 'sin') filtros.stock = 0;
        
        const datos = await productoLogic.exportarDatosProductos(formato, filtros);
        
        // Preparar la respuesta según el formato solicitado
        if (formato === 'json') {
            return res.json(datos);
        }
        
        // Para formato CSV, convertir los datos
        const { Parser } = require('json2csv');
        const fields = Object.keys(datos[0] || {});
        const json2csv = new Parser({ fields });
        const csv = json2csv.parse(datos);
        
        // Configurar cabeceras para descarga
        res.header('Content-Type', 'text/csv');
        res.attachment(`productos_${new Date().toISOString().split('T')[0]}.csv`);
        
        return res.send(csv);
    } catch (error) {
        console.error('Error al exportar datos de productos:', error);
        res.status(500).json({ error: 'Error al exportar datos de productos' });
    }
}

// Función para actualizar estadísticas de productos
async function actualizarEstadisticasProductos(req, res) {
    try {
        // Verificar permisos (solo administradores)
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'supervisor_de_supervisores')) {
            return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
        }
        
        const resultado = await productoLogic.actualizarEstadisticasProductos();
        
        res.json({
            mensaje: 'Estadísticas de productos actualizadas correctamente',
            detalles: resultado
        });
    } catch (error) {
        console.error('Error al actualizar estadísticas de productos:', error);
        res.status(500).json({ error: 'Error al actualizar estadísticas de productos' });
    }
}

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
    calcularPrecioCombo,
    getStockStats,
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