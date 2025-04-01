// src/controllers/downloadController.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { Pedido } = require('../models/pedidoSchema');
const Cliente = require('../models/clienteSchema');
const pdfService = require('../services/pdfService');

/**
 * Generar y descargar un remito en formato PDF
 */
const downloadRemito = async (req, res) => {
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
        select: 'nombre email usuario apellido'
      })
      .populate({
        path: 'productos.productoId',
        select: 'nombre precio descripcion categoria esCombo itemsCombo'
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
    
    // Validar y formatear productos
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
          
        // Información sobre si es combo
        const esCombo = item.productoId && typeof item.productoId === 'object' 
          ? !!item.productoId.esCombo
          : false;
          
        return {
          nombre,
          cantidad: item.cantidad || 0,
          precio,
          productoId: item.productoId, // Pasar el objeto completo para acceder a itemsCombo
          esCombo
        };
      });
    }
    
    // MODIFICACIÓN IMPORTANTE: Crear un objeto con TODA la información necesaria
    const pedidoData = {
      _id: pedido._id.toString(),
      numero: pedido.nPedido,
      servicio: pedido.servicio,
      seccionDelServicio: pedido.seccionDelServicio,
      fecha: pedido.fecha,
      // Incluir el objeto cliente completo
      cliente: pedido.cliente
    };
    
    // Log para verificar que la estructura es correcta
    console.log('Datos del pedido enviados al servicio PDF:', {
      id: pedidoData._id,
      numero: pedidoData.numero,
      cliente: pedidoData.cliente ? 'Incluido' : 'No incluido',
      productos: productos.length
    });
    
    // Si el cliente tiene información anidada, mostrarla para depuración
    if (pedidoData.cliente) {
      console.log('Información de cliente:', {
        nombreCliente: pedidoData.cliente.nombreCliente,
        nombreSubServicio: pedidoData.cliente.nombreSubServicio,
        nombreSubUbicacion: pedidoData.cliente.nombreSubUbicacion
      });
    }
    
    // Usar el servicio de PDF con datos completos
    const pdfBuffer = await pdfService.generarRemitoPDF(pedidoData, null, productos);
    
    // Configurar headers y enviar respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=remito_${pedido.nPedido || pedidoId}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
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
const downloadExcel = async (req, res) => {
  // Código existente sin cambios...
};

/**
 * Generar y descargar un reporte mensual en formato PDF
 */
const downloadReporteMensual = async (req, res) => {
  // Código existente sin cambios...
};

// Export all functions
module.exports = {
  downloadRemito,
  downloadExcel,
  downloadReporteMensual
};