// test-remito.js
// Script independiente para probar la generación de remitos
// Ejecutar con: node test-remito.js

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ========================================
// DATOS DE PRUEBA CON 20 PRODUCTOS VARIADOS
// ========================================
const datosRemitoTest = {
  "numeroRemito": "R-00001234",
  "fechaEmision": "2025-06-03T14:30:00.000Z",
  "emisor": {
    "razonSocial": "LYME S.A.",
    "cuit": "30-12345678-9",
    "condicionIVA": "Responsable Inscripto",
    "domicilioFiscal": "Av. Ejemplo 1234, Buenos Aires",
    "telefono": "+54 11 1234-5678",
    "email": "contacto@lyme.com.ar",
    "puntoVenta": "0001"
  },
  "receptor": {
    "razonSocial": "CLIENTE EJEMPLO S.R.L.",
    "cuitDni": "20-87654321-0",
    "domicilioEntrega": "Av. Corrientes 5678, CABA",
    "telefono": "+54 11 8765-4321",
    "email": "cliente@ejemplo.com",
    "nombreCliente": "Cliente Principal",
    "nombreSubServicio": "Sector Norte",
    "nombreSubUbicacion": "Oficina 5to Piso"
  },
  "productos": [
    // Productos individuales
    {
      "descripcion": "Filtro de aire industrial HEPA",
      "cantidad": 12,
      "unidad": "unidades",
      "observaciones": "Verificar medidas",
      "esCombo": false
    },
    {
      "descripcion": "Aceite hidráulico SAE 32",
      "cantidad": 25,
      "unidad": "litros",
      "observaciones": "",
      "esCombo": false
    },
    {
      "descripcion": "Correa de transmisión tipo A",
      "cantidad": 8,
      "unidad": "metros",
      "observaciones": "Para motor principal",
      "esCombo": false
    },
    {
      "descripcion": "Rodamiento 6205-2RS",
      "cantidad": 24,
      "unidad": "unidades",
      "observaciones": "",
      "esCombo": false
    },
    {
      "descripcion": "Cable eléctrico 3x2.5mm",
      "cantidad": 100,
      "unidad": "metros",
      "observaciones": "Color negro",
      "esCombo": false
    },
    
    // Combo de mantenimiento básico
    {
      "descripcion": "Kit Mantenimiento Bomba Centrífuga",
      "cantidad": 3,
      "unidad": "kits",
      "observaciones": "Para bomba modelo BC-500",
      "esCombo": true,
      "componentes": [
        {
          "descripcion": "Junta tórica principal",
          "cantidad": 6,
          "unidad": "unidades"
        },
        {
          "descripcion": "Impeller de bronce",
          "cantidad": 3,
          "unidad": "unidades"
        },
        {
          "descripcion": "Tornillería inoxidable",
          "cantidad": 1,
          "unidad": "juegos"
        },
        {
          "descripcion": "Manual de instalación",
          "cantidad": 3,
          "unidad": "unidades"
        }
      ]
    },
    
    {
      "descripcion": "Válvula esférica 2 pulgadas",
      "cantidad": 6,
      "unidad": "unidades",
      "observaciones": "Rosca NPT",
      "esCombo": false
    },
    {
      "descripcion": "Grasa multiuso base litio",
      "cantidad": 10,
      "unidad": "kg",
      "observaciones": "",
      "esCombo": false
    },
    
    // Combo eléctrico complejo
    {
      "descripcion": "Kit Instalación Eléctrica Completa",
      "cantidad": 2,
      "unidad": "kits",
      "observaciones": "Para sala de máquinas",
      "esCombo": true,
      "componentes": [
        {
          "descripcion": "Tablero eléctrico IP65",
          "cantidad": 2,
          "unidad": "unidades"
        },
        {
          "descripcion": "Disyuntor tripolar 25A",
          "cantidad": 6,
          "unidad": "unidades"
        },
        {
          "descripcion": "Contactor 3P 40A",
          "cantidad": 4,
          "unidad": "unidades"
        },
        {
          "descripcion": "Relé térmico 32-40A",
          "cantidad": 4,
          "unidad": "unidades"
        },
        {
          "descripcion": "Cable comando 7x1.5mm",
          "cantidad": 50,
          "unidad": "metros"
        },
        {
          "descripcion": "Borneras de conexión",
          "cantidad": 20,
          "unidad": "unidades"
        },
        {
          "descripcion": "Etiquetas identificadoras",
          "cantidad": 1,
          "unidad": "rollo"
        }
      ]
    },
    
    {
      "descripcion": "Sensor de temperatura PT100",
      "cantidad": 4,
      "unidad": "unidades",
      "observaciones": "Rango -50°C a +200°C",
      "esCombo": false
    },
    {
      "descripcion": "Manguera hidráulica 1/2 pulgada",
      "cantidad": 30,
      "unidad": "metros",
      "observaciones": "Presión máx 210 bar",
      "esCombo": false
    },
    
    // Combo de herramientas
    {
      "descripcion": "Kit Herramientas Mantenimiento",
      "cantidad": 1,
      "unidad": "kit",
      "observaciones": "Caja de herramientas incluida",
      "esCombo": true,
      "componentes": [
        {
          "descripcion": "Llave inglesa 12 pulgadas",
          "cantidad": 2,
          "unidad": "unidades"
        },
        {
          "descripcion": "Destornilladores surtidos",
          "cantidad": 1,
          "unidad": "juego"
        },
        {
          "descripcion": "Alicate universal 8 pulgadas",
          "cantidad": 2,
          "unidad": "unidades"
        },
        {
          "descripcion": "Martillo de goma 500gr",
          "cantidad": 1,
          "unidad": "unidad"
        },
        {
          "descripcion": "Cinta métrica 5m",
          "cantidad": 1,
          "unidad": "unidad"
        }
      ]
    },
    
    {
      "descripcion": "Filtro de combustible",
      "cantidad": 15,
      "unidad": "unidades",
      "observaciones": "Para grupo electrógeno",
      "esCombo": false
    },
    {
      "descripcion": "Anticongelante refrigerante",
      "cantidad": 40,
      "unidad": "litros",
      "observaciones": "Concentrado 1:1",
      "esCombo": false
    },
    
    // Combo de seguridad
    {
      "descripcion": "Kit Elementos Protección Personal",
      "cantidad": 5,
      "unidad": "kits",
      "observaciones": "Para equipo técnico",
      "esCombo": true,
      "componentes": [
        {
          "descripcion": "Casco de seguridad blanco",
          "cantidad": 5,
          "unidad": "unidades"
        },
        {
          "descripcion": "Gafas protectoras",
          "cantidad": 5,
          "unidad": "unidades"
        },
        {
          "descripcion": "Guantes dieléctricos",
          "cantidad": 5,
          "unidad": "pares"
        },
        {
          "descripcion": "Chaleco reflectivo",
          "cantidad": 5,
          "unidad": "unidades"
        },
        {
          "descripcion": "Botín de seguridad",
          "cantidad": 5,
          "unidad": "pares"
        }
      ]
    },
    
    {
      "descripcion": "Sellador de roscas Loctite",
      "cantidad": 12,
      "unidad": "tubos",
      "observaciones": "Resistencia media",
      "esCombo": false
    },
    {
      "descripcion": "Manómetro 0-16 bar",
      "cantidad": 8,
      "unidad": "unidades",
      "observaciones": "Glicerina",
      "esCombo": false
    },
    
    // Combo de limpieza industrial
    {
      "descripcion": "Kit Limpieza y Mantenimiento Industrial",
      "cantidad": 2,
      "unidad": "kits",
      "observaciones": "Mensual",
      "esCombo": true,
      "componentes": [
        {
          "descripcion": "Desengrasante industrial",
          "cantidad": 4,
          "unidad": "litros"
        },
        {
          "descripcion": "Trapos industriales",
          "cantidad": 2,
          "unidad": "paquetes"
        },
        {
          "descripcion": "Escobillas metálicas",
          "cantidad": 6,
          "unidad": "unidades"
        },
        {
          "descripcion": "Spray penetrante",
          "cantidad": 4,
          "unidad": "aerosoles"
        }
      ]
    },
    
    {
      "descripcion": "Termostato para intercambiador",
      "cantidad": 3,
      "unidad": "unidades",
      "observaciones": "Rango 60-90°C",
      "esCombo": false
    },
    {
      "descripcion": "Junta espiral metalizada",
      "cantidad": 20,
      "unidad": "unidades",
      "observaciones": "DN50 PN16",
      "esCombo": false
    }
  ],
  "transporte": {
    "domicilioOrigen": "Depósito Central - Av. Ejemplo 1234",
    "domicilioDestino": "Av. Corrientes 5678, CABA",
    "vehiculo": {
      "marca": "Ford",
      "modelo": "Transit",
      "patente": "ABC123"
    },
    "chofer": {
      "nombre": "Juan Pérez",
      "dni": "12345678"
    }
  },
  "supervisor": {
    "nombre": "María González",
    "usuario": "mgonzalez"
  },
  "detalle": "Entrega programada para horario de oficina entre 8:00 y 17:00 hs. Coordinar con encargado de mantenimiento. Algunos elementos requieren manipulación cuidadosa.",
  "notas": [
    "No se genera COT por no cumplirse los requisitos establecidos en la Resolución Normativa 27/23 de ARBA."
  ]
};

// ========================================
// SERVICIO DE GENERACIÓN DE PDF
// ========================================
const generarRemitoOficial = async (datosRemito) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('🚀 Iniciando generación de remito...');
      
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

      console.log('✅ Validaciones básicas completadas');

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
        console.log('✅ PDF generado exitosamente');
        resolve(pdfData);
      });

      doc.on("error", (err) => {
        console.error("❌ Error en la generación del PDF:", err);
        reject(err);
      });

      // Buscar logo en la ruta correcta
      const logoPath = path.join(process.cwd(), "public", "lyme.png");
      const logoExists = fs.existsSync(logoPath);
      
      if (logoExists) {
        console.log('✅ Logo encontrado:', logoPath);
      } else {
        console.log('⚠️ Logo no encontrado, usando texto en su lugar');
      }

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
      const emisor = datosRemito.emisor || {
        razonSocial: "LYME S.A.",
        cuit: "30-63935839-5",
        condicionIVA: "Resp Inscripto",
        domicilioFiscal: "Av Montes de Oca 1764 9°B",
        telefono: "0221-4829214",
        email: "lymesa@hotmail.com.ar",
        puntoVenta: "0001"
      };

      console.log('📄 Iniciando dibujo del PDF...');

      // INICIO DEL DISEÑO DEL PDF

      // 1. HEADER: Logo y número de remito
      let currentY = 30;

      // Logo LYME S.A. (izquierda)
      try {
        if (logoExists) {
          doc.image(logoPath, 30, currentY, { width: 120 });
        } else {
          // Si no hay logo, dibujar el texto LYME con color verde
          doc.fontSize(24).font('Helvetica-Bold');
          doc.fillColor('#2d8659'); // Verde oscuro
          doc.text('LYME S.A.', 30, currentY + 20);
        }
      } catch (logoError) {
        console.error("Error al cargar logo:", logoError);
        doc.fontSize(24).font('Helvetica-Bold');
        doc.fillColor('#2d8659'); // Verde oscuro
        doc.text('LYME S.A.', 30, currentY + 20);
      }

      // Número de remito (derecha) con color verde
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2d8659'); // Verde oscuro
      doc.text(`Remito nro ${datosRemito.numeroRemito}`, 380, currentY + 10, { 
        align: 'right',
        width: 180
      });

      currentY += 80;

      // 2. BLOQUES PRINCIPALES: Emisor y Receptor - OPTIMIZADO
      const bloqueHeight = 100; // Reducido de 140 a 100
      const bloqueWidth = 260;
      const separacion = 15;

      // BLOQUE EMISOR (izquierda) con color verde
      doc.lineWidth(2);
      doc.strokeColor('#2d8659');
      drawRoundedRect(30, currentY, bloqueWidth, bloqueHeight, 15);
      doc.stroke();

      // Fondo sutil para el bloque emisor
      doc.fillColor('#f0f8f0');
      drawRoundedRect(31, currentY + 1, bloqueWidth - 2, bloqueHeight - 2, 14);
      doc.fill();

      // Contenido del emisor - ARREGLADO
      let emisorY = currentY + 10;
      doc.fillColor('#000000'); // IMPORTANTE: Restablecer color de texto
      
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(emisor.razonSocial, 40, emisorY);
      
      emisorY += 12;
      doc.fontSize(8).font('Helvetica');
      doc.text(`CUIT: ${emisor.cuit}`, 40, emisorY);
      
      emisorY += 10;
      doc.text(`${emisor.condicionIVA}`, 40, emisorY);
      
      emisorY += 10;
      doc.text(`Domicilio Fiscal: ${emisor.domicilioFiscal}`, 40, emisorY, { width: bloqueWidth - 20 });
      
      emisorY += 10;
      doc.text(`Teléfono: ${emisor.telefono}`, 40, emisorY);
      
      emisorY += 10;
      doc.text(`Email: ${emisor.email}`, 40, emisorY, { width: bloqueWidth - 20 });

      // BLOQUE RECEPTOR (derecha) - ARREGLADO
      const receptorX = 30 + bloqueWidth + separacion;
      doc.strokeColor('#2d8659');
      drawRoundedRect(receptorX, currentY, bloqueWidth, bloqueHeight, 15);
      doc.stroke();

      // Fondo sutil para el bloque receptor
      doc.fillColor('#f0f8f0');
      drawRoundedRect(receptorX + 1, currentY + 1, bloqueWidth - 2, bloqueHeight - 2, 14);
      doc.fill();

      // Contenido del receptor - ARREGLADO Y COMPLETO
      let receptorY = currentY + 10;
      doc.fillColor('#000000'); // IMPORTANTE: Restablecer color de texto
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Cliente:', receptorX + 10, receptorY);
      doc.fontSize(8).font('Helvetica');
      const clienteNombre = datosRemito.receptor.razonSocial || datosRemito.receptor.nombreCliente || 'No especificado';
      doc.text(clienteNombre, receptorX + 50, receptorY, { width: bloqueWidth - 60 });
      
      receptorY += 12;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('CUIT:', receptorX + 10, receptorY);
      doc.fontSize(8).font('Helvetica');
      doc.text(datosRemito.receptor.cuitDni || 'No especificado', receptorX + 50, receptorY);
      
      receptorY += 12;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Domicilio:', receptorX + 10, receptorY);
      doc.fontSize(8).font('Helvetica');
      doc.text(datosRemito.receptor.domicilioEntrega || 'No especificado', receptorX + 60, receptorY, { width: bloqueWidth - 70 });
      
      receptorY += 12;
      if (datosRemito.receptor.telefono) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Teléfono:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.telefono, receptorX + 60, receptorY);
        receptorY += 10;
      }
      
      // Email
      if (datosRemito.receptor.email) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Email:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.email, receptorX + 50, receptorY, { width: bloqueWidth - 60 });
        receptorY += 10;
      }
      
      // Subservicio
      if (datosRemito.receptor.nombreSubServicio) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Subservicio:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.nombreSubServicio, receptorX + 70, receptorY, { width: bloqueWidth - 80 });
        receptorY += 10;
      }
      
      // Ubicación
      if (datosRemito.receptor.nombreSubUbicacion) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Ubicación:', receptorX + 10, receptorY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.receptor.nombreSubUbicacion, receptorX + 60, receptorY, { width: bloqueWidth - 70 });
      }

      currentY += bloqueHeight + 15; // IMPORTANTE: Continuar después de los bloques

      // 3. BLOQUE DE TRANSPORTE - ARREGLADO Y COMPLETO
      const transporteHeight = 70;
      const transporteWidth = 535;
      
      doc.strokeColor('#2d8659');
      drawRoundedRect(30, currentY, transporteWidth, transporteHeight, 15);
      doc.stroke();

      // Fondo sutil para el bloque de transporte
      doc.fillColor('#f0f8f0');
      drawRoundedRect(31, currentY + 1, transporteWidth - 2, transporteHeight - 2, 14);
      doc.fill();

      // Contenido del transporte - ARREGLADO
      let transpY = currentY + 8;
      doc.fillColor('#000000'); // IMPORTANTE: Restablecer color de texto
      
      // Primera fila: Supervisor | Transportista | DNI | Fecha
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Supervisor:', 40, transpY);
      doc.fontSize(8).font('Helvetica');
      const supervisorNombre = datosRemito.supervisor?.nombre || datosRemito.supervisor?.usuario || 'No especificado';
      doc.text(supervisorNombre, 100, transpY);
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Transportista:', 230, transpY);
      doc.fontSize(8).font('Helvetica');
      const transportistaNombre = datosRemito.transporte?.chofer?.nombre || 'No especificado';
      doc.text(transportistaNombre, 300, transpY);
      
      if (datosRemito.transporte?.chofer?.dni) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('DNI:', 420, transpY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.transporte.chofer.dni, 450, transpY);
      }

      transpY += 15;

      // Segunda fila: Vehículo completo + Fecha
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Vehículo:', 40, transpY);
      doc.fontSize(8).font('Helvetica');
      if (datosRemito.transporte?.vehiculo) {
        const vehiculoCompleto = `${datosRemito.transporte.vehiculo.marca || ''} ${datosRemito.transporte.vehiculo.modelo || ''} - Patente: ${datosRemito.transporte.vehiculo.patente || ''}`.trim();
        doc.text(vehiculoCompleto, 90, transpY, { width: 250 });
      }

      // Fecha en la misma fila
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Fecha:', 380, transpY);
      doc.fontSize(8).font('Helvetica');
      doc.text(formatearFecha(datosRemito.fechaEmision), 420, transpY);

      transpY += 15;

      // Tercera fila: Servicio (si existe)
      if (datosRemito.servicio) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Servicio:', 40, transpY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.servicio, 90, transpY, { width: 400 });
      }

      currentY += transporteHeight + 10;

      // Domicilios - ARREGLADOS Y COMPACTOS
      if (datosRemito.transporte?.domicilioOrigen) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Origen:', 40, currentY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.transporte.domicilioOrigen, 80, currentY, { width: 450 });
        currentY += 12;
      }
      
      if (datosRemito.transporte?.domicilioDestino) {
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Destino:', 40, currentY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.transporte.domicilioDestino, 80, currentY, { width: 450 });
        currentY += 15;
      }

      // 4. TABLA DE PRODUCTOS - OPTIMIZADA
      console.log('📦 Procesando productos...');
      
      const tablaY = currentY;
      const tablaHeight = 22; // Reducido de 30 a 22
      const colWidths = [60, 300, 70, 105]; // Ajustado para usar más espacio
      let colX = 30;

      // Header de la tabla con color verde brillante
      doc.fillColor('#7bc142');
      doc.rect(30, tablaY, 535, tablaHeight).fill();
      
      // Bordes de la tabla
      doc.strokeColor('#2d8659').lineWidth(1);
      doc.rect(30, tablaY, 535, tablaHeight).stroke();

      // Texto del header - MÁS PEQUEÑO
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold'); // Reducido
      
      doc.text('UNIDAD', colX + 3, tablaY + 7);
      colX += colWidths[0];
      
      doc.text('PRODUCTO', colX + 3, tablaY + 7);
      colX += colWidths[1];
      
      doc.text('CANT', colX + 3, tablaY + 7); // Abreviado
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
                descripcion: `  - ${componente.descripcion}`, // Sangría para componentes
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

      // Procesar productos y dibujar filas - PAGINACIÓN OPTIMIZADA
      const productosExpandidos = procesarProductos(datosRemito.productos);
      console.log(`📦 Productos expandidos: ${productosExpandidos.length} filas`);
      
      doc.font('Helvetica').fontSize(8); // Reducido tamaño de fuente
      
      // Variables para paginación súper eficiente
      const ALTURA_FILA = 18; // Reducido de 25 a 18
      const MARGEN_INFERIOR = 80; // Reducido para usar más espacio
      const ALTURA_PAGINA = doc.page.height;
      
      // Alternar colores de fila usando la paleta verde
      for (let i = 0; i < productosExpandidos.length; i++) {
        const producto = productosExpandidos[i];
        
        // Verificar si necesitamos nueva página - MÁS ESTRICTO
        if (currentY + ALTURA_FILA > ALTURA_PAGINA - MARGEN_INFERIOR) {
          console.log(`📄 Nueva página en producto ${i + 1}`);
          doc.addPage();
          currentY = 40; // Menos margen superior
          
          // Header compacto en nueva página
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
          doc.text('CANT', colX + 3, currentY + 7);
          colX += colWidths[2];
          doc.text('OBSERVACIÓN', colX + 3, currentY + 7);
          
          currentY += tablaHeight;
        }
        
        // Color de fondo usando la paleta verde
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
        
        doc.strokeColor('#2d8659').lineWidth(0.3); // Líneas más finas
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
        
        doc.text(producto.cantidad.toString(), colX + 2, currentY + 6, {
          width: colWidths[2] - 4
        });
        colX += colWidths[2];
        
        doc.text(producto.observaciones || '', colX + 2, currentY + 6, {
          width: colWidths[3] - 4
        });
        
        currentY += ALTURA_FILA;
      }

      // Líneas verticales más finas
      doc.strokeColor('#2d8659').lineWidth(0.3);
      colX = 30;
      for (let i = 0; i < colWidths.length - 1; i++) {
        colX += colWidths[i];
        doc.moveTo(colX, tablaY).lineTo(colX, currentY).stroke();
      }

      currentY += 15; // Reducido espacio

      // 5. DETALLE - COMPACTO
      if (datosRemito.detalle) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('Detalle:', 30, currentY);
        doc.fontSize(8).font('Helvetica');
        doc.text(datosRemito.detalle, 30, currentY + 12, {
          width: 535
        });
        currentY += 35; // Reducido
      }

      // 6. NOTAS/ACLARACIONES - COMPACTAS
      if (datosRemito.notas && Array.isArray(datosRemito.notas) && datosRemito.notas.length > 0) {
        doc.fontSize(7).font('Helvetica').fillColor('#666666'); // Muy pequeño
        for (const nota of datosRemito.notas) {
          doc.text(nota, 30, currentY, {
            width: 535,
            align: 'center'
          });
          currentY += 15; // Reducido
        }
        currentY += 10;
      }

      // 7. FIRMAS - COMPACTAS
      const firmaY = currentY + 15; // Menos espacio
      
      // Verificar si cabe en la página actual
      if (firmaY > doc.page.height - 60) {
        doc.addPage();
        currentY = 50;
      } else {
        currentY = firmaY;
      }

      // Líneas de firma con color verde
      doc.strokeColor('#2d8659').lineWidth(1);
      doc.moveTo(70, currentY).lineTo(200, currentY).stroke();
      doc.moveTo(350, currentY).lineTo(480, currentY).stroke();

      // Etiquetas de firma más pequeñas
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      doc.text('Firma del Emisor', 105, currentY + 8);
      doc.text('Firma del Receptor', 385, currentY + 8);

      console.log('✅ Contenido del PDF completado');

      // Finalizar documento
      doc.end();

    } catch (error) {
      console.error('❌ Error en generarRemitoOficial:', error);
      reject(error);
    }
  });
};

// ========================================
// FUNCIÓN PRINCIPAL DE TESTING
// ========================================
const testearRemito = async () => {
  try {
    console.log('🧪 INICIANDO TEST DE GENERACIÓN DE REMITO');
    console.log('==========================================');
    
    // Mostrar datos que se van a usar
    console.log('📋 Datos del remito:');
    console.log(`   • Número: ${datosRemitoTest.numeroRemito}`);
    console.log(`   • Cliente: ${datosRemitoTest.receptor.razonSocial}`);
    console.log(`   • Productos: ${datosRemitoTest.productos.length}`);
    console.log(`   • Combos: ${datosRemitoTest.productos.filter(p => p.esCombo).length}`);
    console.log(`   • Productos individuales: ${datosRemitoTest.productos.filter(p => !p.esCombo).length}`);
    console.log(`   • Supervisor: ${datosRemitoTest.supervisor.nombre}`);
    console.log('   • Paleta de colores: #2d8659 (verde), #b8e6d3 (verde claro), #7bc142 (verde brillante), #f0f8f0 (verde muy claro)');
    console.log('');
    
    // Generar el PDF
    console.log('🔄 Generando PDF...');
    const pdfBuffer = await generarRemitoOficial(datosRemitoTest);
    
    // Guardar el archivo
    const nombreArchivo = `remito_test_${datosRemitoTest.numeroRemito.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    fs.writeFileSync(nombreArchivo, pdfBuffer);
    
    console.log('');
    console.log('🎉 REMITO SÚPER OPTIMIZADO generado');
    console.log(`📄 Archivo: ${nombreArchivo}`);
    console.log(`📊 Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`📃 Máximo aprovechamiento de espacio - Mínimas páginas`);
    console.log('✅ Abrir PDF para verificar');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR durante la generación:');
    console.error('================================');
    console.error(error.message);
    console.error('');
    console.error('🔍 Stack trace completo:');
    console.error(error.stack);
    console.error('');
    console.error('💡 Verificaciones sugeridas:');
    console.error('   • ¿Está instalado pdfkit? npm install pdfkit');
    console.error('   • ¿Tienes permisos de escritura en el directorio?');
    console.error('   • ¿Los datos del JSON son válidos?');
  }
};

// ========================================
// VERIFICACIÓN DE DEPENDENCIAS
// ========================================
const verificarDependencias = () => {
  try {
    require('pdfkit');
    console.log('✅ PDFKit está disponible');
    return true;
  } catch (error) {
    console.error('❌ PDFKit no está instalado');
    console.error('💡 Instálalo con: npm install pdfkit');
    return false;
  }
};

// ========================================
// EJECUCIÓN DEL SCRIPT
// ========================================
if (require.main === module) {
  console.log('🚀 SCRIPT DE PRUEBA - GENERADOR DE REMITOS LYME S.A.');
  console.log('====================================================');
  console.log('');
  
  // Verificar dependencias
  if (verificarDependencias()) {
    // Ejecutar test
    testearRemito();
  } else {
    console.error('');
    console.error('❌ No se puede continuar sin las dependencias necesarias');
    process.exit(1);
  }
}

// ========================================
// EXPORTAR PARA USO COMO MÓDULO
// ========================================
module.exports = {
  generarRemitoOficial,
  datosRemitoTest,
  testearRemito
};