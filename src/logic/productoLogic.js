// src/logic/productoLogic.js
const Producto = require('../models/productoSchema');
const mongoose = require('mongoose');

async function obtenerTodos(userSeccion = null) {
    let query = {};
    
    // Filtrar por sección del usuario si se proporciona
    if (userSeccion) {
        if (userSeccion !== 'ambos') {
            query.categoria = userSeccion;
        }
    }
    
    return await Producto.find(query).populate('itemsCombo.productoId');
}

async function obtenerPorId(id) {
    return await Producto.findById(id).populate('itemsCombo.productoId');
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
    return await producto.save();
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
    
    return await Producto.findByIdAndUpdate(id, datos, { new: true, runValidators: true });
}

async function eliminarProducto(id) { 
    // Verificar si hay combos que incluyen este producto
    const combosConProducto = await Producto.find({
        esCombo: true,
        'itemsCombo.productoId': mongoose.Types.ObjectId(id)
    });
    
    if (combosConProducto.length > 0) {
        const comboNames = combosConProducto.map(c => c.nombre).join(', ');
        throw new Error(`No se puede eliminar el producto porque está incluido en los siguientes combos: ${comboNames}`);
    }
    
    return await Producto.findByIdAndDelete(id);
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
        return await producto.save();
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
    return await producto.save();
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
        
        return { success: true, message: 'Imagen eliminada correctamente' };
    } catch (error) {
        throw error;
    }
}

// Nueva función para obtener productos filtrados por sección del usuario
async function obtenerProductosPorSeccion(seccion) {
    if (!seccion || seccion === 'ambos') {
        return await Producto.find().populate('itemsCombo.productoId');
    }
    
    return await Producto.find({ categoria: seccion }).populate('itemsCombo.productoId');
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
    calcularPrecioCombo
};