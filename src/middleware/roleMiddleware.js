const ROLES = require('../constants/roles');

// Middleware para verificar si es admin o supervisor
const isAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.SUPERVISOR) {
    return res.status(403).json({ 
      msg: 'Acceso denegado. Se requieren permisos de administrador.' 
    });
  }
  next();
};

// Middleware para verificar si es SOLO admin (no supervisor)
const isOnlyAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ 
      msg: 'Acceso denegado. Se requieren permisos de administrador principal.' 
    });
  }
  next();
};

// Middleware para verificar roles específicos (más flexible)
const hasRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!Array.isArray(allowedRoles)) {
      allowedRoles = [allowedRoles];
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        msg: 'Acceso denegado. No tienes los permisos necesarios.' 
      });
    }
    next();
  };
};

module.exports = {
  isAdmin,
  isOnlyAdmin,
  hasRole
};