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
// Agregar al archivo src/services/excelService.js

/**
 * Genera un reporte mensual con estructura jerárquica de clientes > subservicios > sububicaciones
 * @param {Array} pedidos - Lista de pedidos
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @param {String} clienteId - ID del cliente específico (opcional)
 * @returns {Promise<Buffer>} - Buffer del Excel generado
 */
const generarReporteMensual = async (pedidos, fechaInicio, fechaFin, clienteId = null) => {
  const workbook = new ExcelJS.Workbook();
  
  // Añadir metadata
  workbook.creator = 'Lyme Depósito';
  workbook.lastModifiedBy = 'Sistema de Gestión';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Formatear fechas para mostrar en el informe
  const formatearFecha = (fecha) => {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };
  
  // Periodo del reporte
  const periodoTexto = `${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`;
  
  // Crear hoja principal
  const reporteSheet = workbook.addWorksheet('Reporte Mensual');
  
  // Configurar encabezados y formatos para la estructura jerárquica
  reporteSheet.columns = [
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Subservicio', key: 'subservicio', width: 30 },
    { header: 'Sububicación', key: 'sububicacion', width: 30 },
    { header: 'Pedidos', key: 'pedidos', width: 10 },
    { header: 'Productos', key: 'productos', width: 12 },
    { header: 'Total ($)', key: 'total', width: 15, style: { numFmt: '"$"#,##0.00' } }
  ];
  
  // Estilos de encabezado
  reporteSheet.getRow(1).font = { bold: true, size: 12 };
  reporteSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  reporteSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Agregar título de reporte
  reporteSheet.insertRow(1, []);
  reporteSheet.insertRow(1, [`REPORTE MENSUAL: ${periodoTexto}`]);
  reporteSheet.getRow(1).font = { bold: true, size: 16 };
  reporteSheet.getRow(1).alignment = { horizontal: 'center' };
  reporteSheet.mergeCells('A1:F1');
  
  // Recuperar todos los clientes necesarios
  const Cliente = require('../models/clienteSchema');
  let clientes = [];
  
  if (clienteId) {
    // Si se especifica un cliente, obtener solo ese
    const cliente = await Cliente.findById(clienteId);
    if (cliente) clientes = [cliente];
  } else {
    // Si no, obtener todos los clientes activos
    clientes = await Cliente.find({ activo: true });
  }
  
  // Estructura para acumular totales
  let estructuraReporte = {};
  let totalGeneral = 0;
  
  // Procesar todos los pedidos para construir la estructura jerárquica
  pedidos.forEach(pedido => {
    // Verificar que el pedido tenga la estructura correcta
    if (!pedido.cliente || !pedido.productos || !Array.isArray(pedido.productos)) return;
    
    const clienteId = pedido.cliente.clienteId;
    const subServicioId = pedido.cliente.subServicioId;
    const subUbicacionId = pedido.cliente.subUbicacionId;
    
    // Calcular total del pedido
    let totalPedido = 0;
    let cantidadProductos = 0;
    
    pedido.productos.forEach(producto => {
      const precio = producto.productoId?.precio || producto.precioUnitario || 0;
      const cantidad = producto.cantidad || 0;
      totalPedido += precio * cantidad;
      cantidadProductos += cantidad;
    });
    
    // Inicializar estructura si no existe
    if (!estructuraReporte[clienteId]) {
      estructuraReporte[clienteId] = {
        nombre: pedido.cliente.nombreCliente || 'Cliente no identificado',
        subservicios: {},
        totalPedidos: 0,
        totalProductos: 0,
        totalMonto: 0
      };
    }
    
    // Actualizar totales del cliente
    estructuraReporte[clienteId].totalPedidos += 1;
    estructuraReporte[clienteId].totalProductos += cantidadProductos;
    estructuraReporte[clienteId].totalMonto += totalPedido;
    
    // Manejar estructura de subservicios
    if (subServicioId) {
      if (!estructuraReporte[clienteId].subservicios[subServicioId]) {
        estructuraReporte[clienteId].subservicios[subServicioId] = {
          nombre: pedido.cliente.nombreSubServicio || 'Subservicio no identificado',
          sububicaciones: {},
          totalPedidos: 0,
          totalProductos: 0,
          totalMonto: 0
        };
      }
      
      // Actualizar totales del subservicio
      estructuraReporte[clienteId].subservicios[subServicioId].totalPedidos += 1;
      estructuraReporte[clienteId].subservicios[subServicioId].totalProductos += cantidadProductos;
      estructuraReporte[clienteId].subservicios[subServicioId].totalMonto += totalPedido;
      
      // Manejar estructura de sububicaciones
      if (subUbicacionId) {
        if (!estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId]) {
          estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId] = {
            nombre: pedido.cliente.nombreSubUbicacion || 'Sububicación no identificada',
            totalPedidos: 0,
            totalProductos: 0,
            totalMonto: 0
          };
        }
        
        // Actualizar totales de la sububicación
        estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId].totalPedidos += 1;
        estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId].totalProductos += cantidadProductos;
        estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId].totalMonto += totalPedido;
      }
    }
  });
  
  // Completar información de clientes que no tienen pedidos en el periodo
  clientes.forEach(cliente => {
    if (!estructuraReporte[cliente._id]) {
      estructuraReporte[cliente._id] = {
        nombre: cliente.nombre,
        subservicios: {},
        totalPedidos: 0,
        totalProductos: 0,
        totalMonto: 0
      };
      
      // Añadir subservicios del cliente
      cliente.subServicios.forEach(subServicio => {
        estructuraReporte[cliente._id].subservicios[subServicio._id] = {
          nombre: subServicio.nombre,
          sububicaciones: {},
          totalPedidos: 0,
          totalProductos: 0,
          totalMonto: 0
        };
        
        // Añadir sububicaciones del subservicio
        subServicio.subUbicaciones.forEach(subUbicacion => {
          estructuraReporte[cliente._id].subservicios[subServicio._id].sububicaciones[subUbicacion._id] = {
            nombre: subUbicacion.nombre,
            totalPedidos: 0,
            totalProductos: 0,
            totalMonto: 0
          };
        });
      });
    }
  });
  
  // Generar filas en el Excel con la estructura jerárquica
  let rowIndex = 3; // Empezamos después del encabezado
  
  // Iterar a través de la estructura jerárquica
  Object.keys(estructuraReporte).forEach(clienteId => {
    const cliente = estructuraReporte[clienteId];
    totalGeneral += cliente.totalMonto;
    
    // Agregar fila para el cliente
    const clienteRow = reporteSheet.addRow({
      cliente: cliente.nombre,
      subservicio: '',
      sububicacion: '',
      pedidos: cliente.totalPedidos,
      productos: cliente.totalProductos,
      total: cliente.totalMonto
    });
    
    // Aplicar estilos para el cliente
    clienteRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
    
    // Iterar a través de los subservicios
    Object.keys(cliente.subservicios).forEach(subServicioId => {
      const subservicio = cliente.subservicios[subServicioId];
      
      // Agregar fila para el subservicio
      const subservicioRow = reporteSheet.addRow({
        cliente: '',
        subservicio: subservicio.nombre,
        sububicacion: '',
        pedidos: subservicio.totalPedidos,
        productos: subservicio.totalProductos,
        total: subservicio.totalMonto
      });
      
      // Aplicar estilos para el subservicio
      subservicioRow.eachCell(cell => {
        cell.font = { italic: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      });
      
      // Iterar a través de las sububicaciones
      Object.keys(subservicio.sububicaciones).forEach(subUbicacionId => {
        const sububicacion = subservicio.sububicaciones[subUbicacionId];
        
        // Agregar fila para la sububicación
        reporteSheet.addRow({
          cliente: '',
          subservicio: '',
          sububicacion: sububicacion.nombre,
          pedidos: sububicacion.totalPedidos,
          productos: sububicacion.totalProductos,
          total: sububicacion.totalMonto
        });
      });
    });
    
    // Agregar una fila vacía después de cada cliente para mejorar la legibilidad
    reporteSheet.addRow({});
  });
  
  // Agregar fila de total general
  const totalRow = reporteSheet.addRow({
    cliente: 'TOTAL GENERAL',
    subservicio: '',
    sububicacion: '',
    pedidos: '',
    productos: '',
    total: totalGeneral
  });
  
  totalRow.eachCell(cell => {
    cell.font = { bold: true, size: 12 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  
  // Agregar una hoja de resumen
  const resumenSheet = workbook.addWorksheet('Resumen');
  
  resumenSheet.columns = [
    { header: 'Información', key: 'info', width: 25 },
    { header: 'Valor', key: 'valor', width: 20 }
  ];
  
  // Estilos de encabezado para resumen
  resumenSheet.getRow(1).font = { bold: true, size: 12 };
  resumenSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  resumenSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Datos de resumen
  resumenSheet.addRow({ info: 'Período del reporte', valor: periodoTexto });
  resumenSheet.addRow({ info: 'Total de clientes', valor: Object.keys(estructuraReporte).length });
  
  let totalSubservicios = 0;
  let totalSububicaciones = 0;
  let totalPedidos = 0;
  let totalProductos = 0;
  
  // Calcular totales para el resumen
  Object.values(estructuraReporte).forEach(cliente => {
    const subserviciosCount = Object.keys(cliente.subservicios).length;
    totalSubservicios += subserviciosCount;
    
    totalPedidos += cliente.totalPedidos;
    totalProductos += cliente.totalProductos;
    
    Object.values(cliente.subservicios).forEach(subservicio => {
      totalSububicaciones += Object.keys(subservicio.sububicaciones).length;
    });
  });
  
  resumenSheet.addRow({ info: 'Total de subservicios', valor: totalSubservicios });
  resumenSheet.addRow({ info: 'Total de sububicaciones', valor: totalSububicaciones });
  resumenSheet.addRow({ info: 'Total de pedidos', valor: totalPedidos });
  resumenSheet.addRow({ info: 'Total de productos', valor: totalProductos });
  resumenSheet.addRow({ info: 'Monto total ($)', valor: totalGeneral });
  
  // Agregar una fila para el cliente específico si se proporcionó
  if (clienteId) {
    const clienteSeleccionado = clientes.find(c => c._id.toString() === clienteId);
    if (clienteSeleccionado) {
      resumenSheet.addRow({ info: 'Cliente seleccionado', valor: clienteSeleccionado.nombre });
    }
  } else {
    resumenSheet.addRow({ info: 'Cliente seleccionado', valor: 'Todos los clientes' });
  }
  
  // Dar formato a las celdas de valor
  for (let i = 2; i <= 8; i++) {
    const cell = resumenSheet.getCell(`B${i}`);
    if (i === 8) {
      // Dar formato de moneda al monto total
      cell.numFmt = '"$"#,##0.00';
    }
    cell.alignment = { horizontal: 'right' };
  }
  
  // Devolver buffer
  return await workbook.xlsx.writeBuffer();
};
module.exports = {
  generarReporteExcel,
  generarReporteMensual
};