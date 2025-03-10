const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ROLES = require('../constants/roles');

const auth = async (req, res, next) => {
  try {
    // Mejorar la obtención del token para ser más flexible
    let token;
    
    // Verificar si el token viene en headers
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } 
    // Verificar si viene como query parameter (menos seguro, solo para desarrollo)
    else if (process.env.NODE_ENV !== 'production' && req.query && req.query.token) {
      token = req.query.token;
    }
    // Verificar en cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ 
        msg: 'Acceso denegado. No se proporcionó token de autenticación.' 
      });
    }

    // Verificar el token con manejo de errores mejorado
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (tokenError) {
      if (tokenError.name === 'JsonWebTokenError') {
        return res.status(401).json({ msg: 'Token inválido. Por favor, inicie sesión nuevamente.' });
      }
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: 'La sesión ha expirado. Por favor, inicie sesión nuevamente.' });
      }
      throw tokenError; // Propagar otros errores inesperados
    }

    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ msg: 'Usuario no encontrado o eliminado.' });
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(403).json({ 
        msg: 'Su cuenta ha sido desactivada. Contacte al administrador.' 
      });
    }

    // Verificar usuarios temporales o operarios temporales
    if ((user.role === ROLES.TEMPORARIO || 
        (user.role === ROLES.OPERARIO && user.expiresAt)) && 
        user.expiresAt) {
      const now = new Date();
      if (user.expiresAt < now) {
        // Desactivar usuario temporal expirado
        user.isActive = false;
        await user.save();
        
        return res.status(401).json({ 
          msg: 'Su acceso temporal ha expirado. Por favor, solicite un nuevo acceso.' 
        });
      }
    }

    // Usuario autenticado correctamente, adjuntar información a la request
    req.user = {
      id: user._id,
      usuario: user.usuario,
      celular: user.celular,
      nombre: user.nombre,
      apellido: user.apellido,
      role: user.role,
      isActive: user.isActive,
      expiresAt: user.expiresAt,
      secciones: user.secciones
    };

    next();
  } catch (err) {
    console.error('Error en middleware de autenticación:', err);
    res.status(500).json({ 
      msg: 'Error en el servidor durante la autenticación.',
      error: process.env.NODE_ENV === 'production' ? null : err.message
    });
  }
};

module.exports = auth;