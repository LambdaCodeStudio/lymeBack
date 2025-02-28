// src/services/excelService.js
const ExcelJS = require('exceljs');

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
        const precio = producto.productoId?.precio || 0;
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
        const precio = producto.productoId?.precio || 0;
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
        const precio = producto.productoId?.precio || 0;
        const subtotal = precio * (producto.cantidad || 0);
        const productoNombre = producto.productoId?.nombre || 'N/A';
          
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
  generarReporteExcel
};