// src/controllers/remitoGeneratorController.js
// Generador de remitos optimizado - Archivo único para producción
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

/**
 * Generar remito oficial según modelo AFIP con diseño optimizado LYME S.A.
 * Función interna - no exportada
 */
const generarRemitoOficial = async (datosRemito) => {
  return new Promise((resolve, reject) => {
    try {
      // Validaciones básicas
      if (!datosRemito || !datosRemito.numeroRemito) {
        throw new Error("Número de remito requerido");
      }
      if (!datosRemito.receptor) {
        throw new Error("Datos del receptor requeridos");
      }
      if (!datosRemito.productos || !Array.isArray(datosRemito.productos)) {
        throw new Error("Lista de productos requerida");
      }

      // Configuración del documento
      const doc = new PDFDocument({
        size: "A4",
        margin: 30,
        bufferPages: true,
        info: {
          Title: `Remito ${datosRemito.numeroRemito}`,
          Author: "LYME S.A.",
          Subject: "Remito Oficial",
          Creator: "Sistema LYME"
        },
      });

      // Recolectar contenido en buffer
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.on("error", (err) => {
        console.error("Error en la generación del PDF:", err);
        reject(err);
      });

      // Ruta del logo
      const logoPath = path.join(process.cwd(), "public", "lyme.png");

      // Función para dibujar rectángulo redondeado
      const drawRoundedRect = (x, y, width, height, radius = 10) => {
        doc.roundedRect(x, y, width, height, radius);
      };

      // Función para formatear fecha
      const formatearFecha = (fecha) => {
        try {
          const date = new Date(fecha || new Date());
          if (isNaN(date.getTime())) return new Date().toLocaleDateString('es-AR');
          return date.toLocaleDateString('es-AR');
        } catch {
          return new Date().toLocaleDateString('es-AR');
        }
      };

      // Usar datos del emisor proporcionados o valores por defecto de LYME S.A.
      // datosRemito.emisor || 
      const emisor = {
        razonSocial: "LYME S.A.",
        cuit: "30-63935839-5",
        condicionIVA: "Resp Inscripto",
        domicilioFiscal: "Av Montes de Oca 1764 9°B",
        telefono: "0221-4829214",
        email: "lymesa@hotmail.com.ar",
        puntoVenta: "0001"
      };

      // INICIO DEL DISEÑO DEL PDF

      // 1. HEADER: Logo y número de remito
      let currentY = 30;

      // Logo LYME S.A. (izquierda)
      try {
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 30, currentY, { width: 120 });
        } else {
          doc.fontSize(24).font('Helvetica-Bold');
          doc.fillColor('#2d8659');
          doc.text('LYME S.A.', 30, currentY + 20);
        }
      } catch (logoError) {
        console.error("Error al cargar logo:", logoError);
        doc.fontSize(24).font('Helvetica-Bold');
        doc.fillColor('#2d8659');
        doc.text('LYME S.A.', 30, currentY + 20);
      }

      // Número de remito (derecha)
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2d8659');
      doc.text(`Remito nro ${datosRemito.numeroRemito}`, 380, currentY + 10, { 
        align: 'right',
        width: 180
      });

      currentY += 80;

      // 2. BLOQUES PRINCIPALES: Emisor y Receptor
      const bloqueHeight = 105; // Ajustado sin líneas
      const bloqueWidth = 260;
      const separacion = 15;

      // BLOQUE EMISOR (izquierda)
      doc.lineWidth(2);
      doc.strokeColor('#2d8659');
      drawRoundedRect(30, currentY, bloqueWidth, bloqueHeight, 15);
      doc.stroke();

      // Fondo sutil para el bloque emisor
      doc.fillColor('#f0f8f0');
      drawRoundedRect(31, currentY + 1, bloqueWidth - 2, bloqueHeight - 2, 14);
      doc.fill();

      // Contenido del emisor
      let emisorY = currentY + 10;
      doc.fillColor('#000000');
      
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(emisor.razonSocial, 40, emisorY);
      
      emisorY += 12;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(`CUIT: ${emisor.cuit}`, 40, emisorY);
      
      emisorY += 10;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(`Condición frente al IVA: ${emisor.condicionIVA}`, 40, emisorY, { width: bloqueWidth - 20 });
      
      emisorY += 10;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(`Domicilio Fiscal: ${emisor.domicilioFiscal}`, 40, emisorY, { width: bloqueWidth - 20 });
      
      emisorY += 10;
      doc.text(`Teléfono: ${emisor.telefono}`, 40, emisorY);
      
      emisorY += 10;
      doc.text(`Email: ${emisor.email}`, 40, emisorY, { width: bloqueWidth - 20 });

      // BLOQUE RECEPTOR (derecha)
      const receptorX = 30 + bloqueWidth + separacion;
      doc.strokeColor('#2d8659');
      drawRoundedRect(receptorX, currentY, bloqueWidth, bloqueHeight, 15);
      doc.stroke();

      // Fondo sutil para el bloque receptor
      doc.fillColor('#f0f8f0');
      drawRoundedRect(receptorX + 1, currentY + 1, bloqueWidth - 2, bloqueHeight - 2, 14);
      doc.fill();

      // Contenido del receptor
      let receptorY = currentY + 10;
      doc.fillColor('#000000');
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Cliente:', receptorX + 10, receptorY);
      doc.fontSize(8).font('Helvetica');
      const clienteNombre = datosRemito.receptor.razonSocial || datosRemito.receptor.nombreCliente || 'Sin especificar';
      doc.text(clienteNombre, receptorX + 45, receptorY, { width: bloqueWidth - 65 });
      
      receptorY += 12;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('CUIT:', receptorX + 10, receptorY);
      doc.fontSize(8).font('Helvetica');
      doc.text(datosRemito.receptor.cuitDni || 'Sin especificar', receptorX + 35, receptorY);
      
      receptorY += 12;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Domicilio:', receptorX + 10, receptorY);
      doc.fontSize(8).font('Helvetica');
      doc.text(datosRemito.receptor.domicilioEntrega || 'Sin especificar', receptorX + 55, receptorY, { width: bloqueWidth - 75 });
      
      receptorY += 12;
      if (datosRemito.receptor.telefono) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Teléfono:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.telefono, receptorX + 55, receptorY);
        receptorY += 10;
      }
      
      if (datosRemito.receptor.email) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Email:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.email, receptorX + 55, receptorY, { width: bloqueWidth - 65 });
        receptorY += 10;
      }
      
      if (datosRemito.receptor.nombreSubServicio) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Subservicio:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.nombreSubServicio, receptorX + 65, receptorY, { width: bloqueWidth - 85 });
        receptorY += 10;
      }
      
      if (datosRemito.receptor.nombreSubUbicacion) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Ubicación:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.nombreSubUbicacion, receptorX + 65, receptorY, { width: bloqueWidth - 75 });
        receptorY += 10;
      }
      
      // Agregar campo de Contacto en destino
      doc.fontSize(9).font('Helvetica-Bold');
      doc.fillColor('#000000');
      doc.text('Contacto en destino:', receptorX + 10, receptorY);
      doc.fontSize(8).font('Helvetica');
      const contactoDestino = datosRemito.receptor.contactoDestino || 'Sin especificar';
      doc.text(contactoDestino, receptorX + 100, receptorY, { width: bloqueWidth - 130 });

      currentY += bloqueHeight + 15;

      // 3. BLOQUE DE TRANSPORTE - Sin líneas de formulario
      const transporteHeight = 90; // Ajustado al contenido sin líneas
      const transporteWidth = 535;
      
      doc.strokeColor('#2d8659');
      drawRoundedRect(30, currentY, transporteWidth, transporteHeight, 15);
      doc.stroke();

      // Fondo sutil para el bloque de transporte
      doc.fillColor('#f0f8f0');
      drawRoundedRect(31, currentY + 1, transporteWidth - 2, transporteHeight - 2, 14);
      doc.fill();

      // Contenido del transporte - Sin líneas
      let transpY = currentY + 12;
      doc.fillColor('#000000');
      
      // Primera fila: Supervisor | Transportista | DNI
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Supervisor:', 40, transpY);
      doc.fontSize(8).font('Helvetica');
      const supervisorNombre = datosRemito.supervisor?.nombre || datosRemito.supervisor?.usuario || 'A definir';
      doc.text(supervisorNombre, 95, transpY);
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Transportista:', 230, transpY);
      doc.fontSize(8).font('Helvetica');
      const transportistaNombre = datosRemito.transporte?.chofer?.nombre || 'A definir';
      doc.text(transportistaNombre, 295, transpY);
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('DNI:', 440, transpY);
      doc.fontSize(8).font('Helvetica');
      const dni = datosRemito.transporte?.chofer?.dni || 'A definir';
      doc.text(dni, 460, transpY);

      transpY += 16; // Reducido de 20

      // Segunda fila: Vehículo
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Vehículo Marca/Modelo/Patente:', 40, transpY);
      doc.fontSize(8).font('Helvetica');
      
      if (datosRemito.transporte?.vehiculo) {
        const vehiculoCompleto = `${datosRemito.transporte.vehiculo.marca || ''} ${datosRemito.transporte.vehiculo.modelo || ''} - Patente: ${datosRemito.transporte.vehiculo.patente || ''}`.trim();
        doc.text(vehiculoCompleto, 180, transpY, { width: 460 });
      } else {
        doc.text('Sin Definir', 180, transpY);
      }

      transpY += 16; // Reducido de 20

      // Tercera fila: Servicio y Fecha
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Servicio:', 40, transpY);
      doc.fontSize(8).font('Helvetica');
      if (datosRemito.servicio) {
        doc.text(datosRemito.servicio, 85, transpY, { width: 210 });
      }
      else {
        doc.text('Sin Definir', 80, transpY);
      }
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Fecha de pedido:', 310, transpY);
      doc.fontSize(8).font('Helvetica');
      doc.text(formatearFecha(datosRemito.fechaEmision), 385, transpY);

      transpY += 16; // Reducido de 20

      // Cuarta fila: Domicilio origen
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Domicilio origen:', 40, transpY);
      doc.fontSize(8).font('Helvetica');
      const origen = datosRemito.transporte?.domicilioOrigen || 'Sin especificar';
      doc.text(origen, 115, transpY, { width: 420 });

      transpY += 16; // Reducido de 20

      // Quinta fila: Domicilio destino
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Domicilio destino:', 40, transpY);
      doc.fontSize(8).font('Helvetica');
      const destino = datosRemito.transporte?.domicilioDestino || 'Sin especificar';
      doc.text(destino, 120, transpY, { width: 415 });

      currentY += transporteHeight + 15;

      // 4. TABLA DE PRODUCTOS
      const tablaY = currentY;
      const tablaHeight = 22;
      const colWidths = [60, 315, 55, 105]; // Ajustado: más espacio para producto, menos para CANT
      let colX = 30;

      // Header de la tabla
      doc.fillColor('#7bc142');
      doc.rect(30, tablaY, 535, tablaHeight).fill();
      
      doc.strokeColor('#2d8659').lineWidth(1);
      doc.rect(30, tablaY, 535, tablaHeight).stroke();

      // Texto del header
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      
      doc.text('UNIDAD', colX + 3, tablaY + 7);
      colX += colWidths[0];
      
      doc.text('PRODUCTO', colX + 3, tablaY + 7);
      colX += colWidths[1];
      
      doc.text('CANT', colX + 15, tablaY + 7); // Centrado en la columna
      colX += colWidths[2];
      
      doc.text('OBSERVACIÓN', colX + 3, tablaY + 7);

      currentY = tablaY + tablaHeight;

      // Función para procesar y mostrar productos
      const procesarProductos = (productos) => {
        const productosExpandidos = [];
        
        for (const producto of productos) {
          // Agregar el producto principal
          productosExpandidos.push({
            unidad: producto.unidad || 'unidades',
            descripcion: producto.descripcion,
            cantidad: producto.cantidad,
            observaciones: producto.observaciones || '',
            esProductoPrincipal: true,
            esCombo: producto.esCombo
          });
          
          // Si es combo y tiene componentes, agregarlos
          if (producto.esCombo && producto.componentes && Array.isArray(producto.componentes)) {
            for (const componente of producto.componentes) {
              productosExpandidos.push({
                unidad: componente.unidad || 'unidades',
                descripcion: `  - ${componente.descripcion}`,
                cantidad: componente.cantidad,
                observaciones: '',
                esProductoPrincipal: false,
                esComponente: true
              });
            }
          }
        }
        
        return productosExpandidos;
      };

      // Procesar productos y dibujar filas
      const productosExpandidos = procesarProductos(datosRemito.productos);
      doc.font('Helvetica').fontSize(8);
      
      // Variables para paginación eficiente
      const ALTURA_FILA = 18;
      const MARGEN_INFERIOR = 100; // Aumentado para dar más espacio al detalle y firmas
      const ALTURA_PAGINA = doc.page.height;
      
      // Dibujar productos
      for (let i = 0; i < productosExpandidos.length; i++) {
        const producto = productosExpandidos[i];
        
        // Verificar si necesitamos nueva página
        if (currentY + ALTURA_FILA > ALTURA_PAGINA - MARGEN_INFERIOR) {
          doc.addPage();
          currentY = 40;
          
          // Header en nueva página
          doc.fillColor('#7bc142');
          doc.rect(30, currentY, 535, tablaHeight).fill();
          doc.strokeColor('#2d8659').lineWidth(1);
          doc.rect(30, currentY, 535, tablaHeight).stroke();
          
          doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
          colX = 30;
          doc.text('UNIDAD', colX + 3, currentY + 7);
          colX += colWidths[0];
          doc.text('PRODUCTO', colX + 3, currentY + 7);
          colX += colWidths[1];
          doc.text('CANT', colX + 15, currentY + 7); // Centrado en la columna
          colX += colWidths[2];
          doc.text('OBSERVACIÓN', colX + 3, currentY + 7);
          
          currentY += tablaHeight;
        }
        
        // Color de fondo
        let colorFondo;
        if (producto.esCombo && producto.esProductoPrincipal) {
          colorFondo = '#b8e6d3';
        } else if (producto.esComponente) {
          colorFondo = '#f0f8f0';
        } else {
          colorFondo = i % 2 === 0 ? '#f0f8f0' : '#ffffff';
        }
        
        doc.fillColor(colorFondo);
        doc.rect(30, currentY, 535, ALTURA_FILA).fill();
        
        doc.strokeColor('#2d8659').lineWidth(0.3);
        doc.rect(30, currentY, 535, ALTURA_FILA).stroke();
        
        // Contenido
        doc.fillColor(producto.esComponente ? '#666666' : '#000000');
        
        if (producto.esCombo && producto.esProductoPrincipal) {
          doc.font('Helvetica-Bold').fontSize(8);
        } else {
          doc.font('Helvetica').fontSize(8);
        }
        
        colX = 30;
        
        doc.text(producto.unidad, colX + 2, currentY + 6, {
          width: colWidths[0] - 4
        });
        colX += colWidths[0];
        
        doc.text(producto.descripcion, colX + 2, currentY + 6, {
          width: colWidths[1] - 4
        });
        colX += colWidths[1];
        
        doc.text(producto.cantidad.toString(), colX + 15, currentY + 6, {
          width: colWidths[2] - 20,
          align: 'center'
        });
        colX += colWidths[2];
        
        doc.text(producto.observaciones || '', colX + 2, currentY + 6, {
          width: colWidths[3] - 4
        });
        
        currentY += ALTURA_FILA;
      }

      // Líneas verticales
      doc.strokeColor('#2d8659').lineWidth(0.3);
      colX = 30;
      for (let i = 0; i < colWidths.length - 1; i++) {
        colX += colWidths[i];
        doc.moveTo(colX, tablaY).lineTo(colX, currentY).stroke();
      }

      currentY += 25; // Más espacio después de la tabla

      // 5. DETALLE - Mejorado con marco visual
      if (datosRemito.detalle) {
        // Verificar si hay espacio suficiente
        const espacioNecesario = 80; // Espacio para detalle + notas + firmas
        if (currentY + espacioNecesario > ALTURA_PAGINA - 40) {
          doc.addPage();
          currentY = 40;
        }

        // Título del detalle
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text('Detalle:', 30, currentY);
        currentY += 15;

        // Calcular altura del detalle
        const detalleOptions = {
          width: 535,
          align: 'left'
        };
        const detalleHeight = doc.heightOfString(datosRemito.detalle, detalleOptions);
        
        // Marco para el detalle
        doc.strokeColor('#2d8659').lineWidth(1);
        drawRoundedRect(30, currentY - 5, 535, detalleHeight + 10, 10);
        doc.stroke();
        
        // Fondo sutil
        doc.fillColor('#fafafa');
        drawRoundedRect(31, currentY - 4, 533, detalleHeight + 8, 9);
        doc.fill();
        
        // Texto del detalle
        doc.fontSize(9).font('Helvetica').fillColor('#000000');
        doc.text(datosRemito.detalle, 35, currentY, detalleOptions);
        
        currentY += detalleHeight + 20;
      }

      // 6. NOTAS/ACLARACIONES - Posicionamiento mejorado
      if (datosRemito.notas && Array.isArray(datosRemito.notas) && datosRemito.notas.length > 0) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666');
        for (const nota of datosRemito.notas) {
          doc.text(nota, 30, currentY, {
            width: 535,
            align: 'center'
          });
          currentY += 12;
        }
        currentY += 15;
      }

      // 7. FIRMAS - Mejor posicionamiento
      // Asegurar que las firmas siempre tengan espacio suficiente
      const espacioFirmas = 60;
      if (currentY + espacioFirmas > ALTURA_PAGINA - 30) {
        doc.addPage();
        currentY = ALTURA_PAGINA - 100; // Posicionar firmas al final de la nueva página
      } else if (currentY < ALTURA_PAGINA - 150) {
        // Si hay mucho espacio, posicionar las firmas más abajo
        currentY = Math.max(currentY + 20, ALTURA_PAGINA - 120);
      }

      // Líneas de firma
      doc.strokeColor('#2d8659').lineWidth(1.5);
      doc.moveTo(70, currentY).lineTo(200, currentY).stroke();
      doc.moveTo(350, currentY).lineTo(480, currentY).stroke();

      // Etiquetas de firma
      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      doc.text('Firma del Emisor', 105, currentY + 10, {
        align: 'center',
        width: 60
      });
      doc.text('Firma del Receptor', 385, currentY + 10, {
        align: 'center',
        width: 60
      });

      // Finalizar documento
      doc.end();

    } catch (error) {
      console.error('Error en generarRemitoOficial:', error);
      reject(error);
    }
  });
};

/**
 * Controller principal para endpoint de generación de remitos
 */
const generarRemito = async (req, res) => {
  try {
    const datosRemito = req.body;

    console.log('Generando remito:', {
      numeroRemito: datosRemito.numeroRemito,
      cliente: datosRemito.receptor?.razonSocial || datosRemito.receptor?.nombreCliente,
      productos: datosRemito.productos?.length || 0
    });

    // Validaciones básicas
    if (!datosRemito.numeroRemito) {
      return res.status(400).json({ 
        mensaje: 'El número de remito es requerido' 
      });
    }

    if (!datosRemito.receptor) {
      return res.status(400).json({ 
        mensaje: 'Los datos del receptor son requeridos' 
      });
    }

    if (!datosRemito.productos || !Array.isArray(datosRemito.productos) || datosRemito.productos.length === 0) {
      return res.status(400).json({ 
        mensaje: 'Debe incluir al menos un producto en el remito' 
      });
    }

    if (!datosRemito.receptor.razonSocial && !datosRemito.receptor.nombreCliente) {
      return res.status(400).json({ 
        mensaje: 'Razón social o nombre del cliente es requerido' 
      });
    }

    if (!datosRemito.receptor.cuitDni) {
      return res.status(400).json({ 
        mensaje: 'CUIT/DNI del receptor es requerido' 
      });
    }

    if (!datosRemito.receptor.domicilioEntrega) {
      return res.status(400).json({ 
        mensaje: 'Domicilio de entrega es requerido' 
      });
    }

    // Generar el PDF del remito
    const pdfBuffer = await generarRemitoOficial(datosRemito);

    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=remito_${datosRemito.numeroRemito.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Enviar el PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar remito:', error);
    res.status(500).json({
      mensaje: 'Error interno al generar el remito',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Solo exportar el controller principal
module.exports = {
  generarRemito
};