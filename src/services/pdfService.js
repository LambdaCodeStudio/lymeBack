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

module.exports = {
  generarRemitoPDF
};