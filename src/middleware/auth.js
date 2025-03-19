// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ROLES = require('../constants/roles');

/**
 * Middleware de autenticación para verificar tokens JWT
 * Detecta tokens en headers, query params y cookies con manejo avanzado de errores
 * Verifica estado activo del usuario y caducidad de operarios temporales
 * 
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const auth = async (req, res, next) => {
  try {
    // 1. Extraer token de múltiples fuentes
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Acceso denegado. No se proporcionó token de autenticación.' 
      });
    }

    // 2. Verificar token con manejo de errores mejorado
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (tokenError) {
      return handleTokenError(tokenError, res);
    }

    // 3. Validar usuario y verificar estado
    const user = await validateUser(decodedToken.id, res);
    if (!user) return; // Si validateUser devuelve falso, ya se envió una respuesta de error

    // 4. Verificar permisos y estado de operarios temporales
    const userState = await checkUserState(user, res);
    if (!userState) return; // Si checkUserState devuelve falso, ya se envió una respuesta de error

    // 5. Usuario autenticado correctamente, adjuntar información a la request
    attachUserToRequest(req, user);

    next();
  } catch (err) {
    console.error('Error en middleware de autenticación:', err);
    
    return res.status(500).json({ 
      success: false,
      message: 'Error en el servidor durante la autenticación.',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
};

/**
 * Extrae el token JWT de diferentes fuentes (headers, query, cookies)
 * @param {Object} req - Objeto de solicitud Express
 * @returns {String|null} - Token JWT o null si no se encuentra
 */
function extractToken(req) {
  // 1. Intentar obtener token del header Authorization
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  } 
  
  // 2. En desarrollo, permitir token por query parameter
  if (process.env.NODE_ENV !== 'production' && req.query && req.query.token) {
    return req.query.token;
  }
  
  // 3. Intentar obtener token de cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  // 4. Verificar si viene en X-Access-Token header (alternativa)
  const xAccessToken = req.header('X-Access-Token');
  if (xAccessToken) {
    return xAccessToken;
  }
  
  return null;
}

/**
 * Maneja errores específicos de validación de token JWT
 * @param {Error} error - Error de validación de token
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Respuesta HTTP con error específico
 */
function handleTokenError(error, res) {
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false,
      message: 'Token inválido. Por favor, inicie sesión nuevamente.' 
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      success: false,
      message: 'La sesión ha expirado. Por favor, inicie sesión nuevamente.' 
    });
  }
  
  if (error.name === 'NotBeforeError') {
    return res.status(401).json({ 
      success: false,
      message: 'Token aún no válido. Intente más tarde.' 
    });
  }
  
  // Otros errores inesperados
  return res.status(401).json({ 
    success: false,
    message: 'Error de autenticación. Por favor, inicie sesión nuevamente.' 
  });
}

/**
 * Valida que el usuario exista y esté activo
 * @param {String} userId - ID del usuario a validar
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object|false} - Usuario si es válido, false si hubo error
 */
async function validateUser(userId, res) {
  // Usar select con campos específicos para rendimiento
  const user = await User.findById(userId)
    .select('_id usuario nombre apellido role isActive expiresAt secciones celular')
    .lean();

  if (!user) {
    res.status(401).json({ 
      success: false,
      message: 'Usuario no encontrado o eliminado. Por favor, inicie sesión nuevamente.' 
    });
    return false;
  }

  if (!user.isActive) {
    res.status(403).json({ 
      success: false,
      message: 'Su cuenta ha sido desactivada. Contacte al administrador.' 
    });
    return false;
  }

  return user;
}

/**
 * Verifica el estado especial de operarios temporales
 * @param {Object} user - Usuario a verificar
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Boolean} - true si el estado es válido, false si hubo error
 */
async function checkUserState(user, res) {
  // Verificar operarios temporales
  if (user.role === ROLES.OPERARIO && user.expiresAt) {
    const now = new Date();
    if (user.expiresAt < now) {
      // Desactivar operario temporal expirado
      await User.findByIdAndUpdate(user._id, { 
        isActive: false 
      });
      
      res.status(401).json({ 
        success: false,
        message: 'Su acceso temporal ha expirado. Por favor, solicite un nuevo acceso.' 
      });
      return false;
    }
  }
  
  return true;
}

/**
 * Adjunta la información del usuario a la solicitud
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} user - Datos del usuario
 */
function attachUserToRequest(req, user) {
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
  
  // Agregar campos virtuales útiles
  req.user.isAdmin = user.role === ROLES.ADMIN;
  req.user.isSupervisorDeSupervisores = user.role === ROLES.SUPERVISOR_DE_SUPERVISORES;
  req.user.isSupervisor = user.role === ROLES.SUPERVISOR;
  req.user.isOperario = user.role === ROLES.OPERARIO;
  req.user.isTemporary = user.role === ROLES.OPERARIO && !!user.expiresAt;
  
  // Agregar función de ayuda para verificar roles
  req.user.hasRole = (role) => {
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };
}

/**
 * Middleware opcional que solo verifica la autenticación sin detener el flujo
 * Útil para rutas que funcionan con o sin autenticación
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    // Si no hay token, continuar sin autenticar
    if (!token) {
      return next();
    }
    
    // Verificar token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario
      const user = await User.findById(decoded.id)
        .select('_id usuario nombre apellido role isActive expiresAt secciones celular')
        .lean();
      
      if (user && user.isActive) {
        attachUserToRequest(req, user);
      }
    } catch (error) {
      // Ignorar errores - continuar sin autenticar
      console.log('Token opcional inválido:', error.message);
    }
    
    next();
  } catch (error) {
    // En caso de error, continuar sin autenticar
    console.error('Error en optionalAuth:', error);
    next();
  }
};

module.exports = {
  auth,
  optionalAuth,
  // Exportar funciones individuales para casos especiales
  extractToken,
  validateUser,
  checkUserState
};