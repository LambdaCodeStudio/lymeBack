// src/controllers/downloadController.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { Pedido } = require('../models/pedidoSchema'); // Correctly import Pedido from the exported object
const Cliente = require('../models/clienteSchema');
const pdfService = require('../services/pdfService'); // Import the PDF service

// Improved debugging function with more details
const debugPedidoProductos = (pedido) => {
  console.log('===== DEBUG PEDIDO PRODUCTOS =====');
  console.log(`Pedido ID: ${pedido._id}, Num: ${pedido.nPedido || 'Sin número'}`);
  console.log(`Total productos en pedido: ${pedido.productos?.length || 0}`);
  
  if (pedido.productos && Array.isArray(pedido.productos)) {
    pedido.productos.forEach((item, index) => {
      console.log(`\nProducto #${index + 1}:`);
      console.log(`- Raw productoId: ${typeof item.productoId === 'object' ? 'Object' : (item.productoId || 'Undefined')}`);
      
      if (item.productoId && typeof item.productoId === 'object') {
        console.log(`- ID: ${item.productoId._id || 'Sin ID'}`);
        console.log(`- Nombre: ${item.productoId.nombre || 'Sin nombre'}`);
        console.log(`- Precio: ${item.productoId.precio || 0}`);
      } else {
        console.log('- Producto no poblado correctamente');
      }
      
      console.log(`- Cantidad: ${item.cantidad || 0}`);
    });
  } else {
    console.log('No hay productos en este pedido o el array no existe');
  }
  console.log('===== FIN DEBUG PEDIDO PRODUCTOS =====');
};

/**
 * Generar y descargar un remito en formato PDF
 */
exports.downloadRemito = async (req, res) => {
  try {
    const pedidoId = req.params.id;
    console.log(`\n\nGENERANDO REMITO: ${pedidoId}`);
    
    if (!pedidoId || !mongoose.Types.ObjectId.isValid(pedidoId)) {
      console.error('ID de pedido inválido:', pedidoId);
      return res.status(400).json({ mensaje: 'ID de pedido inválido' });
    }
    
    // Buscar el pedido con una población completa y explícita
    const pedido = await Pedido.findById(pedidoId)
      .populate({
        path: 'userId',
        select: 'nombre email'
      })
      .populate({
        path: 'productos.productoId',
        select: 'nombre precio descripcion categoria'
      });
      
    console.log('Pedido encontrado:', pedido ? 'Sí' : 'No');
    
    if (!pedido) {
      console.error('Pedido no encontrado:', pedidoId);
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }
    
    // Verificar si el pedido tiene la estructura esperada
    if (!pedido.productos || !Array.isArray(pedido.productos)) {
      console.error('Pedido sin productos o estructura inválida');
      return res.status(400).json({ mensaje: 'Pedido sin productos o estructura inválida' });
    }
    
    // Imprimir información de depuración
    debugPedidoProductos(pedido);
    
    // Obtener información adicional del cliente
    let cliente = { nombre: 'Cliente no especificado', email: '', direccion: '', telefono: '' };
    
    try {
      if (pedido.userId) {
        const clienteData = await Cliente.findOne({ userId: pedido.userId._id });
        if (clienteData) {
          cliente = {
            nombre: pedido.userId.nombre || 'Sin nombre',
            email: pedido.userId.email || '',
            direccion: clienteData.direccion || '',
            telefono: clienteData.telefono || ''
          };
        }
      }
    } catch (clienteError) {
      console.error('Error al obtener datos del cliente:', clienteError);
      // Continuamos con la información por defecto del cliente
    }
    
    // Validar y formatear productos con información de precio
    let productos = [];
    
    if (pedido.productos && Array.isArray(pedido.productos)) {
      productos = pedido.productos.map(item => {
        // Comprobar si el producto existe y está poblado correctamente
        const nombre = item.productoId && typeof item.productoId === 'object' && item.productoId.nombre 
          ? item.productoId.nombre 
          : 'Producto no disponible';
          
        const precio = item.productoId && typeof item.productoId === 'object' && item.productoId.precio
          ? item.productoId.precio
          : 0;
          
        return {
          nombre,
          cantidad: item.cantidad || 0,
          precio
        };
      });
    }
    
    // Si no hay productos, agregar un producto de muestra para debugging
    if (productos.length === 0) {
      console.warn('No se encontraron productos en el pedido');
      productos.push({
        nombre: 'No se encontraron productos en este pedido',
        cantidad: 0,
        precio: 0
      });
    }
    
    // Log de productos formateados para debugging
    console.log("\nProductos formateados para PDF:");
    productos.forEach((p, i) => {
      console.log(`- Producto ${i+1}: "${p.nombre}" (Cantidad: ${p.cantidad}, Precio: $${p.precio}, Subtotal: $${p.precio * p.cantidad})`);
    });
    
    // Calcular total general
    const totalGeneral = productos.reduce((sum, prod) => sum + (prod.precio * prod.cantidad), 0);
    console.log(`- TOTAL GENERAL: $${totalGeneral}`);
    
    try {
      // Log para debugging
      console.log('Preparando generación de PDF para pedido:', {
        id: pedido._id.toString(),
        numero: pedido.nPedido,
        productos: productos.length
      });
    
      // Crear un objeto simple para pasar al generador de PDF
      const pedidoData = {
        _id: pedido._id.toString(),
        numero: pedido.nPedido,
        servicio: pedido.servicio,
        seccionDelServicio: pedido.seccionDelServicio,
        fecha: pedido.fecha
      };
      
      // Usar el servicio de PDF con datos simplificados
      const pdfBuffer = await pdfService.generarRemitoPDF(pedidoData, cliente, productos);
      
      // Configurar headers y enviar respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=remito_${pedido.nPedido || pedidoId}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('Error específico al generar PDF:', pdfError);
      return res.status(500).json({ 
        mensaje: 'Error al generar el PDF', 
        error: pdfError.message,
        stack: process.env.NODE_ENV === 'development' ? pdfError.stack : undefined
      });
    }
    
  } catch (error) {
    console.error('Error general al generar remito PDF:', error);
    res.status(500).json({ 
      mensaje: 'Error al generar el remito', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Generar y descargar un reporte Excel de pedidos por rango de fechas
 */
exports.downloadExcel = async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ mensaje: 'Se requieren las fechas de inicio y fin' });
    }
    
    const fechaInicio = new Date(from);
    const fechaFin = new Date(to);
    
    // Validar fechas
    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
      return res.status(400).json({ mensaje: 'Formato de fecha inválido' });
    }
    
    // Asegurar que la fecha de fin sea al final del día
    fechaFin.setHours(23, 59, 59, 999);
    
    // Obtener pedidos en el rango de fechas
    const pedidos = await Pedido.find({
      fecha: { $gte: fechaInicio, $lte: fechaFin }
    })
    .populate('userId', 'nombre email')
    .populate('productos.productoId')
    .sort({ fecha: 1 });
    
    if (pedidos.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron pedidos en el rango de fechas especificado' });
    }
    
    // Usar el servicio de Excel
    const excelService = require('../services/excelService');
    const excelBuffer = await excelService.generarReporteExcel(pedidos, fechaInicio, fechaFin);
    
    // Formatear fechas para el nombre del archivo
    const fromStr = fechaInicio.toISOString().split('T')[0];
    const toStr = fechaFin.toISOString().split('T')[0];
    
    // Configurar headers y enviar respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${fromStr}_${toStr}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error al generar Excel:', error);
    res.status(500).json({ 
      mensaje: 'Error al generar el reporte Excel', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Export both functions
module.exports = {
  downloadExcel: exports.downloadExcel,
  downloadRemito: exports.downloadRemito
};