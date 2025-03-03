// src/controllers/productoController.js
const productoLogic = require('../logic/productoLogic');

async function obtenerTodos(req, res) {
    try {
        const productos = await productoLogic.obtenerTodos();
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
        if (req.body.stock < 0) {
            return res.status(400).json({ error: 'El stock no puede ser negativo' });
        }

        const nuevoProducto = await productoLogic.crearProducto(req.body);
        res.status(201).json(nuevoProducto);
    } catch (error) {
        console.error('Error en crearProducto:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error al crear el producto' });
    }
}

async function actualizarProducto(req, res) {
    try {
        // Validaciones adicionales
        if (req.body.precio !== undefined && req.body.precio < 0) {
            return res.status(400).json({ error: 'El precio no puede ser negativo' });
        }
        if (req.body.stock !== undefined && req.body.stock < 0) {
            return res.status(400).json({ error: 'El stock no puede ser negativo' });
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
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
}

async function eliminarProducto(req, res) {
    try {
        const producto = await productoLogic.eliminarProducto(req.params.id);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error en eliminarProducto:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
}

async function venderProducto(req, res) {
    try {
        const producto = await productoLogic.venderProducto(req.params.id);
        if (!producto) {
            return res.status(400).json({ error: 'Stock insuficiente o producto no encontrado' });
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
        res.status(500).json({ error: 'Error al procesar la venta' });
    }
}

async function cancelarVenta(req, res) {
    try {
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
      
      const resultado = await productoLogic.updateImagen(id, req.file.buffer);
      
      return res.status(200).json(resultado);
    } catch (error) {
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
      
      const imagen = await productologic.getImagen(id);
      
      // Configurar los headers para la imagen
      res.set('Content-Type', 'image/jpeg'); // Ajustar según el tipo de imagen
      return res.send(imagen);
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
  
  // Controlador para eliminar una imagen
async function deleteImagen(req, res) {
    try {
      const { id } = req.params;
      
      const resultado = await productologic.deleteImagen(id);
      
      return res.status(200).json(resultado);
    } catch (error) {
      return res.status(500).json({ 
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
    deleteImagen
};