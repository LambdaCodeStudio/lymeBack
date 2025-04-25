// src/services/pdfService.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

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
      console.log("Iniciando generación de PDF...");

      // Validar datos de entrada
      if (!pedidoData) {
        throw new Error("Datos de pedido requeridos");
      }

      console.log("Datos de pedido recibidos:", JSON.stringify(pedidoData));
      console.log("Cantidad de productos:", productos ? productos.length : 0);

      if (!Array.isArray(productos)) {
        console.error("Productos no es un array, es:", typeof productos);
        throw new Error("La lista de productos debe ser un array");
      }

      // Función para obtener el supervisor desde su ID (usando userId)
      const obtenerSupervisorData = async (userId) => {
        try {
          if (!userId) return null;
          
          // Obtener el modelo de Usuario
          const User = mongoose.model("User");
          
          // Buscar el supervisor por ID
          const supervisor = await User.findById(userId).select('usuario nombre apellido');
          
          return supervisor;
        } catch (error) {
          console.error("Error al obtener supervisor:", error);
          return null;
        }
      };

      // Función para procesar productos y expandir combos
      const procesarProductos = async (productos) => {
        try {
          const productosExpandidos = [];
          const Producto = mongoose.model("Producto");
          
          // NUEVO: Verificar si hay productos personalizados (combos editados) en metadata
          const productosPersonalizados = pedidoData?.metadata?.productosPersonalizados || [];
          
          // Crear un mapa para búsqueda rápida por ID
          const personalizadosPorId = {};
          productosPersonalizados.forEach(prod => {
            if (prod.productoId) {
              const id = typeof prod.productoId === 'object' 
                ? prod.productoId.toString() 
                : prod.productoId.toString();
              personalizadosPorId[id] = prod;
            }
          });

          for (const producto of productos) {
            // Obtener el ID del producto para comprobar personalizaciones
            const productoId = typeof producto.productoId === 'object' 
              ? producto.productoId._id.toString() 
              : producto.productoId.toString();
            
            // Verificar si este producto tiene una versión personalizada (combo editado)
            const personalizado = personalizadosPorId[productoId];
            
            if (personalizado) {
              // Usar la versión personalizada del combo
              console.log(`Procesando combo personalizado: ${producto.nombre || personalizado.nombre}`);
              
              const productoObj = {
                ...producto,
                nombre: personalizado.nombre || producto.nombre,
                esCombo: true,
                componentes: []
              };
              
              productosExpandidos.push(productoObj);
              
              // Procesar los componentes del combo personalizado
              if (personalizado.comboItems && Array.isArray(personalizado.comboItems)) {
                console.log(`Combo personalizado con ${personalizado.comboItems.length} componentes`);
                
                for (const item of personalizado.comboItems) {
                  try {
                    productoObj.componentes.push({
                      nombre: item.nombre,
                      cantidad: item.cantidad * producto.cantidad // Multiplicar por la cantidad del combo
                    });
                  } catch (error) {
                    console.error('Error al procesar componente de combo personalizado:', error);
                  }
                }
              }
            } else {
              // Procesamiento estándar para productos normales y combos no editados
              const productoObj = {
                ...producto,
                esCombo: producto.productoId && producto.productoId.esCombo === true,
                componentes: [],
              };

              productosExpandidos.push(productoObj);

              // Si es un combo, obtener sus componentes
              if (
                productoObj.esCombo &&
                producto.productoId &&
                producto.productoId.itemsCombo &&
                Array.isArray(producto.productoId.itemsCombo)
              ) {
                console.log(
                  `Procesando combo: ${producto.nombre} con ${producto.productoId.itemsCombo.length} componentes`
                );

                // Para cada componente del combo, obtener sus detalles
                for (const item of producto.productoId.itemsCombo) {
                  try {
                    if (!item.productoId) continue;

                    // Si el componente ya está poblado
                    if (
                      typeof item.productoId === "object" &&
                      item.productoId.nombre
                    ) {
                      productoObj.componentes.push({
                        nombre: item.productoId.nombre,
                        cantidad: item.cantidad * producto.cantidad, // Multiplicar por la cantidad del combo
                      });
                    } else {
                      // Si necesitamos poblar el componente
                      const id =
                        typeof item.productoId === "object"
                          ? item.productoId._id
                          : item.productoId;
                      const componenteProducto = await Producto.findById(
                        id
                      ).select("nombre");

                      if (componenteProducto) {
                        productoObj.componentes.push({
                          nombre: componenteProducto.nombre,
                          cantidad: item.cantidad * producto.cantidad, // Multiplicar por la cantidad del combo
                        });
                      }
                    }
                  } catch (compError) {
                    console.error(
                      `Error al procesar componente de combo:`,
                      compError
                    );
                    // Continuar con el siguiente componente
                  }
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

      // Obtener datos del supervisor si existe el ID del usuario
      let supervisorData = null;
      if (pedidoData.userId) {
        // Intentar obtener los datos del supervisor
        obtenerSupervisorData(pedidoData.userId)
          .then(supervisor => {
            supervisorData = supervisor;
            console.log("Supervisor obtenido:", supervisorData);
          })
          .catch(error => {
            console.error("Error al obtener supervisor:", error);
          });
      }

      console.log(
        `Iniciando generación de PDF con ${productos.length} productos`
      );

      // Procesar productos y expandir combos
      procesarProductos(productos)
        .then((productosExpandidos) => {
          try {
            // Configuración de documento con márgenes reducidos
            const doc = new PDFDocument({
              size: "A4",
              margin: 30, // Reducido de 50 a 30 para aprovechar más espacio
              bufferPages: true, // Importante para poder numerar páginas al final
              info: {
                Title: `Remito ${
                  pedidoData.numero || pedidoData.nPedido || ""
                }`,
                Author: "Lyme S.A",
              },
            });

            // Recolectar contenido en un buffer
            const buffers = [];
            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => {
              const pdfData = Buffer.concat(buffers);
              console.log("PDF generado exitosamente, tamaño:", pdfData.length);
              resolve(pdfData);
            });

            // Manejar errores del documento
            doc.on("error", (err) => {
              console.error("Error en la generación del PDF:", err);
              reject(err);
            });

            // Ruta al logo de la empresa
            const logoPath = path.join(process.cwd(), "public", "lyme.png");

            // Variables de paginación y posicionamiento
            let paginaActual = 1;
            let paginas = 1;
            let totalPaginas = 1; // Se calculará correctamente al final

            // Función para agregar el título del documento
            const agregarTitulo = () => {
              // Agregar logo si existe (tamaño reducido)
              try {
                if (fs.existsSync(logoPath)) {
                  doc.image(logoPath, 30, 30, { width: 120 }); // Reducido de 150 a 120
                } else {
                  console.warn("Logo no encontrado en:", logoPath);
                }
              } catch (logoError) {
                console.error("Error al agregar logo:", logoError);
              }

              // Agregar número de pedido a la derecha
              const numeroPedido = pedidoData.numero || pedidoData.nPedido || '';
              doc.font('Helvetica-Bold').fontSize(10); // Reducido de 12 a 10
              doc.text(`Remito N°: ${numeroPedido}`, 350, 50, { align: 'right' });
              
              doc.moveDown();
              doc.fontSize(9).font("Helvetica"); // Reducido de 12 a 9
            };

            // Función para agregar información del pedido incluyendo cliente, subservicio y sububicación
            const agregarInfoPedido = () => {
              const y = 90; // Reducido de 120 a 90
              
              // Dividimos la página en dos columnas (optimizadas para más espacio)
              const colIzquierda = 30;  // Ajustado por el margen reducido
              const colDerecha = 280;   // Ajustado para más espacio
              const anchoTexto = 240;   // Incrementado para usar más del ancho
              
              // COLUMNA IZQUIERDA: Cliente y Subservicio
              
              // Cliente - Acceder correctamente a la estructura
              doc.fontSize(8).font('Helvetica-Bold').text('Cliente:', colIzquierda, y); // Reducido tamaño
              
              // Primero intentamos acceder a cliente.nombreCliente (estructura nueva)
              if (pedidoData.cliente && pedidoData.cliente.nombreCliente) {
                doc.font('Helvetica').text(pedidoData.cliente.nombreCliente, colIzquierda + 50, y, { width: anchoTexto, ellipsis: true }); // Offset reducido
              } 
              // Si no está disponible, usamos el campo servicio (estructura antigua)
              else if (pedidoData.servicio) {
                // Manejar si servicio es un array o string
                const servicioText = Array.isArray(pedidoData.servicio) 
                  ? pedidoData.servicio.join(', ') 
                  : pedidoData.servicio;
                doc.font('Helvetica').text(servicioText || 'No especificado', colIzquierda + 50, y, { width: anchoTexto, ellipsis: true });
              } else {
                doc.font('Helvetica').text('No especificado', colIzquierda + 50, y, { width: anchoTexto });
              }
              
              // Agregar subservicio si está disponible
              let currentY = y + 15; // Reducido espacio vertical
              if (pedidoData.cliente && pedidoData.cliente.nombreSubServicio) {
                doc.fontSize(8).font('Helvetica-Bold').text('Subservicio:', colIzquierda, currentY);
                doc.font('Helvetica').text(pedidoData.cliente.nombreSubServicio, colIzquierda + 50, currentY, { width: anchoTexto, ellipsis: true });
                currentY += 15; // Reducido espacio vertical
              } 
              // Si no, intentar usar seccionDelServicio
              else if (pedidoData.seccionDelServicio && pedidoData.seccionDelServicio.trim() !== '' && pedidoData.seccionDelServicio !== 'Sin especificar') {
                doc.fontSize(8).font('Helvetica-Bold').text('Subservicio:', colIzquierda, currentY);
                doc.font('Helvetica').text(pedidoData.seccionDelServicio, colIzquierda + 50, currentY, { width: anchoTexto, ellipsis: true });
                currentY += 15; // Reducido espacio vertical
              }
              
              // Agregar sububicación si está disponible
              if (pedidoData.cliente && pedidoData.cliente.nombreSubUbicacion) {
                doc.fontSize(8).font('Helvetica-Bold').text('Ubicación:', colIzquierda, currentY);
                doc.font('Helvetica').text(pedidoData.cliente.nombreSubUbicacion, colIzquierda + 50, currentY, { width: anchoTexto, ellipsis: true });
                currentY += 15; // Reducido espacio vertical
              }
              
              // COLUMNA DERECHA: Supervisor y Fecha de pedido
              
              // Obtener el nombre del supervisor - Mejorado para resolver desde el ID apropiadamente
              let supervisorNombre = 'No especificado';
              
              // Primero verificamos si ya tenemos los datos del supervisor
              if (supervisorData) {
                if (supervisorData.nombre && supervisorData.apellido) {
                  supervisorNombre = `${supervisorData.nombre} ${supervisorData.apellido}`;
                } else if (supervisorData.usuario) {
                  supervisorNombre = supervisorData.usuario;
                }
              } 
              // Si no, intentamos extraer desde lo que venga en el pedido
              else if (pedidoData.userId) {
                if (typeof pedidoData.userId === 'object') {
                  if (pedidoData.userId.usuario) {
                    supervisorNombre = pedidoData.userId.usuario;
                  } else if (pedidoData.userId.nombre) {
                    supervisorNombre = pedidoData.userId.apellido ? 
                      `${pedidoData.userId.nombre} ${pedidoData.userId.apellido}` :
                      pedidoData.userId.nombre;
                  }
                } else {
                  // Es solo un ID, se mostrará "No especificado"
                  console.log("Solo se recibió ID de usuario:", pedidoData.userId);
                }
              }
              
              // Agregamos el supervisor y fecha en la columna derecha
              doc.fontSize(8).font('Helvetica-Bold').text('Supervisor:', colDerecha, y);
              doc.font('Helvetica').text(supervisorNombre, colDerecha + 60, y, { width: anchoTexto, ellipsis: true });
              
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
              
              // Fecha de pedido (en la columna derecha)
              doc.fontSize(8).font('Helvetica-Bold').text('Fecha de pedido:', colDerecha, y + 15);
              doc.font('Helvetica').text(fechaFormateada, colDerecha + 85, y + 15, { width: anchoTexto - 55 });
              
              // Devolver la posición Y más baja entre ambas columnas para continuar dibujando
              return Math.max(currentY, y + 30);
            };

            // Función para agregar la cabecera de la tabla de productos
            const agregarCabeceraTabla = (posY) => {
              // Cabecera de tabla con color atractivo
              doc.lineWidth(1);
              doc.fillColor('#3498db'); // Azul para cabecera
              doc.roundedRect(30, posY, 540, 20, 3).fill(); // Ancho mayor, altura menor
              
              // Encabezados de columna con texto blanco
              doc.fillColor('#FFFFFF');
              doc.fontSize(9).font('Helvetica-Bold'); // Reducido tamaño
              doc.text('Producto', 50, posY + 6); // Ajustado Y
              doc.text('Cantidad', 450, posY + 6); // Posición más a la derecha
              
              // Restablecer color de texto a negro
              doc.fillColor('#000000').font('Helvetica');

              return posY + 20; // Devolver la nueva posición Y (altura reducida)
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
                doc.text('No hay productos disponibles para este pedido', 50, y + 10);
                // Finalizar y retornar
                finalizarDocumento();
                return;
              }
              
              // Variables para seguimiento - AUMENTADO considerablemente
              const PRODUCTOS_POR_PAGINA_PRIMERA = 35; // Aumentado de 12 a 20
              const PRODUCTOS_POR_PAGINA_RESTO = 35;   // Aumentado de 25 a 35
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
                  const alturaProducto = 15; // Reducido de 30 a 20
                  
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
                    y = agregarCabeceraTabla(90); // Ajustado de 120 a 90
                    
                    // Resetear contador de elementos en la página
                    itemsEnPaginaActual = 0;
                    productosPorPagina = PRODUCTOS_POR_PAGINA_RESTO;
                  }
                  
                  // Dibujar fondo para este producto (alternar colores)
                  const colorFondo = producto.esCombo ? '#e3f2fd' : (i % 2 === 0 ? '#F5F5F5' : '#FFFFFF');
                  doc.fillColor(colorFondo).rect(30, y, 540, 20).fill(); // Ancho mayor, altura menor
                  
                  // Dibujar datos del producto
                  doc.fillColor(producto.esCombo ? '#2c3e50' : '#000000');
                  
                  if (producto.esCombo) {
                    doc.font('Helvetica-Bold');
                  }
                  
                  const nombre = producto.nombre || 'Producto sin nombre';
                  doc.fontSize(8); // Tamaño reducido
                  doc.text(nombre, 50, y + 6, { width: 380 }); // Más ancho para el nombre
                  doc.text(cantidad.toString(), 450, y + 6); // Posición ajustada
                  
                  // Restaurar estilo normal
                  doc.font('Helvetica');
                  
                  // Incrementar posición Y y contador
                  y += 20; // Reducido de 30 a 20
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
                      if (y + 16 > doc.page.height - doc.page.margins.bottom) { // Altura reducida
                        console.log("Nueva página para componentes");
                        doc.addPage();
                        paginas++;
                        paginaActual++;
                        
                        agregarTitulo();
                        y = agregarCabeceraTabla(90);
                        
                        itemsEnPaginaActual = 0;
                      }
                      
                      // Dibujar componente con tamaño reducido
                      doc.fillColor('#FFFFFF').rect(30, y, 540, 16).fill();
                      doc.fillColor('#666666').fontSize(7); // Tamaño reducido
                      doc.text(`- ${componente.nombre}`, 70, y + 5, { width: 360 });
                      doc.text(componente.cantidad.toString(), 450, y + 5);
                      doc.fontSize(8).fillColor('#000000');
                      
                      y += 16; // Reducido de 25 a 16
                      itemsEnPaginaActual++;
                    }
                  }
                  
                } catch (error) {
                  console.error(`Error al dibujar producto #${i+1}:`, error);
                  // Continuar con el siguiente producto
                }
              }
              
              // Calcular espacio restante y verificar si las firmas caben
              const espacioRestante = doc.page.height - doc.page.margins.bottom - y;
              
              // Sección para firmas y detalle - optimizada para aprovechar espacio vertical
              if (espacioRestante < 75) { // Reducido de 200 a 150 para ser más eficiente
                // No hay espacio para firmas, crear nueva página
                doc.addPage();
                paginas++;
                y = 150;
              } else {
                // Si hay espacio pero es mucho, reducirlo
                if (espacioRestante > 100) {
                  y = doc.page.height - doc.page.margins.bottom - 150;
                } else {
                  y += 20; // Solo un pequeño espacio
                }
              }
              
              // Dibujar líneas para firmas
              doc.moveTo(80, y).lineTo(230, y).stroke();
              doc.moveTo(350, y).lineTo(500, y).stroke();
              
              // Cambiar nombres de firmas a Supervisor/Operario
              doc.fontSize(8);
              doc.text('Firma de Supervisor', 110, y + 5);
              doc.text('Firma de Operario', 390, y + 5);
              
              // Agregar detalle si existe
              y += 30; // Reducido de 50 a 30
              doc.font('Helvetica-Bold').text('Detalle:', 30, y);
              doc.font('Helvetica');
              
              // Obtener detalle del pedido, con manejo de posibles undefined
              const detalle = pedidoData.detalle || 'Sin detalle';
              
              // Dibujar detalle con ajuste de texto
              doc.text(detalle, 30, y + 15, {
                width: 540, // Mayor ancho
                align: 'left'
              });
              
              // Actualizar total de páginas
              totalPaginas = paginas;
              
              // Numerar páginas (tamaño reducido)
              for (let i = 0; i < totalPaginas; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).text(`Página ${i+1} de ${totalPaginas}`, 450, 30);
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
        })
        .catch(error => {
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
  generarRemitoPDF,
};
