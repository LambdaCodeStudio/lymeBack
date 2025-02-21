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

module.exports = {
    obtenerTodos,
    obtenerPorId,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    venderProducto,
    cancelarVenta
};