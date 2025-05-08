// src/controllers/downloadController.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { Pedido } = require('../models/pedidoSchema');
const Cliente = require('../models/clienteSchema');
const fs = require('fs');
const path = require('path');
const { generarReporteExcel, generarReporteMensual } = require('../services/excelService');
const { generarRemitoPDF } = require('../services/pdfService');

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
      path: 'supervisorId',
      select: 'usuario nombre email apellido'
    }) 
    .populate({
      path: 'productos.productoId',
      select: 'nombre precio descripcion categoria esCombo itemsCombo',
      populate: {
        path: 'itemsCombo.productoId',
        select: 'nombre'
      }
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
          : item.nombre || 'Producto no disponible';
          
        const precio = item.precio || 
          (item.productoId && typeof item.productoId === 'object' && item.productoId.precio)
          ? item.productoId.precio
          : 0;
          
        // Información sobre si es combo
        const esCombo = item.esCombo || 
          (item.productoId && typeof item.productoId === 'object' 
          ? !!item.productoId.esCombo
          : false);
          
        // Comprobamos si el combo está personalizado
        const personalizado = !!item.personalizado;
        
        // Creamos un objeto base para el producto
        const productoObj = {
          nombre,
          cantidad: item.cantidad || 0,
          precio,
          esCombo,
          personalizado
        };
        
        // Si es un combo personalizado, incluimos los comboItems personalizados
        if (esCombo && personalizado && item.comboItems && Array.isArray(item.comboItems)) {
          productoObj.comboItems = item.comboItems.map(comboItem => ({
            nombre: comboItem.nombre || 'Componente sin nombre',
            cantidad: comboItem.cantidad || 0,
            precio: comboItem.precio || 0
          }));
        } 
        // Si no está personalizado, usamos la estructura original
        else if (esCombo) {
          productoObj.productoId = item.productoId; // Pasar el objeto completo para acceder a itemsCombo
        }
        
        return productoObj;
      });
    }
    
    // Log para depurar la estructura de productos
    console.log('PRODUCTOS PROCESADOS PARA PDF:');
    productos.forEach((p, idx) => {
      console.log(`Producto #${idx+1}:`, {
        nombre: p.nombre,
        esCombo: p.esCombo,
        personalizado: p.personalizado,
        comboItems: p.personalizado ? `${p.comboItems?.length || 0} items` : 'N/A'
      });
    });
    
    // Crear estructura de datos para el PDF
    const pedidoData = {
      _id: pedido._id.toString(),
      numero: pedido.nPedido,
      servicio: pedido.servicio,
      seccionDelServicio: pedido.seccionDelServicio,
      fecha: pedido.fecha,
      // Incluir el objeto cliente completo
      cliente: pedido.cliente,
      // Pasar userId como objeto poblado o como ID
      userId: pedido.userId,
      // Detalle del pedido
      detalle: pedido.detalle || 'Sin detalle',
    };

    // Log para verificar que la estructura es correcta
    console.log('Datos del pedido enviados al servicio PDF:', {
      id: pedidoData._id,
      numero: pedidoData.numero,
      cliente: pedidoData.cliente ? 'Incluido' : 'No incluido',
      supervisor: pedidoData.supervisorId ? 'Incluido' : 'No incluido',
      productos: productos.length
    });
    
    // Usar el servicio de PDF importado
    const pdfBuffer = await generarRemitoPDF(pedidoData, null, productos);
    
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
  try {
    const { from, to, clienteId, productoId, supervisorId, subServicioId, subUbicacionId } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ mensaje: 'Se requieren las fechas de inicio y fin' });
    }
    
    // Preparar fechas para la consulta
    const fechaInicio = new Date(from);
    fechaInicio.setHours(0, 0, 0, 0);
    
    const fechaFin = new Date(to);
    fechaFin.setHours(23, 59, 59, 999);
    
    // Construir el filtro de consulta
    const query = {
      fecha: {
        $gte: fechaInicio,
        $lte: fechaFin
      }
    };
    
    // Añadir filtros adicionales si están presentes
    if (clienteId) {
      // Buscar por cliente como estructura anidada o por servicio tradicional
      query.$or = [
        { 'cliente.clienteId': clienteId },
        { clienteId: clienteId }
      ];
    }
    
    // Añadir filtro de subServicio si está presente
    if (subServicioId) {
      query['cliente.subServicioId'] = subServicioId;
    }
    
    // Añadir filtro de subUbicación si está presente
    if (subUbicacionId) {
      query['cliente.subUbicacionId'] = subUbicacionId;
    }
    
    if (supervisorId) {
      query.$or = query.$or || [];
      query.$or.push(
        { supervisorId: supervisorId },
        { 'supervisorId._id': supervisorId },
        { userId: supervisorId },
        { 'userId._id': supervisorId }
      );
    }
    
    if (productoId) {
      query['productos.productoId'] = productoId;
    }
    
    console.log('Ejecutando consulta con filtros:', JSON.stringify(query));
    
    // Ejecutar la consulta con población de datos relacionados
    const pedidos = await Pedido.find(query)
      .populate({
        path: 'productos.productoId',
        select: 'nombre precio categoria'
      })
      .populate({
        path: 'userId',
        select: 'nombre email usuario'
      })
      .sort({ fecha: -1 });
      
    console.log(`Generando Excel para ${pedidos.length} pedidos`);
    
    // Generar el Excel usando el servicio
    const excelBuffer = await generarReporteExcel(pedidos, fechaInicio, fechaFin);
    
    // Configurar headers y enviar respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${fechaInicio.toISOString().split('T')[0]}_${fechaFin.toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error al generar Excel:', error);
    res.status(500).json({ 
      mensaje: 'Error al generar el reporte Excel', 
      error: error.message
    });
  }
};

/**
 * Generar y descargar un reporte mensual en formato Excel
 */
const downloadReporteMensual = async (req, res) => {
  try {
    const { from, to, clienteId, subServicioId, subUbicacionId } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ mensaje: 'Se requieren las fechas de inicio y fin' });
    }
    
    // Preparar fechas para la consulta
    const fechaInicio = new Date(from);
    fechaInicio.setHours(0, 0, 0, 0);
    
    const fechaFin = new Date(to);
    fechaFin.setHours(23, 59, 59, 999);
    
    // Construir el filtro de consulta
    const query = {
      fecha: {
        $gte: fechaInicio,
        $lte: fechaFin
      }
    };
    
    // Añadir filtros adicionales si están presentes
    if (clienteId) {
      // Buscar por cliente como estructura anidada o por servicio tradicional
      query.$or = [
        { 'cliente.clienteId': clienteId },
        { clienteId: clienteId }
      ];
    }
    
    // Añadir filtro de subServicio si está presente
    if (subServicioId) {
      query['cliente.subServicioId'] = subServicioId;
    }
    
    // Añadir filtro de subUbicación si está presente
    if (subUbicacionId) {
      query['cliente.subUbicacionId'] = subUbicacionId;
    }
    
    console.log('Ejecutando consulta con filtros:', JSON.stringify(query));
    
    // Ejecutar la consulta con población adecuada
    const pedidos = await Pedido.find(query)
      .populate({
        path: 'productos.productoId',
        select: 'nombre precio categoria'
      })
      .populate({
        path: 'userId',
        select: 'nombre email usuario'
      })
      .sort({ fecha: -1 });
      
    console.log(`Generando reporte mensual para ${pedidos.length} pedidos`);
    
    // Generar el reporte mensual usando el servicio
    const excelBuffer = await generarReporteMensual(pedidos, fechaInicio, fechaFin, clienteId);
    
    // Configurar headers y enviar respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_mensual_${fechaInicio.toISOString().split('T')[0]}_${fechaFin.toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error al generar reporte mensual:', error);
    res.status(500).json({ 
      mensaje: 'Error al generar el reporte mensual', 
      error: error.message
    });
  }
};

module.exports = {
  downloadRemito,
  downloadExcel,
  downloadReporteMensual
};