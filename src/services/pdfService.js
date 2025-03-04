// src/services/pdfService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Genera un PDF de remito con paginación automática
 * @param {Object} pedidoData - Datos del pedido
 * @param {Object} clienteData - Datos del cliente
 * @param {Array} productos - Lista de productos
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
// Complete generarRemitoPDF function with improved product rendering
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

module.exports = {
  generarRemitoPDF
};