// src/controllers/downloadController.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Pedido = require('../models/pedidoSchema');
const Cliente = require('../models/clienteSchema');

// Función para depurar los productos de un pedido
const debugPedidoProductos = (pedido) => {
  console.log('===== DEBUG PEDIDO PRODUCTOS =====');
  console.log(`Pedido ID: ${pedido._id}, Num: ${pedido.numero}`);
  console.log(`Total productos en pedido: ${pedido.productos?.length || 0}`);
  
  if (pedido.productos && Array.isArray(pedido.productos)) {
    pedido.productos.forEach((item, index) => {
      console.log(`\nProducto #${index + 1}:`);
      console.log(`- Raw productoId: ${typeof item.productoId === 'object' ? 'Object' : item.productoId}`);
      
      if (item.productoId && typeof item.productoId === 'object') {
        console.log(`- ID: ${item.productoId._id}`);
        console.log(`- Nombre: ${item.productoId.nombre || 'Sin nombre'}`);
        console.log(`- Precio: ${item.productoId.precio || 0}`);
      } else {
        console.log('- Producto no poblado correctamente');
      }
      
      console.log(`- Cantidad: ${item.cantidad}`);
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
    
    if (!pedido) {
      console.error('Pedido no encontrado:', pedidoId);
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }
    
    // Imprimir información de depuración
    debugPedidoProductos(pedido);
    
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
 * Genera un PDF de remito con paginación automática e información de precios
 * @param {Object} pedidoData - Datos del pedido
 * @param {Object} clienteData - Datos del cliente
 * @param {Array} productos - Lista de productos
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
const generarRemitoPDF = async (pedidoData, clienteData, productos) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Iniciando generación de PDF con ${productos.length} productos`);
      
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
        console.log('PDF generado exitosamente, tamaño:', pdfData.length);
        resolve(pdfData);
      });

      // Calcular el total de todos los productos
      let granTotal = 0;
      productos.forEach(producto => {
        const subtotal = (producto.precio || 0) * (producto.cantidad || 0);
        granTotal += subtotal;
      });

      // Constantes para paginación
      const PRODUCTOS_POR_PAGINA = 15; // Ajustar según se necesite
      const totalPaginas = Math.ceil(productos.length / PRODUCTOS_POR_PAGINA);
      let paginaActual = 1;

      // Función para agregar encabezado
      const agregarEncabezado = () => {
        // Reset to default colors at the beginning
        doc.fillColor('#000000').strokeColor('#000000');
        
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

        // Cabecera de tabla - configurar color negro para el rectángulo
        doc.lineWidth(1);
        doc.fillColor('#000000');  // Explícitamente negro para el rectángulo
        doc.rect(50, 250, 500, 30).fill();
        
        // Cambiar a color blanco para el texto del encabezado
        doc.fillColor('#FFFFFF');
        
        // Encabezados de columna con espaciado ajustado para incluir precio y total
        doc.text('Producto', 60, 260);
        doc.text('Precio Unit.', 250, 260);
        doc.text('Cantidad', 350, 260);
        doc.text('Subtotal', 450, 260);
        
        // ¡IMPORTANTE! Restablecer el color de relleno a negro para el texto siguiente
        doc.fillColor('#000000');
      };

      // Primera página
      agregarEncabezado();

      // Calcular posición Y de inicio de productos
      let y = 290;

      console.log('Agregando productos al PDF:');
      
      // Verificar que productos sea un array
      if (!Array.isArray(productos) || productos.length === 0) {
        console.warn('No hay productos para agregar al PDF o no es un array válido');
        // Agregar un mensaje en el PDF si no hay productos
        doc.fillColor('#000000');
        doc.text('No hay productos disponibles para este pedido', 60, y + 10);
        doc.end();
        return;
      }

      // Función para formatear moneda
      const formatearPrecio = (precio) => {
        return '$' + precio.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
      };

      // Dibujar productos
      for (let i = 0; i < productos.length; i++) {
        const producto = productos[i];
        const precio = producto.precio || 0;
        const cantidad = producto.cantidad || 0;
        const subtotal = precio * cantidad;
        
        console.log(`  Renderizando producto #${i+1}: ${producto.nombre} - Precio: ${precio} - Cantidad: ${cantidad} - Subtotal: ${subtotal}`);
        
        // Verificar si necesitamos una nueva página
        if (i > 0 && i % PRODUCTOS_POR_PAGINA === 0) {
          console.log(`  Agregando nueva página para siguientes productos (página ${paginaActual+1})`);
          paginaActual++;
          doc.addPage();
          agregarEncabezado();
          y = 290; // Reiniciar posición Y
        }

        // Alternar colores para filas
        if (i % 2 === 0) {
          doc.fillColor('#F5F5F5').rect(50, y, 500, 30).fill();
        }

        // IMPORTANTE: Asegurarse de que el color del texto sea negro antes de dibujar el texto
        doc.fillColor('#000000');
        
        // Obtener nombre y valores por defecto si faltan
        const nombre = producto.nombre || 'Producto sin nombre';
        
        // Dibujar datos del producto con alineación
        doc.text(nombre, 60, y + 10);
        doc.text(formatearPrecio(precio), 250, y + 10);
        doc.text(cantidad.toString(), 350, y + 10);
        doc.text(formatearPrecio(subtotal), 450, y + 10);

        // Incrementar posición Y
        y += 30;
      }

      // Agregar línea separadora para el total
      doc.lineWidth(1);
      doc.strokeColor('#000000');
      doc.moveTo(50, y).lineTo(550, y).stroke();
      
      // Mostrar el total
      doc.font('Helvetica-Bold');
      doc.text('TOTAL:', 350, y + 15);
      doc.text(formatearPrecio(granTotal), 450, y + 15);
      doc.font('Helvetica'); // Volver a la fuente normal

      // Finalizar documento
      console.log('Finalizando documento PDF');
      doc.end();

    } catch (error) {
      console.error('Error en generarRemitoPDF:', error);
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

module.exports = {
  downloadExcel: exports.downloadExcel,
  downloadRemito: exports.downloadRemito
};