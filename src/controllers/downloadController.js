// src/controllers/downloadController.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { Pedido } = require('../models/pedidoSchema'); // Correctamente importar Pedido desde el objeto exportado
const Cliente = require('../models/clienteSchema');
const pdfService = require('../services/pdfService'); // Importar el servicio PDF

// Función de depuración mejorada con más detalles
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
        console.log(`- Es Combo: ${item.productoId.esCombo ? 'Sí' : 'No'}`);
        
        if (item.productoId.esCombo && Array.isArray(item.productoId.itemsCombo)) {
          console.log(`  - Componentes del combo (${item.productoId.itemsCombo.length}):`);
          item.productoId.itemsCombo.forEach((comp, i) => {
            console.log(`    - Componente #${i+1}: ID=${comp.productoId}, Cantidad=${comp.cantidad}`);
          });
        }
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
const downloadRemito = async (req, res) => {
  try {
    const pedidoId = req.params.id;
    console.log(`\n\nGENERANDO REMITO: ${pedidoId}`);
    
    if (!pedidoId || !mongoose.Types.ObjectId.isValid(pedidoId)) {
      console.error('ID de pedido inválido:', pedidoId);
      return res.status(400).json({ mensaje: 'ID de pedido inválido' });
    }
    
    // Buscar el pedido con una población completa y explícita
    // Añadimos itemsCombo a la selección para los combos
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
    // Ahora también incluimos información sobre combos
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
    
    // Si no hay productos, agregar un producto de muestra para debugging
    if (productos.length === 0) {
      console.warn('No se encontraron productos en el pedido');
      productos.push({
        nombre: 'No se encontraron productos en este pedido',
        cantidad: 0,
        precio: 0,
        esCombo: false
      });
    }
    
    // Log de productos formateados para debugging
    console.log("\nProductos formateados para PDF:");
    productos.forEach((p, i) => {
      console.log(`- Producto ${i+1}: "${p.nombre}" (Cantidad: ${p.cantidad}, Precio: $${p.precio}, Es combo: ${p.esCombo})`);
      
      // Si es combo, mostrar sus componentes
      if (p.esCombo && p.productoId && p.productoId.itemsCombo) {
        p.productoId.itemsCombo.forEach((comp, j) => {
          console.log(`  - Componente ${j+1}: ID=${comp.productoId}, Cantidad=${comp.cantidad}`);
        });
      }
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
      
      // Usar el servicio de PDF con datos completos
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
const downloadExcel = async (req, res) => {
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

/**
 * Generar y descargar un reporte mensual en formato PDF
 */
const downloadReporteMensual = async (req, res) => {
  try {
    const { month, year } = req.params;
    
    // Validar parámetros
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ mensaje: 'Mes o año inválidos' });
    }
    
    // Calcular fechas de inicio y fin del mes
    const fechaInicio = new Date(yearNum, monthNum - 1, 1); // Mes en JavaScript es 0-indexado
    const fechaFin = new Date(yearNum, monthNum, 0); // Último día del mes
    fechaFin.setHours(23, 59, 59, 999);
    
    console.log(`Generando reporte mensual: ${monthNum}/${yearNum}`);
    console.log(`Período: ${fechaInicio.toISOString()} a ${fechaFin.toISOString()}`);
    
    // Obtener pedidos en el rango de fechas
    const pedidos = await Pedido.find({
      fecha: { $gte: fechaInicio, $lte: fechaFin },
      estado: 'aprobado' // Considerar solo pedidos aprobados
    })
    .populate('userId', 'nombre email')
    .populate('productos.productoId')
    .sort({ fecha: 1 });
    
    if (pedidos.length === 0) {
      return res.status(404).json({ 
        mensaje: 'No se encontraron pedidos aprobados para el período especificado' 
      });
    }
    
    // Crear un reporte PDF mensual usando PDFKit
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Reporte Mensual - ${monthNum}/${yearNum}`,
        Author: 'Lyme Depósito',
      }
    });
    
    // Configurar respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_mensual_${monthNum}_${yearNum}.pdf`);
    
    // Pipe PDF a respuesta
    doc.pipe(res);
    
    // Obtener la ruta al logo de la empresa
    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(process.cwd(), 'public', 'lyme.png');
    
    // Agregar logo si existe
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 50, { width: 150 });
      }
    } catch (logoError) {
      console.error('Error al agregar logo:', logoError);
    }
    
    // Título del reporte
    const nombresMeses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    doc.fontSize(24).font('Helvetica-Bold').text('Lyme Depósito', { align: 'center' });
    doc.fontSize(20).font('Helvetica-Bold')
       .text(`Reporte Mensual: ${nombresMeses[monthNum-1]} ${yearNum}`, { align: 'center' });
    doc.moveDown();
    
    // Resumen de pedidos
    doc.fontSize(14).font('Helvetica-Bold').text('Resumen de Pedidos', { underline: true });
    doc.fontSize(12).font('Helvetica');
    doc.text(`Período: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}`);
    doc.text(`Total de pedidos: ${pedidos.length}`);
    
    // Agrupar pedidos por servicio
    const pedidosPorServicio = pedidos.reduce((grupos, pedido) => {
      const servicio = pedido.servicio || 'Sin servicio';
      if (!grupos[servicio]) grupos[servicio] = [];
      grupos[servicio].push(pedido);
      return grupos;
    }, {});
    
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Pedidos por Servicio', { underline: true });
    doc.fontSize(12).font('Helvetica');
    
    // Listar servicios
    Object.keys(pedidosPorServicio).forEach(servicio => {
      const totalPedidosServicio = pedidosPorServicio[servicio].length;
      doc.text(`${servicio}: ${totalPedidosServicio} pedidos`);
    });
    
    doc.moveDown();
    
    // Productos más solicitados
    // Primero, agregar todos los productos de todos los pedidos
    const contadorProductos = {};
    
    pedidos.forEach(pedido => {
      if (pedido.productos && Array.isArray(pedido.productos)) {
        pedido.productos.forEach(item => {
          if (item.productoId && typeof item.productoId === 'object') {
            const nombre = item.productoId.nombre || 'Producto sin nombre';
            const cantidad = item.cantidad || 0;
            
            if (!contadorProductos[nombre]) {
              contadorProductos[nombre] = 0;
            }
            contadorProductos[nombre] += cantidad;
          }
        });
      }
    });
    
    // Convertir a array y ordenar por cantidad
    const productosOrdenados = Object.entries(contadorProductos)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
    
    // Mostrar los 10 productos más solicitados
    doc.fontSize(14).font('Helvetica-Bold').text('Productos Más Solicitados', { underline: true });
    doc.fontSize(12).font('Helvetica');
    
    const topProductos = productosOrdenados.slice(0, 10);
    
    // Crear tabla de productos
    const inicioTabla = doc.y + 20;
    const anchoColumna1 = 350;
    const anchoColumna2 = 100;
    
    // Cabecera de tabla
    doc.fillColor('#3498db')
       .rect(50, inicioTabla, anchoColumna1 + anchoColumna2, 30)
       .fill();
    
    doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold');
    doc.text('Producto', 60, inicioTabla + 10);
    doc.text('Cantidad', 60 + anchoColumna1, inicioTabla + 10);
    
    // Filas de tabla
    let y = inicioTabla + 30;
    doc.fillColor('#000000').font('Helvetica');
    
    topProductos.forEach((producto, index) => {
      // Alternar colores de fondo
      if (index % 2 === 0) {
        doc.fillColor('#F5F5F5')
           .rect(50, y, anchoColumna1 + anchoColumna2, 25)
           .fill();
      }
      
      doc.fillColor('#000000');
      doc.text(producto.nombre, 60, y + 7);
      doc.text(producto.cantidad.toString(), 60 + anchoColumna1, y + 7);
      
      y += 25;
    });
    
    // Agregar pie de página
    const fechaGeneracion = new Date().toLocaleDateString();
    doc.fontSize(10).text(
      `Reporte generado el ${fechaGeneracion}`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );
    
    // Finalizar documento
    doc.end();
    
  } catch (error) {
    console.error('Error al generar reporte mensual:', error);
    res.status(500).json({ 
      mensaje: 'Error al generar el reporte mensual', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Export all functions
module.exports = {
  downloadRemito,
  downloadExcel,
  downloadReporteMensual
};