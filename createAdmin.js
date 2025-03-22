require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const createAdminDirect = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log('Conectado a MongoDB');
    
    // Verificar si ya existe un admin mediante operación directa
    const userCollection = mongoose.connection.collection('users');
    const adminExists = await userCollection.findOne({ role: 'admin' });
    

    // Hashear contraseña directamente
    console.log('Hasheando contraseña...');
    const plainPassword = '123456';
    const hashedPassword = await bcrypt.hash(String(plainPassword), 10);
    console.log('Contraseña hasheada con éxito');
    
    // Crear documento directamente sin usar el modelo
    const result = await userCollection.insertOne({
      usuario: 'lambda',
      password: hashedPassword,
      role: 'admin',
      nombre: 'Administrador',
      apellido: 'Principal',
      secciones: 'ambos',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Usuario administrador creado exitosamente');
  } catch (error) {
    console.error('Error al crear administrador:', error);
  } finally {
    if (mongoose.connection) {
      await mongoose.connection.close();
      console.log('Conexión cerrada');
    }
  }
};

createAdminDirect().catch(console.error);
