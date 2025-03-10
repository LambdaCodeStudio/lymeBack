const mongoose = require('mongoose');

// Cache de conexión para entornos serverless como Vercel
let cachedDb = null;

const connectDB = async () => {
  // Si ya tenemos una conexión, la reutilizamos
  if (cachedDb) {
    console.log('Usando conexión MongoDB en caché');
    return cachedDb;
  }

  try {
    // Configuración de la conexión con opciones recomendadas
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Opciones de conexión para mejorar la robustez
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Flags adicionales para buen funcionamiento en serverless
      bufferCommands: false,
      maxPoolSize: 10, // Ajustar según necesidades
    });
    
    console.log('MongoDB conectado');
    
    // Guardar la conexión en caché
    cachedDb = conn;
    
    // Manejadores de eventos de conexión
    mongoose.connection.on('error', err => {
      console.error('Error en conexión MongoDB:', err);
      cachedDb = null;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB desconectado');
      cachedDb = null;
    });
    
    return conn;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    cachedDb = null;
    throw error;
  }
};

module.exports = connectDB;