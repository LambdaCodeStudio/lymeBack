// src/controllers/auth.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ROLES = require('../constants/roles');

// Crear usuario administrador inicial
const createInitialAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: ROLES.ADMIN });
    if (!adminExists) {
      await User.create({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: ROLES.ADMIN
      });
    }
  } catch (error) {
    console.error('Error creating admin:', error);
  }
};

// Función auxiliar para validar permisos de creación
const isAllowedToCreate = (creatorRole, newRole) => {
  switch (creatorRole) {
    case ROLES.ADMIN:
      return [ROLES.SUPERVISOR, ROLES.BASIC, ROLES.TEMPORAL].includes(newRole);
    case ROLES.SUPERVISOR:
      return [ROLES.BASIC, ROLES.TEMPORAL].includes(newRole);
    case ROLES.BASIC:
      return [ROLES.TEMPORAL].includes(newRole);
    default:
      return false;
  }
};

// Login
const login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ msg: 'Usuario no existe' });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Contraseña incorrecta' });

    // Crear token con información adicional
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '1h' }  // Token expira en 1 hora
    );

    // Respuesta con token y rol
    res.json({ 
      token, 
      role: user.role,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registro de usuario
const register = async (req, res) => {
  try {
    const creator = await User.findById(req.user.id);
    if (!creator) {
      return res.status(401).json({ msg: 'Usuario creador no encontrado' });
    }

    const { role } = req.body;
    
    if (!isAllowedToCreate(creator.role, role)) {
      return res.status(403).json({ msg: 'No tienes permisos para crear este tipo de usuario' });
    }

    const user = new User({
      ...req.body,
      createdBy: creator._id
    });

    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Crear usuario temporal
const createTemporaryUser = async (req, res) => {
  try {
    const creator = await User.findById(req.user.id);
    if (!creator) {
      return res.status(401).json({ msg: 'Usuario creador no encontrado' });
    }

    if (!isAllowedToCreate(creator.role, ROLES.TEMPORAL)) {
      return res.status(403).json({ msg: 'No tienes permisos para crear usuarios temporales' });
    }

    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 30);

    const temporalUser = new User({
      ...req.body,
      role: ROLES.TEMPORAL,
      createdBy: creator._id,
      expiresAt: expirationDate
    });

    await temporalUser.save();
    const token = jwt.sign({ id: temporalUser._id }, process.env.JWT_SECRET);
    res.json({ token, expiresAt: expirationDate });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    // Obtener todos los usuarios sin filtrar por expiración
    const users = await User.find()
      .select('-password')
      .populate('createdBy', 'email');
    
    // Procesar cada usuario para actualizar su estado
    const processedUsers = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject();

      // Manejar usuarios temporales
      if (user.role === ROLES.TEMPORAL && user.expiresAt) {
        const now = new Date();
        const expirationDate = new Date(user.expiresAt);
        
        // Si está expirado, actualizar su estado en la base de datos
        if (now > expirationDate && user.isActive) {
          user.isActive = false;
          await user.save();
          userObj.isActive = false;
        }

        // Agregar información adicional útil
        userObj.expirationInfo = {
          expired: now > expirationDate,
          expirationDate: expirationDate,
          minutesRemaining: Math.max(
            0,
            Math.ceil((expirationDate - now) / (1000 * 60))
          )
        };
      }

      return userObj;
    }));

    // Ordenar usuarios: activos primero, luego por rol
    const sortedUsers = processedUsers.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      
      const rolePriority = {
        [ROLES.ADMIN]: 4,
        [ROLES.SUPERVISOR]: 3,
        [ROLES.BASIC]: 2,
        [ROLES.TEMPORAL]: 1
      };
      
      return (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
    });

    res.json(sortedUsers);
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener usuario por ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'email');
    
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar usuario
// Actualizar usuario
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Sólo admin puede cambiar roles
    if (req.body.role && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ msg: 'No tienes permisos para cambiar roles' });
    }

    // No permitir cambios en el admin principal
    if (user.role === ROLES.ADMIN && !user.createdBy) {
      return res.status(403).json({ msg: 'No se puede modificar al administrador principal' });
    }

    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Verificar si se está actualizando el estado isActive
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive === 'true';
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // No permitir eliminar al admin principal
    if (user.role === ROLES.ADMIN && !user.createdBy) {
      return res.status(403).json({ msg: 'No se puede eliminar al administrador principal' });
    }

    await User.deleteOne({ _id: req.params.id });
    res.json({ msg: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener perfil del usuario actual
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('createdBy', 'email');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id, action } = req.params;
    const isActivating = action === 'activate';

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Si estamos activando un usuario temporal
    if (isActivating && user.role === ROLES.TEMPORAL) {
      // Establecer nueva fecha de expiración
      const newExpirationDate = new Date();
      newExpirationDate.setMinutes(newExpirationDate.getMinutes() + 30);
      
      user.expiresAt = newExpirationDate;
    }

    user.isActive = isActivating;
    await user.save();

    // Obtener el usuario actualizado con sus relaciones
    const updatedUser = await User.findById(id)
      .select('-password')
      .populate('createdBy', 'email');

    res.json(updatedUser);
  } catch (error) {
    console.error('Error en toggleUserStatus:', error);
    res.status(500).json({ error: error.message });
  }
};

const reactivateTemporaryUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Verificar que sea un usuario temporal
    if (user.role !== ROLES.TEMPORAL) {
      return res.status(403).json({ msg: 'Solo usuarios temporales pueden ser reactivados' });
    }

    // Verificar si ya está desactivado
    if (!user.isActive) {
      // Restablecer la fecha de expiración por 30 minutos
      const newExpirationDate = new Date();
      newExpirationDate.setMinutes(newExpirationDate.getMinutes() + 30);

      // Actualizar usuario
      user.isActive = true;
      user.expiresAt = newExpirationDate;

      await user.save();

      return res.json({ 
        msg: 'Usuario temporal reactivado', 
        expiresAt: newExpirationDate 
      });
    }

    // Si ya está activo, retornar mensaje
    res.json({ 
      msg: 'El usuario ya está activo', 
      expiresAt: user.expiresAt 
    });

  } catch (error) {
    res.status(500).json({ 
      msg: 'Error al reactivar usuario temporal', 
      error: error.message 
    });
  }
};

module.exports = {
  login,
  register,
  createTemporaryUser,
  createInitialAdmin,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCurrentUser,
  toggleUserStatus,
  reactivateTemporaryUser
};