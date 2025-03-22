// src/config/db.js
const mongoose = require('mongoose');

/**
 * Configuración optimizada de conexión a MongoDB
 * Ajustada para alto rendimiento en entornos serverless
 * con soporte para 10,000 peticiones por minuto
 */

// Cache de conexión para entornos serverless
let cachedConnection = null;

/**
 * Variables de configuración para la conexión MongoDB
 * Optimizadas para alto rendimiento y concurrencia
 */
const DB_CONFIG = {
  // URI de conexión (requerida)
  uri: process.env.MONGODB_URI,
  
  // Timeouts optimizados para alto volumen
  connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS) || 20000,
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS) || 60000,
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 30000,
  
  // Opciones de pool de conexiones aumentadas
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 50,
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 5,
  
  // Opciones de comportamiento
  retryWrites: process.env.MONGO_RETRY_WRITES !== 'false',
  retryReads: process.env.MONGO_RETRY_READS !== 'false',
  
  // Flags importantes para entornos serverless
  bufferCommands: process.env.MONGO_BUFFER_COMMANDS !== 'false',
  
  // Compresión para reducir uso de red
  compressors: process.env.MONGO_COMPRESSORS || 'zlib',
  
  // Preferencia de lectura - usando primaryPreferred para distribuir carga
  readPreference: process.env.MONGO_READ_PREFERENCE || 'primaryPreferred',
  
  // Auto index en desarrollo (false en producción)
  autoIndex: process.env.NODE_ENV !== 'production',
  
  // Configuración de heartbeat para mejorar estabilidad en alta carga
  heartbeatFrequencyMS: 10000,
  
  // Opciones de escritura para optimizar rendimiento
  w: 'majority',
  wtimeoutMS: 2500
};

/**
 * Configura manejadores de eventos para la conexión de MongoDB
 * @param {Object} connection - Conexión a MongoDB
 */
const setupConnectionHandlers = (connection) => {
  // Manejar errores de conexión
  connection.on('error', (err) => {
    console.error('Error en conexión MongoDB:', err);
    // No invalidar caché inmediatamente para permitir reintentos
    if (err.name === 'MongoNetworkError') {
      setTimeout(() => {
        cachedConnection = null;
      }, 5000);
    } else {
      cachedConnection = null;
    }
  });
  
  // Manejar desconexiones con lógica de reintento
  connection.on('disconnected', () => {
    console.log('MongoDB desconectado - intentando reconectar');
    // Esperar antes de invalidar para permitir reconexión automática
    setTimeout(() => {
      if (connection.readyState !== 1) {
        cachedConnection = null;
      }
    }, 10000);
  });
  
  // Manejar reconexiones
  connection.on('reconnected', () => {
    console.log('MongoDB reconectado exitosamente');
  });
  
  // Manejar errores críticos
  connection.on('close', () => {
    console.warn('Conexión MongoDB cerrada');
    cachedConnection = null;
  });
};

/**
 * Registra información de debug sobre la conexión
 * Solo activo en entorno de desarrollo
 * @param {Object} connection - Conexión a MongoDB
 */
const logConnectionInfo = (connection) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('===== Información de conexión MongoDB =====');
    console.log(`Host: ${connection.host}`);
    console.log(`Estado: ${connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`);
    console.log(`Modo: ${connection.db?.options?.readPreference || 'N/A'}`);
    console.log(`Pool Size: ${DB_CONFIG.maxPoolSize}`);
    console.log('===========================================');
  }
};

/**
 * Conecta a MongoDB con opciones optimizadas para alto rendimiento
 * Mantiene una sola conexión en caché para reutilizar entre funciones serverless
 * @returns {Promise<Object>} Conexión a MongoDB
 */
const connectDB = async () => {
  // Si ya existe una conexión válida, la reutilizamos
  if (cachedConnection && cachedConnection.readyState === 1) {
    return cachedConnection;
  }

  // Si la conexión está en proceso de conexión, esperamos
  if (cachedConnection && cachedConnection.readyState === 2) {
    console.log('Conexión a MongoDB en progreso, esperando...');
    // Esperar a que se complete la conexión (con timeout)
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cachedConnection.readyState === 1) {
        return cachedConnection;
      }
    }
  }

  try {
    // Validar que tenemos una URI de conexión
    if (!DB_CONFIG.uri) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }
    
    // Conectar con opciones optimizadas para alto rendimiento
    const conn = await mongoose.connect(DB_CONFIG.uri, {
      connectTimeoutMS: DB_CONFIG.connectTimeoutMS,
      socketTimeoutMS: DB_CONFIG.socketTimeoutMS,
      serverSelectionTimeoutMS: DB_CONFIG.serverSelectionTimeoutMS,
      maxPoolSize: DB_CONFIG.maxPoolSize,
      minPoolSize: DB_CONFIG.minPoolSize,
      retryWrites: DB_CONFIG.retryWrites,
      retryReads: DB_CONFIG.retryReads,
      bufferCommands: DB_CONFIG.bufferCommands,
      compressors: DB_CONFIG.compressors,
      readPreference: DB_CONFIG.readPreference,
      autoIndex: DB_CONFIG.autoIndex,
      heartbeatFrequencyMS: DB_CONFIG.heartbeatFrequencyMS,
      w: DB_CONFIG.w,
      wtimeoutMS: DB_CONFIG.wtimeoutMS
    });
    
    console.log(`MongoDB conectado (${process.env.NODE_ENV || 'development'})`);
    
    // Configurar manejadores de eventos
    setupConnectionHandlers(conn.connection);
    
    // Mostrar información de la conexión
    logConnectionInfo(conn.connection);
    
    // Guardar la conexión en caché
    cachedConnection = conn;
    
    return conn;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    throw error;
  }
};

/**
 * Cierra la conexión a MongoDB
 * Útil para tests y scripting, no recomendado para una API en ejecución
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
    console.log('Conexión MongoDB cerrada explícitamente');
  }
};

/**
 * Middleware para asegurar que existe una conexión a MongoDB
 * Optimizado para alto rendimiento y recuperación de errores
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const ensureDbConnection = async (req, res, next) => {
  try {
    // Optimización: verificar ruta de health antes de verificar conexión
    if (req.path === '/api/health') {
      return next();
    }
    
    // Verificar estado de conexión actual
    if (!cachedConnection || 
        (cachedConnection.readyState !== 1 && cachedConnection.readyState !== 2)) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Error de conexión a MongoDB en middleware:', error);
    res.status(503).json({
      success: false,
      message: 'Servicio temporalmente no disponible. Intente más tarde.',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

module.exports = {
  connectDB,
  closeConnection,
  ensureDbConnection,
  // Exponer la configuración para debugging y testing
  DB_CONFIG
};