// src/config/db.js
const mongoose = require('mongoose');

/**
 * Configuración mejorada de conexión a MongoDB
 * Optimizada para entornos serverless con manejo de reconexión
 * y cache de conexión para mejorar rendimiento
 */

// Cache de conexión para entornos serverless
let cachedConnection = null;

/**
 * Variables de configuración para la conexión MongoDB
 * Valores por defecto con posibilidad de sobreescritura desde variables de entorno
 */
const DB_CONFIG = {
  // URI de conexión (requerida)
  uri: process.env.MONGODB_URI,
  
  // Timeouts
  connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS) || 10000,
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 15000,
  
  // Opciones de conexión
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10,
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 1,
  
  // Opciones de comportamiento
  retryWrites: process.env.MONGO_RETRY_WRITES !== 'false',
  retryReads: process.env.MONGO_RETRY_READS !== 'false',
  
  // Flags importantes para entornos serverless
  bufferCommands: process.env.MONGO_BUFFER_COMMANDS !== 'false',
  
  // Compresión para reducir uso de red
  compressors: process.env.MONGO_COMPRESSORS || 'zlib',
  
  // Preferencia de lectura
  // readPreference: process.env.MONGO_READ_PREFERENCE || 'primaryPreferred', 'primary'
  readPreference: 'primary',
  
  // Auto index en desarrollo (false en producción)
  autoIndex: process.env.NODE_ENV !== 'production'
};

/**
 * Configura manejadores de eventos para la conexión de MongoDB
 * @param {Object} connection - Conexión a MongoDB
 */
const setupConnectionHandlers = (connection) => {
  // Manejar errores de conexión
  connection.on('error', (err) => {
    console.error('Error en conexión MongoDB:', err);
    cachedConnection = null;
  });
  
  // Manejar desconexiones
  connection.on('disconnected', () => {
    console.log('MongoDB desconectado');
    cachedConnection = null;
  });
  
  // Manejar reconexiones
  connection.on('reconnected', () => {
    console.log('MongoDB reconectado');
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
    console.log('===========================================');
  }
};

/**
 * Conecta a MongoDB con opciones optimizadas
 * Mantiene una sola conexión en caché para reutilizar entre funciones serverless
 * @returns {Promise<Object>} Conexión a MongoDB
 */
const connectDB = async () => {
  // Si ya existe una conexión válida, la reutilizamos
  if (cachedConnection && cachedConnection.readyState === 1) {
    console.log('Reutilizando conexión MongoDB en caché');
    return cachedConnection;
  }

  try {
    // Validar que tenemos una URI de conexión
    if (!DB_CONFIG.uri) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }
    
    // Conectar con opciones completas
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
      autoIndex: DB_CONFIG.autoIndex
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
 * Útil para aplicar a nivel de aplicación o de rutas específicas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const ensureDbConnection = async (req, res, next) => {
  try {
    if (!cachedConnection || cachedConnection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Error de conexión a MongoDB en middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error de conexión a la base de datos',
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