// src/services/pdfService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');

/**
 * Genera un PDF de remito con paginación automática sin mostrar precios
 * @param {Object} pedidoData - Datos del pedido
 * @param {Object} clienteData - Datos del cliente
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
      console.log('Datos de cliente recibidos:', JSON.stringify(clienteData));
      console.log('Cantidad de productos:', productos ? productos.length : 0);
      
      if (!Array.isArray(productos)) {
        console.error('Productos no es un array, es:', typeof productos);
        throw new Error('La lista de productos debe ser un array');
      }
      
      console.log(`Iniciando generación de PDF con ${productos.length} productos`);
      
      // Configuración de documento
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Remito ${pedidoData.numero || pedidoData.nPedido || ''}`,
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
      
      // Manejar errores del documento
      doc.on('error', (err) => {
        console.error('Error en la generación del PDF:', err);
        reject(err);
      });

      // Constantes para paginación
      const PRODUCTOS_POR_PAGINA = 20; // Aumentamos porque ya no mostramos precios
      const totalPaginas = Math.ceil(productos.length / PRODUCTOS_POR_PAGINA);
      let paginaActual = 1;

      // Función para agregar encabezado
      const agregarEncabezado = () => {
        try {
          // Reset to default colors at the beginning
          doc.fillColor('#000000').strokeColor('#000000');
          
          // Título del documento
          try {
            doc.fontSize(24).font('Helvetica-Bold').text('Lyme Depósito', { align: 'center' });
            doc.fontSize(20).font('Helvetica-Bold').text('REMITO', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).font('Helvetica');
          } catch (titleError) {
            console.error('Error al escribir título:', titleError);
            // Continuar con la ejecución
          }

          // Información del cliente
          const nombre = clienteData?.nombre || '';
          const direccion = clienteData?.direccion || '';
          const email = clienteData?.email || '';
          
          doc.text(nombre, 50, 120);
          doc.text(direccion, 50, 140);
          doc.text(email, 50, 160);

          // Dirección de facturación
          doc.text('Dirección de facturación:', 300, 120);
          doc.text(nombre, 300, 140);
          doc.text(direccion, 300, 160);
          
          // Servicios
          doc.text(`Servicios: ${pedidoData.servicio || ''}`, 300, 180);

          // Información del pedido
          const numeroPedido = pedidoData.numero || pedidoData.nPedido || '';
          doc.text(`Número de pedido: ${numeroPedido}`, 300, 200);
          
          // Formatear fecha
          let fechaFormateada = 'Sin fecha';
          try {
            if (pedidoData.fecha) {
              const fecha = new Date(pedidoData.fecha);
              if (!isNaN(fecha.getTime())) {
                const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                fechaFormateada = `${meses[fecha.getMonth()]} ${fecha.getDate()}, ${fecha.getFullYear()}`;
              }
            }
          } catch (fechaError) {
            console.error('Error al formatear fecha:', fechaError);
          }
          
          doc.text(`Fecha de pedido: ${fechaFormateada}`, 300, 220);

          // Agregar paginación
          doc.text(`Página ${paginaActual} de ${totalPaginas}`, 450, 50);

          // Cabecera de tabla (sin precios)
          doc.lineWidth(1);
          doc.fillColor('#000000');
          doc.rect(50, 250, 500, 30).fill();
          
          // Encabezados de columna con texto blanco - Ya no incluimos precios
          doc.fillColor('#FFFFFF');
          doc.text('Producto', 80, 260);
          doc.text('Cantidad', 400, 260);
          
          // Restablecer color de texto a negro
          doc.fillColor('#000000');
        } catch (headerError) {
          console.error('Error al agregar encabezado:', headerError);
          // Continuar con el resto del documento
        }
      };

      // Primera página
      agregarEncabezado();

      // Calcular posición Y de inicio de productos
      let y = 290;

      console.log('Agregando productos al PDF:');
      
      // Verificar que productos sea un array
      if (!Array.isArray(productos) || productos.length === 0) {
        console.warn('No hay productos para agregar al PDF o no es un array válido');
        // Agregar un mensaje en el PDF
        doc.fillColor('#000000');
        doc.text('No hay productos disponibles para este pedido', 80, y + 10);
        doc.end();
        return;
      }

      // Dibujar productos sin mostrar precios
      for (let i = 0; i < productos.length; i++) {
        try {
          const producto = productos[i] || {};
          const cantidad = Number(producto.cantidad) || 0;
          
          console.log(`  Renderizando producto #${i+1}: ${producto.nombre} - Cantidad: ${cantidad}`);
          
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

          // Asegurarse de que el color del texto sea negro
          doc.fillColor('#000000');
          
          // Obtener nombre y valores por defecto si faltan
          const nombre = producto.nombre || 'Producto sin nombre';
          
          // Dibujar datos del producto con alineación - Sin precios
          doc.text(nombre, 80, y + 10);
          doc.text(cantidad.toString(), 400, y + 10);

          // Incrementar posición Y
          y += 30;
        } catch (productoError) {
          console.error(`Error al renderizar producto #${i+1}:`, productoError);
          // Continuar con el siguiente producto
        }
      }

      // Ya no se muestra el total puesto que no incluimos precios
      // Finalizar documento
      console.log('Finalizando documento PDF');
      
      // Intentar cerrar el documento de manera segura
      try {
        doc.end();
        console.log('Documento finalizado correctamente');
      } catch (endError) {
        console.error('Error al finalizar el documento:', endError);
        // Si hay un error al finalizar, resolver con el buffer actual
        const currentBuffer = Buffer.concat(buffers);
        if (currentBuffer.length > 0) {
          resolve(currentBuffer);
        } else {
          reject(new Error('No se pudo generar el PDF: ' + endError.message));
        }
      }

    } catch (error) {
      console.error('Error en generarRemitoPDF:', error);
      reject(error);
    }
  });
};

module.exports = {
  generarRemitoPDF
};