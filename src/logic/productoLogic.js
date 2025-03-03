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
    getImagen
};