const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ROLES = require('../constants/roles');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ msg: 'No hay token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ msg: 'Usuario no encontrado' });
    }

    // Verificar si el usuario temporal ha expirado y desactivarlo si es necesario
    if (user.role === ROLES.TEMPORAL && user.expiresAt) {
      const now = new Date();
      if (user.expiresAt < now && user.isActive) {
        // En lugar de eliminar, simplemente desactivamos
        user.isActive = false;
        await user.save();
      }
    }

    // Adjuntar el usuario a la request
    req.user = {
      id: user._id,
      email: user.email,
      usuario: user.usuario,
      celular: user.celular,
      nombre: user.nombre,
      apellido: user.apellido,
      role: user.role,
      isActive: user.isActive,
      expiresAt: user.expiresAt
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Token inválido' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expirado' });
    }
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

module.exports = auth;