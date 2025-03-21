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

// Importar middleware de seguridad
const { 
  securityBundle, 
  apiLimiter, 
  authLimiter 
} = require('./middleware/security');

// Crear app Express
const app = express();
const path = require('path');

// Configurar Express para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Establecer caché global
global.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ===== CONFIGURACIONES BÁSICAS =====

// Configurar Express para entornos con proxy (como Vercel)
if (process.env.NODE_ENV === 'production') {
  // En producción, confiar solo en el primer proxy
  app.set('trust proxy', 1);
} else {
  // En desarrollo, configuración más flexible
  app.set('trust proxy', 'loopback');
}

// ===== MIDDLEWARE DE PRIMERA LÍNEA =====
// (Estos middleware se ejecutan antes para cada solicitud)

// CORS - Control de acceso de origen cruzado
app.use(cors(corsOptions));

// Parsers para diferentes formatos de solicitud
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compresión para reducir tamaño de respuestas
app.use(compression({
  threshold: 100, // No comprimir respuestas menores a 100 bytes
  level: 6,       // Nivel de compresión equilibrado entre velocidad y tamaño
  filter: (req, res) => {
    // No comprimir imágenes o contenido binario (ya están comprimidos)
    if (req.path.includes('/imagen') || req.path.includes('/download')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ===== MIDDLEWARE DE SEGURIDAD =====

// Protección contra vulnerabilidades web comunes
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado para compatibilidad
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Aplicar bundle de seguridad (Incluye DoS, XSS, MongoDB injection, etc.)
app.use(securityBundle);

// Límite de tasa para prevenir abuso en la API
// En producción, aplicar limitadores más estrictos
if (process.env.NODE_ENV === 'production') {
  // Limitar rutas sensibles con configuración más estricta
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  
  // Aplicar limitador general a todas las rutas
  app.use('/api', apiLimiter);
}

// ===== MIDDLEWARE DE CONEXIÓN A BASE DE DATOS =====

// Asegurar que la conexión a la base de datos esté disponible
app.use(ensureDbConnection);

// ===== RUTAS PÚBLICAS =====

// Ruta de verificación de estado (no requiere autenticación)
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  
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

// Middleware para capturar y formatear errores
app.use((err, req, res, next) => {
  // Registrar error en consola con detalles
  console.error('Error no capturado:', err);
  
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
    📅 ${new Date().toISOString()}
    =======================================
    `);
  });
}

// Exportar la app para Vercel y otros entornos serverless
module.exports = app;