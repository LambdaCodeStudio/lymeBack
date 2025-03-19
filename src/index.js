// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
// Recomendamos eliminar express-session si no es necesario para tu aplicación
// const session = require('express-session');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const compression = require('compression');
const corsOptions = require('./config/cors');
const { createInitialAdmin } = require('./controllers/auth');

const app = express();

// IMPORTANTE: Configurar Express para confiar en el proxy (para Vercel)
if (process.env.NODE_ENV === 'production') {
  // En producción, confiar solo en el primer proxy (apropiado para Vercel)
  app.set('trust proxy', 1);
} else {
  // En desarrollo, podemos ser menos estrictos
  app.set('trust proxy', 'loopback');
}

// Middlewares básicos
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compresión para reducir el tamaño de las respuestas
app.use(compression({
  // No comprimir respuestas pequeñas
  threshold: 100, // bytes
  // Usar algoritmo más rápido para respuestas más rápidas
  level: 6,
  // Comprimir todas las respuestas excepto imágenes
  filter: (req, res) => {
    if (req.path.includes('/imagen')) {
      return false; // No comprimir imágenes (ya están comprimidas)
    }
    return compression.filter(req, res);
  }
}));

// Seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(mongoSanitize());
app.use(hpp());

// Rate Limiting configurado para funcionar en entornos con proxy (como Vercel)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 200,
//   standardHeaders: true,
//   legacyHeaders: false,
//   // Desactivar la validación si continúa el error
//   validate: { trustProxy: false }
// });
// app.use(limiter);

/* Recomendamos eliminar la configuración de sesión si no la estás usando
// Configuración de sesión - ADAPTADA PARA VERCEL
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret_key',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));
*/

// Headers adicionales para CORS - asegura consistencia en toda la aplicación
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control');
  
  // Para solicitudes OPTIONS, responder inmediatamente sin continuar
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Ruta de verificación para Vercel
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Conexión a MongoDB optimizada para Vercel
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Importante: Cambiar bufferCommands a true para evitar el error de conexión
      bufferCommands: true,
      maxPoolSize: 10,
      // Configuraciones adicionales
      compressors: 'zlib',
      readPreference: 'primaryPreferred'
    });
    
    console.log('MongoDB conectado con éxito!');
    
    // Manejar eventos del ciclo de vida de la conexión
    mongoose.connection.on('error', err => {
      console.error('Error en conexión MongoDB:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB desconectado');
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    throw error;
  }
};

// Middleware para asegurar que la conexión a la base de datos esté lista
app.use(async (req, res, next) => {
  // Si la conexión no está lista, intentar conectar primero
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error('Error al conectar a MongoDB:', err.message);
      return res.status(500).json({ 
        error: 'Error de conexión a la base de datos', 
        details: process.env.NODE_ENV === 'production' ? undefined : err.message 
      });
    }
  } else {
    next();
  }
});

// Intentar conectar a MongoDB al inicio
if (process.env.MONGODB_URI) {
  connectDB()
    .then(() => {
      // Solo crear admin si la conexión fue exitosa
      if (process.env.NODE_ENV === 'production') {
        try {
          createInitialAdmin();
        } catch (err) {
          console.warn('No se pudo crear el admin inicial:', err.message);
        }
      }
    })
    .catch(err => {
      console.error('Error al conectar a MongoDB:', err.message);
    });
}

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/producto', require('./routes/productoRoutes'));
app.use('/api/cliente', require('./routes/clienteRoutes'));
app.use('/api/pedido', require('./routes/pedidoRoutes'));
app.use('/api/downloads', require('./routes/downloadRoutes'));

// Middleware de control de errores
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  
  // Estructurar la respuesta de error
  const errorResponse = {
    message: 'Error interno del servidor',
    status: err.status || 500,
    // Solo incluir detalles en desarrollo
    error: process.env.NODE_ENV === 'production' ? {} : {
      message: err.message,
      stack: err.stack
    }
  };
  
  res.status(errorResponse.status).json(errorResponse);
});

// Manejar ruta 404
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Ruta no encontrada', 
    path: req.originalUrl,
    method: req.method
  });
});

// Iniciar el servidor solo en desarrollo
if (process.env.NODE_ENV == 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
}

// Exportar la app para Vercel
module.exports = app;