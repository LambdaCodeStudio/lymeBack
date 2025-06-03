// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const NodeCache = require('node-cache');

// Importar configuraciones y servicios optimizados
const corsOptions = require('./config/cors');
const { connectDB, ensureDbConnection } = require('./config/db');
const { createInitialAdmin } = require('./controllers/auth');

// Importar middleware de seguridad con límites optimizados
const { 
  securityBundle, 
  apiLimiter, 
  authLimiter,
  bulkOperationsLimiter
} = require('./middleware/security');

// Crear app Express
const app = express();
const path = require('path');

// Configurar Express para servir archivos estáticos con caché
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache de un día para archivos estáticos
  etag: true,
  lastModified: true
}));

// Establecer caché global con configuración de alto rendimiento
global.cache = new NodeCache({ 
  stdTTL: 600, // 10 minutos (aumentado)
  checkperiod: 120, // 2 minutos
  maxKeys: 10000 // Limitar para evitar problemas de memoria
});

// ===== CONFIGURACIONES BÁSICAS =====

// Configurar Express para entornos con proxy (como Vercel)
if (process.env.NODE_ENV === 'production') {
  // En producción, confiar solo en el primer proxy
  app.set('trust proxy', 1);
} else {
  // En desarrollo, configuración más flexible
  app.set('trust proxy', 'loopback');
}

// Configuración para alto rendimiento
app.set('x-powered-by', false); // Eliminar header x-powered-by
app.set('etag', 'strong'); // Usar etags para optimizar caché de cliente

// ===== MIDDLEWARE DE PRIMERA LÍNEA =====
// (Estos middleware se ejecutan antes para cada solicitud)

// CORS - Control de acceso de origen cruzado
app.use(cors(corsOptions));

// Parsers para diferentes formatos de solicitud - optimizados
app.use(express.json({ 
  limit: '10mb',
  strict: true, // Solo aceptar JSON válido
  type: ['application/json', 'application/json;charset=utf-8']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000 // Limitar número de parámetros para prevenir DoS
}));
app.use(cookieParser());

// Compresión mejorada para reducir tamaño de respuestas
app.use(compression({
  threshold: 1024, // Comprimir respuestas mayores a 1KB
  level: 4,       // Equilibrio óptimo entre velocidad y compresión
  memLevel: 8,    // Usar más memoria para mejor compresión
  filter: (req, res) => {
    // No comprimir imágenes o contenido binario (ya están comprimidos)
    if (req.path.includes('/imagen') || req.path.includes('/download')) {
      return false;
    }
    // No comprimir respuestas pequeñas
    if (parseInt(res.getHeader('Content-Length')) < 1024) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ===== MIDDLEWARE DE SEGURIDAD =====

// Protección contra vulnerabilidades web comunes - configuración optimizada
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado para compatibilidad
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: true }, // Permitir prefetch para mejor rendimiento
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'same-origin' }
}));

// Aplicar bundle de seguridad optimizado para alto rendimiento
app.use(securityBundle);

// Límite de tasa para prevenir abuso en la API - configuración optimizada para 10,000 rpm
if (process.env.NODE_ENV === 'production') {
  // Rutas críticas necesitan protección especial aún con alto rendimiento
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  
  // Aplicar limitador general a todas las demás rutas API
  app.use('/api', (req, res, next) => {
    // Saltarse la verificación de health check
    if (req.path === '/health') {
      return next();
    }

    return apiLimiter(req, res, next);
  });
}

// ===== MIDDLEWARE DE CONEXIÓN A BASE DE DATOS =====

// Asegurar que la conexión a la base de datos esté disponible - optimizado
app.use(ensureDbConnection);

// ===== RUTAS PÚBLICAS =====

// Ruta de verificación de estado optimizada (no requiere autenticación)
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  
  // Respuesta optimizada sin consultar información innecesaria
  res.status(200).json({ 
    success: true,
    status: 'ok', 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cache: {
      keys: global.cache.keys().length,
      stats: global.cache.getStats()
    }
  });
});

// ===== RUTAS API =====

// Rutas de la aplicación
app.use('/api/auth', require('./routes/auth'));
app.use('/api/producto', require('./routes/productoRoutes'));
app.use('/api/cliente', require('./routes/clienteRoutes'));
app.use('/api/pedido', require('./routes/pedidoRoutes'));
app.use('/api/downloads', require('./routes/downloadRoutes'));
app.use('/api/conductores', require('./routes/conductorRoutes'));
app.use('/api/vehiculo', require('./routes/vehiculoRoutes'));
app.use('/api/lyme', require('./routes/lymeRoutes'));
app.use('/api/receptor', require('./routes/receptorRoutes'));


// ===== MIDDLEWARE DE MANEJO DE ERRORES =====

// Middleware para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Ruta no encontrada', 
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware para capturar y formatear errores - optimizado
app.use((err, req, res, next) => {
  // Registrar error en consola con detalles
  console.error('Error no capturado:', err.message);
  
  // Determinar código de estado HTTP apropiado
  const statusCode = err.status || err.statusCode || 500;
  
  // Estructurar la respuesta de error
  const errorResponse = {
    success: false,
    message: err.message || 'Error interno del servidor',
    status: statusCode,
    // Incluir información de depuración solo en desarrollo
    ...(process.env.NODE_ENV !== 'production' && {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code
      }
    })
  };
  
  // Enviar respuesta al cliente
  res.status(statusCode).json(errorResponse);
});

// ===== INICIALIZACIÓN =====

// Conexión a MongoDB e inicialización de datos
const initializeApp = async () => {
  try {
    if (process.env.MONGODB_URI) {
      // Conectar a MongoDB
      await connectDB();
      
      // Creación de admin inicial en producción
      if (process.env.NODE_ENV === 'production') {
        await createInitialAdmin();
      }
      
      console.log('Inicialización completada con éxito');
    } else {
      console.error('MONGODB_URI no está definida. La aplicación no funcionará correctamente.');
    }
  } catch (error) {
    console.error('Error durante la inicialización:', error);
  }
};

// Ejecutar inicialización
initializeApp();

// ===== INICIO DEL SERVIDOR =====

// Solo iniciar servidor HTTP en entornos que no son serverless (desarrollo local)
if (process.env.NODE_ENV == 'production' || process.env.START_SERVER === 'true') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`
    =======================================
    🚀 Servidor ejecutándose en puerto ${PORT}
    🌎 Entorno: ${process.env.NODE_ENV || 'development'}
    🔄 Configurado para 10,000 peticiones por minuto
    📅 ${new Date().toISOString()}
    =======================================
    `);
  });
}

// Exportar la app para Vercel y otros entornos serverless
module.exports = app;