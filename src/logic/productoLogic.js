// src/logic/productoLogic.js
const Producto = require('../models/productoSchema');

async function obtenerTodos() {
    return await Producto.find();
}

async function obtenerPorId(id) {
    return await Producto.findById(id);
}

async function crearProducto(datos) {
    const producto = new Producto(datos);
    return await producto.save();
}

async function actualizarProducto(id, datos) {
    return await Producto.findByIdAndUpdate(id, datos, { new: true, runValidators: true });
}

async function eliminarProducto(id) {
    return await Producto.findByIdAndDelete(id);
}

async function venderProducto(id) {
    const producto = await Producto.findById(id);
    if (!producto || producto.stock <= 0) {
        return null;
    }
    
    producto.stock -= 1;
    producto.vendidos += 1;
    return await producto.save();
}

async function cancelarVenta(id) {
    const producto = await Producto.findById(id);
    if (!producto || producto.vendidos <= 0) {
        return null;
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
    // Nuevos métodos para base64
    updateImagenBase64,
    getImagenBase64
};