// src/config/cors.js
/**
 * Configuración CORS optimizada para Vercel y entornos serverless
 * Implementa una lista de orígenes permitidos y opciones avanzadas
 * con soporte para diferentes entornos (desarrollo/producción)
 */

// Función para cargar orígenes permitidos desde variables de entorno
const getAllowedOrigins = () => {
  // Origen por defecto para desarrollo local
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:5173'];
  
  // Obtener orígenes desde variables de entorno
  const envOrigins = process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
    [];
  
  // Combinar orígenes (usar ambos en desarrollo, solo env en producción)
  return process.env.NODE_ENV !== 'production' ? 
    [...defaultOrigins, ...envOrigins] : 
    envOrigins;
};

// Función de validación de origen
const originValidator = (origin, callback) => {
  // Lista de orígenes permitidos
  const allowedOrigins = getAllowedOrigins();
  
  // Permitir solicitudes sin origen (ej. aplicaciones móviles o Postman)
  if (!origin) {
    return callback(null, true);
  }
  
  // En desarrollo, permitir cualquier origen
  if (process.env.NODE_ENV !== 'production') {
    return callback(null, true);
  }
  
  // En producción, verificar contra lista blanca
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    return callback(null, true);
  } else {
    // Registrar intento no autorizado
    console.warn(`Acceso CORS bloqueado para origen: ${origin}`);
    return callback(new Error(`El origen ${origin} no está permitido por CORS`), false);
  }
};

// Configuración completa de CORS
const corsOptions = {
  origin: originValidator,
  
  // Métodos HTTP permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  
  // Cabeceras permitidas
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Cache-Control',
    'X-Access-Token'
  ],
  
  // Permitir credenciales (cookies, autenticación)
  credentials: true,
  
  // Tiempo máximo para guardar en caché los resultados del preflight
  maxAge: 86400, // 24 horas
  
  // Cabeceras expuestas al cliente
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range', 
    'X-Total-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  
  // Opciones adicionales
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Función para verificar la configuración de CORS
const verifyCorsSetup = () => {
  const allowedOrigins = getAllowedOrigins();
  
  console.log('===== Configuración CORS =====');
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Orígenes permitidos (${allowedOrigins.length}): ${allowedOrigins.join(', ')}`);
  console.log(`Métodos permitidos: ${corsOptions.methods.join(', ')}`);
  console.log(`Credenciales permitidas: ${corsOptions.credentials}`);
  console.log('==============================');
  
  return { corsOptions, allowedOrigins };
};

module.exports = corsOptions;

// Exportar utilidades adicionales
module.exports.getAllowedOrigins = getAllowedOrigins;
module.exports.verifyCorsSetup = verifyCorsSetup;