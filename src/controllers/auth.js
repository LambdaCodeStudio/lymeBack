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

    if (user.role === ROLES.TEMPORAL && user.expiresAt < new Date()) {
      await User.deleteOne({ _id: user._id });
      return res.status(401).json({ msg: 'Usuario temporal expirado' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, role: user.role });
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
    const users = await User.find()
      .select('-password')
      .populate('createdBy', 'email');
    res.json(users);
  } catch (error) {
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
    const isActive = action === 'activate';

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  toggleUserStatus
};