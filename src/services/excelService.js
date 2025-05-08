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
        
        // Intentar obtener el precio de diversas maneras
        let precio = 0;
        if (producto.productoId && typeof producto.productoId === 'object' && producto.productoId.precio) {
          precio = producto.productoId.precio;
        } else if (producto.precio) {
          precio = producto.precio;
        }
        
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
  
  // Configurar columnas - Agregamos columnas para subServicios y subUbicaciones
  pedidosSheet.columns = [
    { header: 'Número', key: 'numero', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'Servicio', key: 'servicio', width: 25 },
    { header: 'SubServicio', key: 'subServicio', width: 25 }, // Nueva columna
    { header: 'SubUbicación', key: 'subUbicacion', width: 25 }, // Nueva columna
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
    // Obtener el nombre del cliente correctamente
    let clienteNombre = 'N/A';
    let subServicioNombre = 'N/A';
    let subUbicacionNombre = 'N/A';
    
    // Verificar estructura del cliente en pedido
    if (pedido.cliente) {
      // Nueva estructura jerárquica de cliente
      clienteNombre = pedido.cliente.nombreCliente || 'N/A';
      subServicioNombre = pedido.cliente.nombreSubServicio || 'N/A';
      subUbicacionNombre = pedido.cliente.nombreSubUbicacion || 'N/A';
    } else if (pedido.userId && pedido.userId.nombre) {
      // Estructura anterior
      clienteNombre = pedido.userId.nombre;
    }
    
    // Contar cantidad de productos
    let cantidadItems = 0;
    let totalPedido = 0;
    
    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach(producto => {
        cantidadItems += producto.cantidad || 0;
        
        // Intentar obtener el precio de diversas maneras
        let precio = 0;
        if (producto.productoId && typeof producto.productoId === 'object' && producto.productoId.precio) {
          precio = producto.productoId.precio;
        } else if (producto.precio) {
          precio = producto.precio;
        }
        
        totalPedido += precio * (producto.cantidad || 0);
      });
    }
    
    // Obtener servicio
    let servicio = 'N/A';
    if (pedido.servicio) {
      servicio = Array.isArray(pedido.servicio) ? pedido.servicio.join(', ') : pedido.servicio;
    }
    
    pedidosSheet.addRow({
      numero: pedido.nPedido || 'S/N',
      fecha: pedido.fecha ? formatearFecha(new Date(pedido.fecha)) : 'N/A',
      cliente: clienteNombre,
      servicio: servicio,
      subServicio: subServicioNombre, // Añadimos el subServicio
      subUbicacion: subUbicacionNombre, // Añadimos la subUbicación
      productos: cantidadItems,
      total: totalPedido
    });
  });
  
  // Crear hoja de productos detallados
  const productosSheet = workbook.addWorksheet('Detalle Productos');
  
  // Configurar columnas - Añadimos subServicio y subUbicación
  productosSheet.columns = [
    { header: 'Pedido #', key: 'pedido', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'Servicio', key: 'servicio', width: 25 },
    { header: 'SubServicio', key: 'subServicio', width: 25 }, // Nueva columna
    { header: 'SubUbicación', key: 'subUbicacion', width: 25 }, // Nueva columna
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
    // Obtener información del cliente
    let clienteNombre = 'N/A';
    let subServicioNombre = 'N/A';
    let subUbicacionNombre = 'N/A';
    
    // Verificar estructura del cliente en pedido
    if (pedido.cliente) {
      // Nueva estructura jerárquica de cliente
      clienteNombre = pedido.cliente.nombreCliente || 'N/A';
      subServicioNombre = pedido.cliente.nombreSubServicio || 'N/A';
      subUbicacionNombre = pedido.cliente.nombreSubUbicacion || 'N/A';
    } else if (pedido.userId && pedido.userId.nombre) {
      clienteNombre = pedido.userId.nombre;
    }
    
    // Obtener servicio
    let servicio = 'N/A';
    if (pedido.servicio) {
      servicio = Array.isArray(pedido.servicio) ? pedido.servicio.join(', ') : pedido.servicio;
    }
    
    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach(producto => {
        const cantidad = producto.cantidad || 0;
        
        // Intentar obtener el precio de diversas maneras
        let precio = 0;
        if (producto.productoId && typeof producto.productoId === 'object' && producto.productoId.precio) {
          precio = producto.productoId.precio;
        } else if (producto.precio) {
          precio = producto.precio;
        }
        
        const subtotal = precio * cantidad;
        
        // Obtener nombre del producto de forma segura
        let productoNombre = 'N/A';
        if (producto.productoId) {
          if (typeof producto.productoId === 'object' && producto.productoId.nombre) {
            productoNombre = producto.productoId.nombre;
          } else if (producto.nombre) {
            productoNombre = producto.nombre;
          }
        } else if (producto.nombre) {
          productoNombre = producto.nombre;
        }
          
        productosSheet.addRow({
          pedido: pedido.nPedido || 'S/N',
          fecha: pedido.fecha ? formatearFecha(new Date(pedido.fecha)) : 'N/A',
          cliente: clienteNombre,
          servicio: servicio,
          subServicio: subServicioNombre, // Añadimos el subServicio
          subUbicacion: subUbicacionNombre, // Añadimos la subUbicación
          producto: productoNombre,
          cantidad: cantidad,
          precio: precio,
          subtotal: subtotal
        });
      });
    }
  });
  
  // Devolver buffer
  return await workbook.xlsx.writeBuffer();
};
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
    // Verificar que el pedido tenga la estructura correcta - Aceptar tanto la estructura antigua como la nueva
    let clienteId, subServicioId, subUbicacionId, nombreCliente, nombreSubServicio, nombreSubUbicacion;
    
    if (pedido.cliente) {
      // Nueva estructura jerárquica
      clienteId = pedido.cliente.clienteId;
      subServicioId = pedido.cliente.subServicioId;
      subUbicacionId = pedido.cliente.subUbicacionId;
      nombreCliente = pedido.cliente.nombreCliente || 'Cliente no identificado';
      nombreSubServicio = pedido.cliente.nombreSubServicio || 'Subservicio no identificado';
      nombreSubUbicacion = pedido.cliente.nombreSubUbicacion || 'Sububicación no identificada';
    } else {
      // Estructura antigua - Intentar obtener datos básicos
      if (pedido.clienteId) {
        clienteId = pedido.clienteId;
        nombreCliente = pedido.servicio || 'Cliente no identificado';
      } else if (pedido.userId && pedido.userId.nombre) {
        clienteId = pedido.userId._id;
        nombreCliente = pedido.userId.nombre || 'Cliente no identificado';
      } else {
        // Si no hay información de cliente, saltamos este pedido
        return;
      }
    }
    
    // Si no tenemos un clienteId válido, saltamos este pedido
    if (!clienteId) return;
    
    // Calcular total del pedido
    let totalPedido = 0;
    let cantidadProductos = 0;
    
    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach(producto => {
        // Intentar obtener el precio de diversas maneras
        let precio = 0;
        if (producto.productoId && typeof producto.productoId === 'object' && producto.productoId.precio) {
          precio = producto.productoId.precio;
        } else if (producto.precio) {
          precio = producto.precio;
        }
        
        const cantidad = producto.cantidad || 0;
        totalPedido += precio * cantidad;
        cantidadProductos += cantidad;
      });
    }
    
    // Inicializar estructura si no existe
    if (!estructuraReporte[clienteId]) {
      estructuraReporte[clienteId] = {
        nombre: nombreCliente,
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
          nombre: nombreSubServicio,
          sububicaciones: {},
          totalPedidos: 0,
          totalProductos: 0,
          totalMonto: 0,
          pedidos: [] // Agregar array para guardar pedidos
        };
      }
      
      // Actualizar totales del subservicio
      estructuraReporte[clienteId].subservicios[subServicioId].totalPedidos += 1;
      estructuraReporte[clienteId].subservicios[subServicioId].totalProductos += cantidadProductos;
      estructuraReporte[clienteId].subservicios[subServicioId].totalMonto += totalPedido;
      
      // Guardar el pedido para detalle
      estructuraReporte[clienteId].subservicios[subServicioId].pedidos.push({
        id: pedido._id,
        nPedido: pedido.nPedido,
        fecha: pedido.fecha,
        productos: pedido.productos,
        monto: totalPedido
      });
      
      // Manejar estructura de sububicaciones
      if (subUbicacionId) {
        if (!estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId]) {
          estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId] = {
            nombre: nombreSubUbicacion,
            totalPedidos: 0,
            totalProductos: 0,
            totalMonto: 0,
            pedidos: [] // Agregar array para guardar pedidos
          };
        }
        
        // Actualizar totales de la sububicación
        estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId].totalPedidos += 1;
        estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId].totalProductos += cantidadProductos;
        estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId].totalMonto += totalPedido;
        
        // Guardar el pedido para detalle
        estructuraReporte[clienteId].subservicios[subServicioId].sububicaciones[subUbicacionId].pedidos.push({
          id: pedido._id,
          nPedido: pedido.nPedido,
          fecha: pedido.fecha,
          productos: pedido.productos,
          monto: totalPedido
        });
      }
    } else {
      // Si no hay subservicio, crear uno genérico para mantener la estructura
      const genSubServicioId = 'gen_' + clienteId;
      if (!estructuraReporte[clienteId].subservicios[genSubServicioId]) {
        estructuraReporte[clienteId].subservicios[genSubServicioId] = {
          nombre: 'General',
          sububicaciones: {},
          totalPedidos: 0,
          totalProductos: 0,
          totalMonto: 0,
          pedidos: []
        };
      }
      
      // Actualizar totales del subservicio genérico
      estructuraReporte[clienteId].subservicios[genSubServicioId].totalPedidos += 1;
      estructuraReporte[clienteId].subservicios[genSubServicioId].totalProductos += cantidadProductos;
      estructuraReporte[clienteId].subservicios[genSubServicioId].totalMonto += totalPedido;
      
      // Guardar el pedido para detalle
      estructuraReporte[clienteId].subservicios[genSubServicioId].pedidos.push({
        id: pedido._id,
        nPedido: pedido.nPedido,
        fecha: pedido.fecha,
        productos: pedido.productos,
        monto: totalPedido
      });
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
      if (cliente.subServicios && Array.isArray(cliente.subServicios)) {
        cliente.subServicios.forEach(subServicio => {
          estructuraReporte[cliente._id].subservicios[subServicio._id] = {
            nombre: subServicio.nombre,
            sububicaciones: {},
            totalPedidos: 0,
            totalProductos: 0,
            totalMonto: 0,
            pedidos: []
          };
          
          // Añadir sububicaciones del subservicio
          if (subServicio.subUbicaciones && Array.isArray(subServicio.subUbicaciones)) {
            subServicio.subUbicaciones.forEach(subUbicacion => {
              estructuraReporte[cliente._id].subservicios[subServicio._id].sububicaciones[subUbicacion._id] = {
                nombre: subUbicacion.nombre,
                totalPedidos: 0,
                totalProductos: 0,
                totalMonto: 0,
                pedidos: []
              };
            });
          }
        });
      }
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
  
  // Crear una hoja de detalle de productos
  const detalleSheet = workbook.addWorksheet('Detalle de Productos');
  
  // Configurar columnas para la hoja de detalle
  detalleSheet.columns = [
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'Subservicio', key: 'subservicio', width: 25 },
    { header: 'Sububicación', key: 'sububicacion', width: 25 },
    { header: 'Pedido #', key: 'pedido', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Producto', key: 'producto', width: 30 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Precio Unit.', key: 'precio', width: 15, style: { numFmt: '"$"#,##0.00' } },
    { header: 'Subtotal', key: 'subtotal', width: 15, style: { numFmt: '"$"#,##0.00' } }
  ];
  
  // Estilos de encabezado para detalle
  detalleSheet.getRow(1).font = { bold: true, size: 12 };
  detalleSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  detalleSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Iterar a través de la estructura para llenar la hoja de detalle
  Object.keys(estructuraReporte).forEach(clienteId => {
    const cliente = estructuraReporte[clienteId];
    
    Object.keys(cliente.subservicios).forEach(subServicioId => {
      const subservicio = cliente.subservicios[subServicioId];
      
      // Procesar pedidos a nivel de subservicio
      subservicio.pedidos.forEach(pedido => {
        if (pedido.productos && Array.isArray(pedido.productos)) {
          pedido.productos.forEach(producto => {
            // Obtener datos del producto de forma segura
            const cantidad = producto.cantidad || 0;
            let precio = 0;
            let productoNombre = 'N/A';
            
            if (producto.productoId) {
              if (typeof producto.productoId === 'object') {
                precio = producto.productoId.precio || 0;
                productoNombre = producto.productoId.nombre || 'N/A';
              }
            } else if (producto.precio) {
              precio = producto.precio;
              productoNombre = producto.nombre || 'N/A';
            }
            
            const subtotal = precio * cantidad;
            
            // Añadir fila con detalle del producto
            detalleSheet.addRow({
              cliente: cliente.nombre,
              subservicio: subservicio.nombre,
              sububicacion: '',
              pedido: pedido.nPedido || 'S/N',
              fecha: pedido.fecha ? formatearFecha(new Date(pedido.fecha)) : 'N/A',
              producto: productoNombre,
              cantidad: cantidad,
              precio: precio,
              subtotal: subtotal
            });
          });
        }
      });
      
      // Procesar pedidos a nivel de sububicación
      Object.keys(subservicio.sububicaciones).forEach(subUbicacionId => {
        const sububicacion = subservicio.sububicaciones[subUbicacionId];
        
        sububicacion.pedidos.forEach(pedido => {
          if (pedido.productos && Array.isArray(pedido.productos)) {
            pedido.productos.forEach(producto => {
              // Obtener datos del producto de forma segura
              const cantidad = producto.cantidad || 0;
              let precio = 0;
              let productoNombre = 'N/A';
              
              if (producto.productoId) {
                if (typeof producto.productoId === 'object') {
                  precio = producto.productoId.precio || 0;
                  productoNombre = producto.productoId.nombre || 'N/A';
                }
              } else if (producto.precio) {
                precio = producto.precio;
                productoNombre = producto.nombre || 'N/A';
              }
              
              const subtotal = precio * cantidad;
              
              // Añadir fila con detalle del producto
              detalleSheet.addRow({
                cliente: cliente.nombre,
                subservicio: subservicio.nombre,
                sububicacion: sububicacion.nombre,
                pedido: pedido.nPedido || 'S/N',
                fecha: pedido.fecha ? formatearFecha(new Date(pedido.fecha)) : 'N/A',
                producto: productoNombre,
                cantidad: cantidad,
                precio: precio,
                subtotal: subtotal
              });
            });
          }
        });
      });
    });
  });
  
  // Crear una hoja para mostrar la jerarquía completa
  const jerarquiaSheet = workbook.addWorksheet('Estructura Jerárquica');
  
  // Configurar columnas
  jerarquiaSheet.columns = [
    { header: 'Cliente', key: 'cliente', width: 25 },
    { header: 'ID Cliente', key: 'clienteId', width: 25 },
    { header: 'SubServicio', key: 'subServicio', width: 25 },
    { header: 'ID SubServicio', key: 'subServicioId', width: 25 },
    { header: 'SubUbicación', key: 'subUbicacion', width: 25 },
    { header: 'ID SubUbicación', key: 'subUbicacionId', width: 25 }
  ];
  
  // Estilos de encabezado
  jerarquiaSheet.getRow(1).font = { bold: true, size: 12 };
  jerarquiaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  jerarquiaSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Agregar filas con la estructura completa
  clientes.forEach(cliente => {
    // Para cada cliente, recorrer sus subservicios
    if (cliente.subServicios && Array.isArray(cliente.subServicios)) {
      cliente.subServicios.forEach(subServicio => {
        // Para cada subservicio, recorrer sus sububicaciones
        if (subServicio.subUbicaciones && Array.isArray(subServicio.subUbicaciones)) {
          subServicio.subUbicaciones.forEach(subUbicacion => {
            // Añadir fila con la estructura completa
            jerarquiaSheet.addRow({
              cliente: cliente.nombre,
              clienteId: cliente._id.toString(),
              subServicio: subServicio.nombre,
              subServicioId: subServicio._id.toString(),
              subUbicacion: subUbicacion.nombre,
              subUbicacionId: subUbicacion._id.toString()
            });
          });
        } else {
          // Si no hay sububicaciones, añadir solo el subservicio
          jerarquiaSheet.addRow({
            cliente: cliente.nombre,
            clienteId: cliente._id.toString(),
            subServicio: subServicio.nombre,
            subServicioId: subServicio._id.toString(),
            subUbicacion: '',
            subUbicacionId: ''
          });
        }
      });
    } else {
      // Si no hay subservicios, añadir solo el cliente
      jerarquiaSheet.addRow({
        cliente: cliente.nombre,
        clienteId: cliente._id.toString(),
        subServicio: '',
        subServicioId: '',
        subUbicacion: '',
        subUbicacionId: ''
      });
    }
  });
  
  // Crear una hoja de resumen
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
// Export all functions
module.exports = {
  generarReporteExcel,
  generarReporteMensual
};