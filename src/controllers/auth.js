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

const register = async (req, res) => {
  try {
    const creator = await User.findById(req.user.id);
    if (!creator) {
      return res.status(401).json({ msg: 'Usuario creador no encontrado' });
    }

    // Validar permisos según el rol del creador
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

const createTemporaryUser = async (req, res) => {
  try {
    const creator = await User.findById(req.user.id);
    if (!creator) {
      return res.status(401).json({ msg: 'Usuario creador no encontrado' });
    }

    // Verificar si el creador tiene permisos
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

const login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ msg: 'Usuario no existe' });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Contraseña incorrecta' });

    // Si es un usuario temporal, verificar si no ha expirado
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

module.exports = { 
  register, 
  login, 
  createTemporaryUser,
  createInitialAdmin 
};