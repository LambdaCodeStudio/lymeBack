// createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user');
const bcrypt = require('bcryptjs');
const ROLES = require('./src/constants/roles');

const createAdmin = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Configuraciones adicionales para mejor rendimiento
      maxPoolSize: 10,
      compressors: 'zlib',
      readPreference: 'primaryPreferred'
    });
    console.log('Conectado a MongoDB');

    // Verificar si ya existe un admin
    const adminExists = await User.findOne({ role: ROLES.ADMIN });
    
    if (adminExists) {
      console.log('Ya existe un usuario administrador');
      return;
    }

    // Variables de entorno
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || '123456'; // Usar una contraseña segura en producción
    
    // Crear el admin con la nueva estructura
    const admin = new User({
      usuario: adminUsername,
      password: adminPassword, // El middleware pre-save en el modelo se encargará de hashear la contraseña
      role: ROLES.ADMIN,
      nombre: 'Administrador',
      apellido: 'Principal',
      secciones: 'ambos', // Acceso a todas las secciones
      isActive: true
    });

    await admin.save();
    console.log(`Usuario administrador "${adminUsername}" creado exitosamente`);

  } catch (error) {
    console.error('Error al crear administrador:', error);
  } finally {
    // Cerrar conexión
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Conexión cerrada');
    }
  }
};

// Ejecutar la función
createAdmin().catch(console.error);