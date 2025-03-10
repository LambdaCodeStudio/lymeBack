// src/controllers/productoController.js
const productoLogic = require('../logic/productoLogic');

async function obtenerTodos(req, res) {
    try {
        // Obtener sección del usuario desde el token de autenticación
        const userSeccion = req.user ? req.user.secciones : null;
        
        const productos = await productoLogic.obtenerProductosPorSeccion(userSeccion);
        res.json(productos);
    } catch (error) {
        console.error('Error en obtenerTodos:', error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
}

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
        res.status(500).json({ error: 'Error al obtener el producto' });
    }
}

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
      
      const resultado = await productoLogic.updateImagen(id, req.file.buffer);
      
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al subir imagen del producto:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
}

// Controlador para subir imagen en formato base64
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
  
// Controlador para obtener una imagen
async function getImagen(req, res) {
    try {
      const { id } = req.params;
      const { quality = 80, width, height } = req.query; // Parámetros opcionales
      
      // Verificar si el producto existe y pertenece a la sección del usuario
      const productoActual = await productoLogic.obtenerPorId(id);
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
      
      // Validar que la calidad esté entre 1 y 100
      const webpQuality = Math.max(1, Math.min(100, parseInt(quality) || 80));
      
      try {
        // Intentar obtener la imagen, capturando específicamente el error de "no tiene imagen"
        const imagen = await productoLogic.getImagen(id);
        
        // Usar sharp para convertir la imagen a formato WebP
        const sharp = require('sharp');
        let sharpInstance = sharp(imagen);
        
        // Redimensionar si se especifican width o height
        if (width || height) {
          sharpInstance = sharpInstance.resize({
            width: width ? parseInt(width) : null,
            height: height ? parseInt(height) : null,
            fit: 'inside', // Mantiene la relación de aspecto
            withoutEnlargement: true // No aumenta el tamaño si la imagen es más pequeña
          });
        }
        
        // Convertir a WebP con la calidad especificada
        const webpImage = await sharpInstance
          .webp({ quality: webpQuality })
          .toBuffer();
        
        // Configurar los headers para la imagen WebP
        res.set('Content-Type', 'image/webp');
        // Agregar cache-control para mejor rendimiento
        res.set('Cache-Control', 'public, max-age=31536000'); // 1 año
        return res.send(webpImage);
        
      } catch (error) {
        // Si el error es específicamente que el producto no tiene imagen, 
        // devolvemos un estado 204 (No Content) en lugar de un error
        if (error.message === 'El producto no tiene una imagen') {
          return res.status(204).end();
        }
        
        // Para otros errores, seguimos lanzando la excepción
        throw error;
      }
    } catch (error) {
      console.error('Error al obtener imagen del producto:', error);
      return res.status(error.message === 'Producto no encontrado' ? 404 : 500).json({ 
        success: false, 
        message: error.message 
      });
    }
}

// Controlador para obtener imagen en formato base64
async function getImagenBase64(req, res) {
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
              error: 'No tiene permisos para ver productos de esta categoría' 
          });
      }
      
      try {
        // Intentar obtener la imagen en formato base64
        const base64Image = await productoLogic.getImagenBase64(id);
        
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
  
// Controlador para eliminar una imagen
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

// Nuevo controlador para calcular precio total de un combo
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