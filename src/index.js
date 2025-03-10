// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
// Removemos la importación de dosProtection
// const { dosProtection } = require('./middleware/security');
const corsOptions = require('./config/cors');
const { createInitialAdmin } = require('./controllers/auth');

const app = express();

// Middlewares básicos
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(mongoSanitize());
app.use(hpp());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);
// Removemos el middleware dosProtection que está causando problemas
// app.use(dosProtection);

// Configuración de sesión - ADAPTADA PARA VERCEL
// En Vercel, usamos una sesión en memoria para evitar problemas con MongoStore
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

// Headers adicionales
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Ruta de verificación para Vercel
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Conexión a MongoDB
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB conectado');
    return mongoose.connection;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    throw error;
  }
};

// Intentar conectar a MongoDB
let isConnected = false;
if (process.env.MONGODB_URI) {
  connectDB()
    .then(() => {
      isConnected = true;
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

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/producto', require('./routes/productoRoutes'));
app.use('/api/cliente', require('./routes/clienteRoutes'));
app.use('/api/pedido', require('./routes/pedidoRoutes'));
app.use('/api/downloads', require('./routes/downloadRoutes'));

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// Manejar ruta 404
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Iniciar el servidor solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
}

// Exportar la app para Vercel
module.exports = app;