const mongoose = require('mongoose');
const { EventEmitter } = require('events');

// Aumentar límite de listeners para evitar memory leaks con muchas conexiones
EventEmitter.defaultMaxListeners = 30;

// Caché global de conexión para entornos serverless
let cachedDb = null;
let connectionPromise = null;
let isConnecting = false;
let lastReconnectAttempt = 0;
const MIN_RECONNECT_INTERVAL = 5000; // 5 segundos mínimo entre intentos

// Función optimizada para conectar a MongoDB con reconexión inteligente
const connectDB = async () => {
  // Si ya estamos conectados, devolver la conexión
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  // Si hay un intento de conexión en curso, esperar por ese
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  // Evitar múltiples intentos de reconexión en corto tiempo
  const now = Date.now();
  if (now - lastReconnectAttempt < MIN_RECONNECT_INTERVAL) {
    console.log('Evitando intento de reconexión frecuente');
    
    // Si tenemos una conexión en mal estado, rechazar la promesa
    if (mongoose.connection.readyState !== 1 && !isConnecting) {
      throw new Error('La conexión a la base de datos no está disponible');
    }
    
    // Si hay un intento previo, esperar por ese
    if (connectionPromise) {
      return connectionPromise;
    }
  }

  // Iniciar nuevo intento de conexión
  lastReconnectAttempt = now;
  isConnecting = true;

  try {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      // Configuración optimizada para alto rendimiento y tolerancia a fallos
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: true,
      maxPoolSize: 50,      // 5x el valor original, para manejar 5000 req/min
      minPoolSize: 10,      // Mantener pool mínimo de conexiones
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      keepAlive: true,
      keepAliveInitialDelay: 300000,
      autoIndex: process.env.NODE_ENV !== 'production', // Deshabilitar auto-indexing en producción
      maxIdleTimeMS: 120000, // Cerrar conexiones inactivas después de 2 minutos
      compressors: 'zlib',
      readPreference: 'primaryPreferred',
      retryWrites: true,
      retryReads: true,
      // Configuración de replicación (si aplica)
      replicaSet: process.env.MONGO_REPLICA_SET
    });

    const conn = await connectionPromise;
    console.log('MongoDB conectado exitosamente');
    
    // Guardar en caché
    cachedDb = conn;
    
    // Configurar manejadores de eventos
    setupConnectionHandlers();
    
    return conn;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    connectionPromise = null;
    cachedDb = null;
    throw error;
  } finally {
    isConnecting = false;
  }
};

// Configurar manejadores de eventos de conexión
function setupConnectionHandlers() {
  // Limpiar manejadores previos para evitar duplicados
  mongoose.connection.removeAllListeners('error');
  mongoose.connection.removeAllListeners('disconnected');
  mongoose.connection.removeAllListeners('connected');
  
  // Manejar errores de conexión
  mongoose.connection.on('error', err => {
    console.error('Error en conexión MongoDB:', err);
    if (cachedDb) {
      // Solo limpiar caché para ciertos errores que requieren reconexión
      if (err.name === 'MongoNetworkError' || 
          err.name === 'MongoServerSelectionError' ||
          err.message.includes('topology was destroyed')) {
        cachedDb = null;
        connectionPromise = null;
      }
    }
  });
  
  // Manejar desconexiones
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB desconectado');
    cachedDb = null;
    connectionPromise = null;
  });
  
  // Confirmar reconexiones
  mongoose.connection.on('connected', () => {
    console.log('MongoDB reconectado');
  });
}

// Agregar función para cerrar conexión (útil en pruebas y reinicio controlado)
const closeConnection = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    cachedDb = null;
    connectionPromise = null;
    console.log('Conexión a MongoDB cerrada');
  }
};

// Exportar funciones
module.exports = {
  connectDB,
  closeConnection,
  getConnectionStatus: () => mongoose.connection.readyState
};