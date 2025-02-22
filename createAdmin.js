// createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user'); // Ajusta la ruta según tu estructura

const createAdmin = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tu_base_de_datos');
    console.log('Conectado a MongoDB');

    // Verificar si ya existe un admin
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('Ya existe un usuario admin');
      return;
    }

    // Crear el admin
    const admin = await User.create({
      email: 'admin@ejemplo.com',
      password: '123456',
      role: 'admin'
    });

    console.log('Usuario admin creado exitosamente:', admin.email);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
};

createAdmin();