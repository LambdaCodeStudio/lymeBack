// src/services/pdfService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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
            
            // Título del documento centrado
            doc.fontSize(24).font('Helvetica-Bold').text('Lyme S.A', 50, 50, { align: 'center' });
            doc.fontSize(20).font('Helvetica-Bold').text('REMITO', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).font('Helvetica');
          };

          // Función para agregar información del cliente y pedido (solo primera página)
          const agregarInfoClientePedido = () => {
            // Información del cliente con un recuadro
            doc.roundedRect(50, 120, 225, 70, 5).stroke();
            doc.fontSize(10).font('Helvetica-Bold').text('DATOS DEL CLIENTE:', 60, 130);
            doc.font('Helvetica');
            
            const nombre = clienteData?.nombre || 'Sin nombre';
            const direccion = clienteData?.direccion || '';
            const email = clienteData?.email || '';
            
            // Ajustar el texto para que no se salga del recuadro
            const anchoDisponible = 205; // 225 - 20 (margen)
            
            doc.text(nombre, 60, 150, { width: anchoDisponible });
            doc.text(direccion, 60, 170, { width: anchoDisponible, ellipsis: true });
            
            // Dirección de facturación con un recuadro
            doc.roundedRect(300, 120, 225, 70, 5).stroke();
            doc.fontSize(10).font('Helvetica-Bold').text('DIRECCIÓN DE FACTURACIÓN:', 310, 130);
            doc.font('Helvetica');
            doc.text(nombre, 310, 150, { width: 205, ellipsis: true });
            doc.text(direccion, 310, 170, { width: 205, ellipsis: true });

            // Servicios, número de pedido y fecha - Fuera de los recuadros
            const y = 200; // Posición Y debajo de los recuadros
            
            doc.fontSize(10).font('Helvetica-Bold').text('Servicio:', 300, y);
            doc.font('Helvetica').text(pedidoData.servicio || '', 350, y, { width: 170, ellipsis: true });
            
            const numeroPedido = pedidoData.numero || pedidoData.nPedido || '';
            doc.fontSize(10).font('Helvetica-Bold').text('Número de pedido:', 300, y + 20);
            doc.font('Helvetica').text(numeroPedido, 400, y + 20, { width: 100 });
            
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
            
            doc.fontSize(10).font('Helvetica-Bold').text('Fecha de pedido:', 300, y + 40);
            doc.font('Helvetica').text(fechaFormateada, 400, y + 40, { width: 140 });
            
            return y + 60; // Devolver la posición Y después de toda la información
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
            // Primera página - encabezado y datos de cliente
            agregarTitulo();
            let y = agregarInfoClientePedido();
            
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
            const PRODUCTOS_POR_PAGINA_PRIMERA = 10; // Aumentado para permitir más en primera página
            const PRODUCTOS_POR_PAGINA_RESTO = 20;   // Aumentado para mayor densidad en páginas subsiguientes
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
                // Solo verificamos si hay espacio para el producto principal, no para todos sus componentes
                const espacioDisponible = doc.page.height - doc.page.margins.bottom - y;
                const espacioMinNecesario = alturaProducto;
                
                // PRIMERA MEJORA CRÍTICA:
                // Si estamos en la primera página (paginaActual === 1) y aún no hemos dibujado ningún producto 
                // (itemsEnPaginaActual === 0), intentamos mostrar al menos el producto principal
                // sin importar cuántos componentes tenga
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
                
                // TERCERA MEJORA CRÍTICA:
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
            
            // Sección para firmas
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
            
            doc.text('Firma de Responsable', 130, y + 10);
            doc.text('Firma de Cliente', 390, y + 10);
            
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

module.exports = {
  generarRemitoPDF
};









