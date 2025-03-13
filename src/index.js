// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const compression = require('compression');
const corsOptions = require('./config/cors');
const { createInitialAdmin } = require('./controllers/auth');

const app = express();

// IMPORTANTE: Configurar Express para confiar en el proxy (para Vercel)
app.set('trust proxy', true);

// Middlewares básicos con optimizaciones
app.use(cors(corsOptions));

// Aumentar límite solo para rutas que lo necesiten como imagenes base64
app.use('/api/producto/:id/imagen-base64', express.json({ limit: '10mb' }));
// Para el resto de rutas, usar un límite más bajo para mejor rendimiento
app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Compresión optimizada
app.use(compression({
  threshold: 1024, // Solo comprimir respuestas mayores a 1KB
  level: 1, // Nivel de compresión más rápido
  filter: (req, res) => {
    // No comprimir respuestas binarias o imágenes
    if (req.path.includes('/imagen') || req.path.includes('/excel') || req.path.includes('/pdf')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Seguridad optimizada
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Sanitización más eficiente
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: (key, value, req) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Sanitized ${key} for request to ${req.originalUrl}`);
    }
  }
}));

// Prevención de contaminación de parámetros
app.use(hpp());

// Rate Limiting optimizado para 5000 req/min (83.33 req/s)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5000, // 5000 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Saltear el rate limit para health checks y rutas críticas
    return req.path === '/api/health';
  }
});

// Aplicar limitador solo a rutas API
app.use('/api/', apiLimiter);

// Headers CORS simplificados
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Ruta de health check optimizada
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: Date.now()
  });
});

// Conexión a MongoDB optimizada
let mongoConnection;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  
  try {
    if (!mongoConnection) {
      mongoConnection = mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: true,
        maxPoolSize: 50, // Aumentado para manejar más conexiones concurrentes
        minPoolSize: 10, // Mantener conexiones mínimas activas
        compressors: 'zlib',
        readPreference: 'primaryPreferred',
        // Ajustes de heartbeat y keepAlive para mantener conexiones
        heartbeatFrequencyMS: 10000,
        keepAlive: true,
        keepAliveInitialDelay: 300000
      });
    }
    
    return await mongoConnection;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    throw error;
  }
};

// Conexión a la base de datos más eficiente
const dbMiddleware = async (req, res, next) => {
  // Rutas que no requieren DB
  const noDbRoutes = ['/api/health', '/favicon.ico'];
  if (noDbRoutes.includes(req.path)) {
    return next();
  }

  // Para el resto, asegurar conexión
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      return res.status(500).json({ error: 'Error de conexión a la base de datos' });
    }
  }
  next();
};

app.use(dbMiddleware);

// Inicialización de la DB optimizada
if (process.env.MONGODB_URI) {
  connectDB()
    .then(() => {
      if (process.env.NODE_ENV === 'production') {
        createInitialAdmin().catch(err => {
          console.warn('No se pudo crear el admin inicial:', err.message);
        });
      }
    })
    .catch(err => {
      console.error('Error al conectar a MongoDB:', err.message);
    });
}

// Rutas API (sin cambios)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/producto', require('./routes/productoRoutes'));
app.use('/api/cliente', require('./routes/clienteRoutes'));
app.use('/api/pedido', require('./routes/pedidoRoutes'));
app.use('/api/downloads', require('./routes/downloadRoutes'));

// Middleware de control de errores optimizado
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  res.status(err.status || 500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'production' ? {} : { message: err.message }
  });
});

// Manejar ruta 404 (simplificado)
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Iniciar en desarrollo
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
}

// Exportar para Vercel
module.exports = app;