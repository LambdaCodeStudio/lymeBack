// src/controllers/downloadController.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { Pedido } = require('../models/pedidoSchema');
const Cliente = require('../models/clienteSchema');
const fs = require('fs');
const path = require('path');
const { generarReporteExcel, generarReporteMensual } = require('../services/excelService');

/**
 * Genera un PDF de remito con paginación automática sin mostrar precios
 * @param {Object} pedidoData - Datos del pedido
 * @param {Object} clienteData - Datos del cliente (opcional)
 * @param {Array} productos - Lista de productos
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
const generarRemitoPDF = async (pedidoData, clienteData, productos) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Iniciando generación de PDF...');
      
      // Validar datos de entrada
      if (!pedidoData) {
        throw new Error('Datos de pedido requeridos');
      }
      
      console.log('Datos de pedido recibidos:', JSON.stringify(pedidoData));
      console.log('Cantidad de productos:', productos ? productos.length : 0);
      
      if (!Array.isArray(productos)) {
        console.error('Productos no es un array, es:', typeof productos);
        throw new Error('La lista de productos debe ser un array');
      }
      
      // Función para procesar productos y expandir combos
      const procesarProductos = async (productos) => {
        try {
          const productosExpandidos = [];
          const Producto = mongoose.model('Producto');
          
          for (const producto of productos) {
            const productoObj = {
              ...producto,
              esCombo: producto.productoId && producto.productoId.esCombo === true,
              componentes: []
            };
            
            productosExpandidos.push(productoObj);
            
            // Si es un combo, obtener sus componentes
            if (productoObj.esCombo && producto.productoId && 
                producto.productoId.itemsCombo && 
                Array.isArray(producto.productoId.itemsCombo)) {
              
              console.log(`Procesando combo: ${producto.nombre} con ${producto.productoId.itemsCombo.length} componentes`);
              
              // Para cada componente del combo, obtener sus detalles
              for (const item of producto.productoId.itemsCombo) {
                try {
                  if (!item.productoId) continue;
                  
                  // Si el componente ya está poblado
                  if (typeof item.productoId === 'object' && item.productoId.nombre) {
                    productoObj.componentes.push({
                      nombre: item.productoId.nombre,
                      cantidad: item.cantidad * producto.cantidad // Multiplicar por la cantidad del combo
                    });
                  } else {
                    // Si necesitamos poblar el componente
                    const id = typeof item.productoId === 'object' ? item.productoId._id : item.productoId;
                    const componenteProducto = await Producto.findById(id).select('nombre');
                    
                    if (componenteProducto) {
                      productoObj.componentes.push({
                        nombre: componenteProducto.nombre,
                        cantidad: item.cantidad * producto.cantidad // Multiplicar por la cantidad del combo
                      });
                    }
                  }
                } catch (compError) {
                  console.error(`Error al procesar componente de combo:`, compError);
                  // Continuar con el siguiente componente
                }
              }
            }
          }
          
          return productosExpandidos;
        } catch (error) {
          console.error("Error en procesarProductos:", error);
          return productos; // Devolver productos originales en caso de error
        }
      };
      
      console.log(`Iniciando generación de PDF con ${productos.length} productos`);
      
      // Procesar productos y expandir combos
      procesarProductos(productos).then(productosExpandidos => {
        try {
          // Configuración de documento
          const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            bufferPages: true, // Importante para poder numerar páginas al final
            info: {
              Title: `Remito ${pedidoData.numero || pedidoData.nPedido || ''}`,
              Author: 'Lyme S.A',
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
          
          // Manejar errores del documento
          doc.on('error', (err) => {
            console.error('Error en la generación del PDF:', err);
            reject(err);
          });

          // Ruta al logo de la empresa
          const logoPath = path.join(process.cwd(), 'public', 'lyme.png');

          // Variables de paginación y posicionamiento
          let paginaActual = 1;
          let paginas = 1;
          let totalPaginas = 1; // Se calculará correctamente al final
          
          // Función para agregar el título del documento
          const agregarTitulo = () => {
            // Agregar logo si existe
            try {
              if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, 50, { width: 150 });
              } else {
                console.warn('Logo no encontrado en:', logoPath);
              }
            } catch (logoError) {
              console.error('Error al agregar logo:', logoError);
            }
            
            // Agregar número de pedido a la derecha
            const numeroPedido = pedidoData.numero || pedidoData.nPedido || '';
            doc.font('Helvetica-Bold').fontSize(12);
            doc.text(`Remito N°: ${numeroPedido}`, 350, 60, { align: 'right' });
            
            // No agregamos más texto de título ya que el logo es suficiente
            doc.moveDown();
            doc.fontSize(12).font('Helvetica');
          };

          // Función para agregar información del pedido incluyendo cliente, subservicio y sububicación
          const agregarInfoPedido = () => {
            const y = 120; // Posición Y inicial
            let currentY = y;
            
            // Cliente - Acceder correctamente a la estructura
            doc.fontSize(10).font('Helvetica-Bold').text('Cliente:', 50, currentY);
            
            // Primero intentamos acceder a cliente.nombreCliente (estructura nueva)
            if (pedidoData.cliente && pedidoData.cliente.nombreCliente) {
              doc.font('Helvetica').text(pedidoData.cliente.nombreCliente, 120, currentY, { width: 400, ellipsis: true });
            } 
            // Si no está disponible, usamos el campo servicio (estructura antigua)
            else if (pedidoData.servicio) {
              // Manejar si servicio es un array o string
              const servicioText = Array.isArray(pedidoData.servicio) 
                ? pedidoData.servicio.join(', ') 
                : pedidoData.servicio;
              doc.font('Helvetica').text(servicioText || 'No especificado', 120, currentY, { width: 400, ellipsis: true });
            } else {
              doc.font('Helvetica').text('No especificado', 120, currentY, { width: 400 });
            }
            currentY += 20;
            
            // Agregar supervisor
            let supervisorNombre = 'No especificado';
            // Intentar obtener el nombre del supervisor desde las relaciones del pedido
            if (pedidoData.pedido && pedidoData.pedido.supervisorId) {
              if (typeof pedidoData.pedido.supervisorId === 'object') {
                supervisorNombre = pedidoData.pedido.supervisorId.nombre || 
                                  (pedidoData.pedido.supervisorId.apellido ? 
                                  `${pedidoData.pedido.supervisorId.nombre} ${pedidoData.pedido.supervisorId.apellido}` : 
                                  pedidoData.pedido.supervisorId.nombre) ||
                                  pedidoData.pedido.supervisorId.usuario || 
                                  'No especificado';
              } else {
                // Si el supervisorId es solo el ID y no está poblado como objeto
                supervisorNombre = 'ID: ' + pedidoData.pedido.supervisorId;
              }
            }
            doc.fontSize(10).font('Helvetica-Bold').text('Supervisor:', 50, currentY);
            doc.font('Helvetica').text(supervisorNombre, 120, currentY, { width: 400, ellipsis: true });
            currentY += 20;
            
            // Agregar subservicio si está disponible
            if (pedidoData.cliente && pedidoData.cliente.nombreSubServicio) {
              doc.fontSize(10).font('Helvetica-Bold').text('Subservicio:', 50, currentY);
              doc.font('Helvetica').text(pedidoData.cliente.nombreSubServicio, 120, currentY, { width: 400, ellipsis: true });
              currentY += 20;
            } 
            // Si no, intentar usar seccionDelServicio
            else if (pedidoData.seccionDelServicio && pedidoData.seccionDelServicio.trim() !== '') {
              doc.fontSize(10).font('Helvetica-Bold').text('Subservicio:', 50, currentY);
              doc.font('Helvetica').text(pedidoData.seccionDelServicio, 120, currentY, { width: 400, ellipsis: true });
              currentY += 20;
            }
            
            // Agregar sububicación si está disponible
            if (pedidoData.cliente && pedidoData.cliente.nombreSubUbicacion) {
              doc.fontSize(10).font('Helvetica-Bold').text('Ubicación:', 50, currentY);
              doc.font('Helvetica').text(pedidoData.cliente.nombreSubUbicacion, 120, currentY, { width: 400, ellipsis: true });
              currentY += 20;
            }
            
            // Ya no mostramos el número de pedido aquí, ya que lo pusimos arriba a la derecha
            // currentY se mantiene igual
            
            // Formatear fecha
            let fechaFormateada = 'Sin fecha';
            try {
              if (pedidoData.fecha) {
                const fecha = new Date(pedidoData.fecha);
                if (!isNaN(fecha.getTime())) {
                  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                  fechaFormateada = `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
                }
              }
            } catch (fechaError) {
              console.error('Error al formatear fecha:', fechaError);
            }
            
            // Fecha de pedido
            doc.fontSize(10).font('Helvetica-Bold').text('Fecha de pedido:', 50, currentY);
            doc.font('Helvetica').text(fechaFormateada, 150, currentY, { width: 140 });
            currentY += 30;
            
            return currentY; // Devolver la posición Y actualizada después de toda la información
          };

          // Función para agregar la cabecera de la tabla de productos
          const agregarCabeceraTabla = (posY) => {
            // Cabecera de tabla con color atractivo
            doc.lineWidth(1);
            doc.fillColor('#3498db'); // Azul para cabecera
            doc.roundedRect(50, posY, 500, 30, 3).fill();
            
            // Encabezados de columna con texto blanco
            doc.fillColor('#FFFFFF');
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('Producto', 80, posY + 10);
            doc.text('Cantidad', 400, posY + 10);
            
            // Restablecer color de texto a negro
            doc.fillColor('#000000').font('Helvetica');

            return posY + 30; // Devolver la nueva posición Y
          };

          // Función principal para dibujar todo el PDF
          const dibujarPDF = () => {
            // Primera página - encabezado y datos simplificados
            agregarTitulo();
            let y = agregarInfoPedido();
            
            // Agregar la cabecera de la tabla de productos
            y = agregarCabeceraTabla(y);
            console.log("Posición Y después de agregar cabecera:", y);
            
            // IMPORTANTE: Comprobamos si hay productos para dibujar
            if (!productosExpandidos || productosExpandidos.length === 0) {
              console.warn('No hay productos para agregar al PDF o no es un array válido');
              doc.text('No hay productos disponibles para este pedido', 80, y + 10);
              // Finalizar y retornar
              finalizarDocumento();
              return;
            }
            
            // Variables para seguimiento
            const PRODUCTOS_POR_PAGINA_PRIMERA = 10; // Productos en primera página
            const PRODUCTOS_POR_PAGINA_RESTO = 20;   // Productos en páginas siguientes
            let itemsEnPaginaActual = 0;
            let productosPorPagina = PRODUCTOS_POR_PAGINA_PRIMERA;
            
            // Flag para asegurarnos de que al menos un producto se muestre en la primera página
            let alMenosUnProductoEnPrimeraPagina = false;
            
            // Dibujar productos uno por uno
            for (let i = 0; i < productosExpandidos.length; i++) {
              try {
                const producto = productosExpandidos[i];
                const cantidad = Number(producto.cantidad) || 0;
                
                console.log(`Dibujando producto #${i+1}: ${producto.nombre || "Sin nombre"}, en Y=${y}, página=${paginaActual}`);
                
                // Calcular espacio necesario para mostrar al menos el producto principal
                const alturaProducto = 30;
                
                // Forzar a dibujar al menos un producto en la primera página
                const espacioDisponible = doc.page.height - doc.page.margins.bottom - y;
                const espacioMinNecesario = alturaProducto;
                
                // Si estamos en la primera página y aún no hemos dibujado ningún producto,
                // intentamos mostrar al menos el producto principal
                const forzarProductoEnPrimeraPagina = paginaActual === 1 && itemsEnPaginaActual === 0;
                
                // Si no hay espacio suficiente PARA EL PRODUCTO PRINCIPAL o hemos alcanzado el límite de elementos por página
                // Y no estamos forzando a mostrar al menos un producto en la primera página
                if ((espacioDisponible < espacioMinNecesario || itemsEnPaginaActual >= productosPorPagina) && 
                    !forzarProductoEnPrimeraPagina) {
                
                  console.log("Creando nueva página. Espacio disponible:", espacioDisponible, 
                              "Espacio necesario mínimo:", espacioMinNecesario,
                              "Items en página:", itemsEnPaginaActual);
                  
                  // Crear nueva página
                  doc.addPage();
                  paginas++;
                  paginaActual++;
                  
                  // Agregar título y cabecera en la nueva página
                  agregarTitulo();
                  y = agregarCabeceraTabla(120);
                  
                  // Resetear contador de elementos en la página
                  itemsEnPaginaActual = 0;
                  productosPorPagina = PRODUCTOS_POR_PAGINA_RESTO;
                }
                
                // Dibujar fondo para este producto (alternar colores)
                const colorFondo = producto.esCombo ? '#e3f2fd' : (i % 2 === 0 ? '#F5F5F5' : '#FFFFFF');
                doc.fillColor(colorFondo).rect(50, y, 500, 30).fill();
                
                // Dibujar datos del producto
                doc.fillColor(producto.esCombo ? '#2c3e50' : '#000000');
                
                if (producto.esCombo) {
                  doc.font('Helvetica-Bold');
                }
                
                const nombre = producto.nombre || 'Producto sin nombre';
                doc.text(nombre, 80, y + 10, { width: 300 });
                doc.text(cantidad.toString(), 400, y + 10);
                
                // Restaurar estilo normal
                doc.font('Helvetica');
                
                // Incrementar posición Y y contador
                y += 30;
                itemsEnPaginaActual++;
                
                // Marcar que ya tenemos al menos un producto en la primera página
                if (paginaActual === 1) {
                  alMenosUnProductoEnPrimeraPagina = true;
                  console.log("Producto principal dibujado en la primera página");
                }
                
                // Si es un combo, dibujar sus componentes
                if (producto.esCombo && producto.componentes && producto.componentes.length > 0) {
                  for (const componente of producto.componentes) {
                    // Verificar si necesitamos nueva página para este componente
                    if (y + 25 > doc.page.height - doc.page.margins.bottom) {
                      console.log("Nueva página para componentes");
                      doc.addPage();
                      paginas++;
                      paginaActual++;
                      
                      agregarTitulo();
                      y = agregarCabeceraTabla(120);
                      
                      itemsEnPaginaActual = 0;
                    }
                    
                    // Dibujar componente
                    doc.fillColor('#FFFFFF').rect(50, y, 500, 25).fill();
                    doc.fillColor('#666666').fontSize(9);
                    doc.text(`- ${componente.nombre}`, 100, y + 8, { width: 280 });
                    doc.text(componente.cantidad.toString(), 400, y + 8);
                    doc.fontSize(10).fillColor('#000000');
                    
                    y += 25;
                    itemsEnPaginaActual++;
                  }
                }
                
              } catch (error) {
                console.error(`Error al dibujar producto #${i+1}:`, error);
                // Continuar con el siguiente producto
              }
            }
            
            // Sección para firmas simplificadas
            if (y + 100 > doc.page.height - doc.page.margins.bottom) {
              // No hay espacio para firmas, crear nueva página
              doc.addPage();
              paginas++;
              y = 150;
            }
            
            // Dibujar líneas para firmas
            y += 50;
            doc.moveTo(100, y).lineTo(250, y).stroke();
            doc.moveTo(350, y).lineTo(500, y).stroke();
            
            // Cambiar nombres de firmas a Supervisor/Operario
            doc.text('Firma de Supervisor', 130, y + 10);
            doc.text('Firma de Operario', 390, y + 10);
            
            // Actualizar total de páginas
            totalPaginas = paginas;
            
            // Numerar páginas
            for (let i = 0; i < totalPaginas; i++) {
              doc.switchToPage(i);
              doc.text(`Página ${i+1} de ${totalPaginas}`, 450, 50);
            }
            
            // Finalizar documento
            finalizarDocumento();
          };
          
          // Función para finalizar el documento de forma segura
          const finalizarDocumento = () => {
            try {
              doc.end();
              console.log("Documento finalizado correctamente");
            } catch (error) {
              console.error("Error al finalizar documento:", error);
              // Intentar resolver con el buffer actual
              const currentBuffer = Buffer.concat(buffers);
              if (currentBuffer.length > 0) {
                resolve(currentBuffer);
              } else {
                reject(new Error('No se pudo generar el PDF: ' + error.message));
              }
            }
          };
          
          // Ejecutar la función principal
          dibujarPDF();
          
        } catch (documentError) {
          console.error("Error en la creación del documento:", documentError);
          reject(documentError);
        }
      }).catch(error => {
        console.error('Error al procesar productos:', error);
        reject(error);
      });

    } catch (error) {
      console.error('Error en generarRemitoPDF:', error);
      reject(error);
    }
  });
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
    
    const pedidoData = {
      _id: pedido._id.toString(),
      numero: pedido.nPedido,
      servicio: pedido.servicio,
      seccionDelServicio: pedido.seccionDelServicio,
      fecha: pedido.fecha,
      // Incluir el objeto cliente completo
      cliente: pedido.cliente,
      // Pasar supervisorId explícitamente
      supervisorId: pedido.supervisorId,
      // Pasamos la referencia completa a pedido para acceder a los datos del supervisor
      pedido: pedido
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
    
    // Usar el servicio de PDF integrado directamente (sin importación externa)
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
    const { from, to, clienteId, productoId, supervisorId } = req.query;
    
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
    const { from, to, clienteId } = req.query;
    
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
    
    // Añadir filtro de cliente si está presente
    if (clienteId) {
      query.$or = [
        { 'cliente.clienteId': clienteId },
        { clienteId: clienteId }
      ];
    }
    
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

// Export all functions
module.exports = {
  downloadRemito,
  downloadExcel,
  downloadReporteMensual
};