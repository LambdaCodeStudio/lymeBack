// src/middleware/roleMiddleware.js
const ROLES = require('../constants/roles');

/**
 * Define la jerarquía de roles en forma de mapa para consultas eficientes
 * Los roles están ordenados jerárquicamente donde cada rol puede acceder a sus propias
 * funcionalidades y a las de los roles por debajo en la jerarquía
 */
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 100,
  [ROLES.SUPERVISOR_DE_SUPERVISORES]: 80,
  [ROLES.SUPERVISOR]: 60,
  [ROLES.OPERARIO]: 40
};

/**
 * Verifica si un rol tiene mayor o igual nivel que otro
 * @param {String} baseRole - Rol base para comparar
 * @param {String} requiredRole - Rol requerido
 * @returns {Boolean} - True si el rol base tiene suficiente nivel
 */
const hasRoleLevel = (baseRole, requiredRole) => {
  return (ROLE_HIERARCHY[baseRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
};

/**
 * Middleware para verificar si el usuario tiene rol de administrador o supervisor de supervisores
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.SUPERVISOR_DE_SUPERVISORES) {
    return res.status(403).json({ 
      success: false,
      message: 'Acceso denegado. Se requieren permisos de administración.' 
    });
  }
  next();
};

/**
 * Middleware para verificar si el usuario tiene rol de administrador principal
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const isOnlyAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ 
      success: false,
      message: 'Acceso denegado. Se requieren permisos de administrador principal.' 
    });
  }
  next();
};

/**
 * Middleware para verificar si el usuario puede crear otros usuarios
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const canCreateUsers = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.SUPERVISOR_DE_SUPERVISORES) {
    return res.status(403).json({ 
      success: false,
      message: 'Acceso denegado. No tienes permisos para crear usuarios.' 
    });
  }
  next();
};

/**
 * Middleware para verificar roles específicos (más flexible)
 * @param {String|Array} allowedRoles - Rol o array de roles permitidos
 * @returns {Function} - Middleware de Express
 */
const hasRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida para acceder a este recurso'
      });
    }
    
    // Convertir a array si es un solo valor
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // Comprobar si el rol del usuario está en la lista de permitidos
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: 'Acceso denegado. No tienes los permisos necesarios.' 
      });
    }
    
    next();
  };
};

/**
 * Middleware para verificar roles según jerarquía
 * Permite acceso si el usuario tiene un rol de igual o mayor nivel
 * @param {String} minimumRole - Rol mínimo requerido
 * @returns {Function} - Middleware de Express
 */
const hasMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida para acceder a este recurso'
      });
    }
    
    // Comprobar si el rol del usuario tiene suficiente nivel jerárquico
    if (!hasRoleLevel(req.user.role, minimumRole)) {
      return res.status(403).json({ 
        success: false,
        message: `Acceso denegado. Se requiere al menos nivel de ${minimumRole}.` 
      });
    }
    
    next();
  };
};

/**
 * Middleware para verificar permisos de sección
 * Asegura que el usuario tenga acceso a una sección específica de la aplicación
 * @param {String|Array} requiredSections - Sección o array de secciones permitidas
 * @returns {Function} - Middleware de Express
 */
const hasSection = (requiredSections) => {
  return (req, res, next) => {
    if (!req.user || !req.user.secciones) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida para acceder a este recurso'
      });
    }
    
    // Si el usuario tiene acceso a todas las secciones
    if (req.user.secciones === 'ambos') {
      return next();
    }
    
    // Convertir a array si es un solo valor
    const sections = Array.isArray(requiredSections) ? requiredSections : [requiredSections];
    
    // Comprobar si la sección del usuario está entre las requeridas
    if (!sections.includes(req.user.secciones)) {
      return res.status(403).json({ 
        success: false,
        message: 'Acceso denegado. No tienes acceso a esta sección.' 
      });
    }
    
    next();
  };
};

module.exports = {
  isAdmin,
  isOnlyAdmin,
  canCreateUsers,
  hasRole,
  hasMinimumRole,
  hasSection,
  // Exportar utilidades para uso interno en otros módulos
  hasRoleLevel,
  ROLE_HIERARCHY
};