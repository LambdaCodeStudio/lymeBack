// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const { dosProtection } = require('./middleware/security');
const corsOptions = require('./config/cors');
const MongoStore = require('connect-mongo');
const { createInitialAdmin } = require('./controllers/auth');

const app = express();

// Middlewares básicos
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Seguridad
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true
}));

app.use(mongoSanitize());
app.use(hpp());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 100 // Límite más alto para tests
});
app.use(limiter);
app.use(dosProtection);

// Cookies y Session - Solo si no estamos en test
if (process.env.NODE_ENV !== 'test') {
  app.use(session({
    secret: process.env.SESSION_SECRET,
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60
    }),
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 3600000
    }
  }));
}

// Headers adicionales
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/producto', require('./routes/productoRoutes'));

// Solo iniciar el servidor si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;

  connectDB()
    .then(() => {
      createInitialAdmin();
      app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
    })
    .catch(err => {
      console.error('Error al iniciar servidor:', err);
      process.exit(1);
    });
}

module.exports = { app, connectDB };