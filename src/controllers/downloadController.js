// src/controllers/downloadController.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Pedido = require('../models/pedidoSchema');
const Cliente = require('../models/clienteSchema');

/**
 * Generar y descargar un remito en formato PDF
 */
exports.downloadRemito = async (req, res) => {
  try {
    const pedidoId = req.params.id;
    
    // Buscar el pedido y poblar datos relacionados
    const pedido = await Pedido.findById(pedidoId)
      .populate('userId', 'nombre email')
      .populate('productos.productoId');
    
    if (!pedido) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }
    
    // Obtener información adicional del cliente
    let cliente = null;
    if (pedido.userId) {
      const clienteData = await Cliente.findOne({ userId: pedido.userId._id });
      cliente = {
        nombre: pedido.userId.nombre || '',
        email: pedido.userId.email || '',
        direccion: clienteData ? clienteData.direccion || '' : '',
        telefono: clienteData ? clienteData.telefono || '' : ''
      };
    } else {
      cliente = { nombre: 'Cliente no especificado', email: '', direccion: '', telefono: '' };
    }
    
    // Formatear productos para el PDF
    const productos = pedido.productos.map(item => {
      return {
        nombre: item.productoId ? item.productoId.nombre : 'Producto no disponible',
        cantidad: item.cantidad || 0,
        precio: item.productoId ? item.productoId.precio : 0
      };
    });
    
    // Generar PDF
    const pdfBuffer = await generarRemitoPDF(pedido, cliente, productos);
    
    // Configurar headers y enviar respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=remito_${pedido.numero || pedidoId}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error al generar remito PDF:', error);
    res.status(500).json({ mensaje: 'Error al generar el remito', error: error.message });
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
    
    // Generar Excel
    const excelBuffer = await generarReporteExcel(pedidos, fechaInicio, fechaFin);
    
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
    res.status(500).json({ mensaje: 'Error al generar el reporte Excel', error: error.message });
  }
};

/**
 * Genera un PDF de remito con paginación automática
 * @param {Object} pedidoData - Datos del pedido
 * @param {Object} clienteData - Datos del cliente
 * @param {Array} productos - Lista de productos
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
const generarRemitoPDF = async (pedidoData, clienteData, productos) => {
  return new Promise((resolve, reject) => {
    try {
      // Configuración de documento
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Remito ${pedidoData.numero || ''}`,
          Author: 'Lyme Depósito',
        }
      });

      // Recolectar contenido en un buffer
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Constantes para paginación
      const PRODUCTOS_POR_PAGINA = 15; // Ajustar según se necesite
      const totalPaginas = Math.ceil(productos.length / PRODUCTOS_POR_PAGINA);
      let paginaActual = 1;

      // Función para agregar encabezado
      const agregarEncabezado = () => {
        // Título del documento
        doc.fontSize(24).font('Helvetica-Bold').text('Lyme Depósito', { align: 'center' });
        doc.fontSize(20).font('Helvetica-Bold').text('REMITO', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica');

        // Información del cliente
        doc.text(`${clienteData.nombre || ''}`, 50, 120);
        doc.text(`${clienteData.direccion || ''}`, 50, 140);
        doc.text(`${clienteData.email || ''}`, 50, 160);

        // Dirección de facturación
        doc.text('Dirección de facturación:', 300, 120);
        doc.text(`${clienteData.nombre || ''}`, 300, 140);
        doc.text(`${clienteData.direccion || ''}`, 300, 160);
        
        // Servicios
        doc.text(`Servicios: ${pedidoData.servicio || ''}`, 300, 180);

        // Información del pedido
        doc.text(`Número de pedido: ${pedidoData.numero || ''}`, 300, 200);
        
        const fecha = pedidoData.fecha ? new Date(pedidoData.fecha) : new Date();
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const fechaFormateada = `${meses[fecha.getMonth()]} ${fecha.getDate()}, ${fecha.getFullYear()}`;
        
        doc.text(`Fecha de pedido: ${fechaFormateada}`, 300, 220);

        // Agregar paginación
        doc.text(`Página ${paginaActual} de ${totalPaginas}`, 450, 50);

        // Cabecera de tabla
        doc.lineWidth(1);
        doc.rect(50, 250, 500, 30).fill('#000000');
        doc.fillColor('#FFFFFF').text('Producto', 60, 260);
        doc.text('Cantidad', 450, 260);
        doc.fillColor('#000000');
      };

      // Primera página
      agregarEncabezado();

      // Calcular posición Y de inicio de productos
      let y = 290;

      // Dibujar productos
      for (let i = 0; i < productos.length; i++) {
        // Verificar si necesitamos una nueva página
        if (i > 0 && i % PRODUCTOS_POR_PAGINA === 0) {
          paginaActual++;
          doc.addPage();
          agregarEncabezado();
          y = 290; // Reiniciar posición Y
        }

        // Alternar colores para filas
        if (i % 2 === 0) {
          doc.rect(50, y, 500, 30).fill('#F5F5F5');
        }

        // Dibujar datos del producto
        doc.text(productos[i].nombre, 60, y + 10);
        doc.text(productos[i].cantidad.toString(), 450, y + 10);

        // Incrementar posición Y
        y += 30;
      }

      // Finalizar documento
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Genera un archivo Excel con los datos de pedidos
 * @param {Array} pedidos - Lista de pedidos
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @returns {Promise<Buffer>} - Buffer del Excel generado
 */
const generarReporteExcel = async (pedidos, fechaInicio, fechaFin) => {
  const workbook = new ExcelJS.Workbook();
  
  // Añadir metadata
  workbook.creator = 'Lyme Depósito';
  workbook.lastModifiedBy = 'Sistema de Gestión';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Crear hoja de resumen
  const resumenSheet = workbook.addWorksheet('Resumen');
  
  // Configurar encabezados y formatos
  resumenSheet.columns = [
    { header: 'Período', key: 'periodo', width: 25 },
    { header: 'Total Pedidos', key: 'totalPedidos', width: 15 },
    { header: 'Total Productos', key: 'totalProductos', width: 18 },
    { header: 'Valor Total ($)', key: 'valorTotal', width: 16, style: { numFmt: '"$"#,##0.00' } }
  ];
  
  // Estilos de encabezado
  resumenSheet.getRow(1).font = { bold: true, size: 12 };
  resumenSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  resumenSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Calcular totales
  const totalPedidos = pedidos.length;
  let totalProductos = 0;
  let valorTotal = 0;
  
  pedidos.forEach(pedido => {
    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach(producto => {
        totalProductos += producto.cantidad || 0;
        const precio = producto.productoId && producto.productoId.precio ? producto.productoId.precio : 0;
        valorTotal += precio * (producto.cantidad || 0);
      });
    }
  });
  
  // Formatear fechas para mostrar en el informe
  const formatearFecha = (fecha) => {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };
  
  // Agregar fila de resumen
  const periodoTexto = `${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`;
  resumenSheet.addRow({
    periodo: periodoTexto,
    totalPedidos,
    totalProductos,
    valorTotal
  });
  
  // Crear hoja de pedidos detallados
  const pedidosSheet = workbook.addWorksheet('Pedidos');
  
  // Configurar columnas
  pedidosSheet.columns = [
    { header: 'Número', key: 'numero', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'Servicio', key: 'servicio', width: 25 },
    { header: 'Productos', key: 'productos', width: 10 },
    { header: 'Total ($)', key: 'total', width: 15, style: { numFmt: '"$"#,##0.00' } }
  ];
  
  // Estilos de encabezado
  pedidosSheet.getRow(1).font = { bold: true, size: 12 };
  pedidosSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  pedidosSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Añadir filas de pedidos
  pedidos.forEach(pedido => {
    const clienteNombre = pedido.userId && pedido.userId.nombre ? pedido.userId.nombre : 'N/A';
    const cantidadProductos = pedido.productos ? pedido.productos.length : 0;
    let totalPedido = 0;
    
    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach(producto => {
        const precio = producto.productoId && producto.productoId.precio ? producto.productoId.precio : 0;
        totalPedido += precio * (producto.cantidad || 0);
      });
    }
    
    pedidosSheet.addRow({
      numero: pedido.numero || 'S/N',
      fecha: pedido.fecha ? formatearFecha(new Date(pedido.fecha)) : 'N/A',
      cliente: clienteNombre,
      servicio: pedido.servicio || 'N/A',
      productos: cantidadProductos,
      total: totalPedido
    });
  });
  
  // Crear hoja de productos detallados
  const productosSheet = workbook.addWorksheet('Detalle Productos');
  
  // Configurar columnas
  productosSheet.columns = [
    { header: 'Pedido', key: 'pedido', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'Producto', key: 'producto', width: 30 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Precio Unit.', key: 'precio', width: 15, style: { numFmt: '"$"#,##0.00' } },
    { header: 'Subtotal', key: 'subtotal', width: 15, style: { numFmt: '"$"#,##0.00' } }
  ];
  
  // Estilos de encabezado
  productosSheet.getRow(1).font = { bold: true, size: 12 };
  productosSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  productosSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Añadir filas de productos
  pedidos.forEach(pedido => {
    const clienteNombre = pedido.userId && pedido.userId.nombre ? pedido.userId.nombre : 'N/A';
    
    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach(producto => {
        const precio = producto.productoId && producto.productoId.precio 
          ? producto.productoId.precio 
          : 0;
          
        const subtotal = precio * (producto.cantidad || 0);
        const productoNombre = producto.productoId && producto.productoId.nombre 
          ? producto.productoId.nombre 
          : 'N/A';
          
        productosSheet.addRow({
          pedido: pedido.numero || 'S/N',
          fecha: pedido.fecha ? formatearFecha(new Date(pedido.fecha)) : 'N/A',
          cliente: clienteNombre,
          producto: productoNombre,
          cantidad: producto.cantidad || 0,
          precio: precio,
          subtotal
        });
      });
    }
  });
  
  // Devolver buffer
  return await workbook.xlsx.writeBuffer();
};