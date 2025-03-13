const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ROLES = require('../constants/roles');
const cacheService = require('../services/cacheService');

// Middleware de autenticación optimizado para alto rendimiento
const auth = async (req, res, next) => {
  try {
    // Obtener token con optimización para encontrarlo en diferentes lugares
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        msg: 'Acceso denegado. No se proporcionó token de autenticación.' 
      });
    }

    // Verificar token con manejo de errores optimizado
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (tokenError) {
      return handleTokenError(tokenError, res);
    }

    // Verificar si usuario está en caché para evitar consulta a la base de datos
    const cacheKey = `auth_user_${decoded.id}`;
    let user = cacheService.frequent.get(cacheKey);
    
    if (!user) {
      // No está en caché, buscar en la base de datos
      user = await User.findById(decoded.id)
        .select('-password')
        .lean(); // Usar lean() para mejor rendimiento
      
      if (!user) {
        return res.status(401).json({ msg: 'Usuario no encontrado o eliminado.' });
      }
      
      // Guardar en caché por un tiempo corto (30 segundos)
      // La caché corta reduce el riesgo de usar datos desactualizados de permisos
      cacheService.frequent.set(cacheKey, user, 30);
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      // Invalidar caché si usuario está inactivo
      cacheService.frequent.del(cacheKey);
      return res.status(403).json({ 
        msg: 'Su cuenta ha sido desactivada. Contacte al administrador.' 
      });
    }

    // Verificar operarios temporales
    if (user.role === ROLES.OPERARIO && user.expiresAt) {
      const now = new Date();
      if (new Date(user.expiresAt) < now) {
        // Desactivar operario temporal expirado
        await User.updateOne(
          { _id: user._id }, 
          { $set: { isActive: false } }
        );
        
        // Invalidar caché
        cacheService.frequent.del(cacheKey);
        
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
      msg: 'Error en el servidor durante la autenticación.'
    });
  }
};

// Extraer token de diferentes lugares
function extractToken(req) {
  let token;
  
  // Verificar si el token viene en headers (método preferido)
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } 
  // Verificar si viene como query parameter (solo desarrollo)
  else if (process.env.NODE_ENV !== 'production' && req.query && req.query.token) {
    token = req.query.token;
  }
  // Verificar en cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  return token;
}

// Manejar errores de token
function handleTokenError(error, res) {
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ msg: 'Token inválido. Por favor, inicie sesión nuevamente.' });
  }
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ msg: 'La sesión ha expirado. Por favor, inicie sesión nuevamente.' });
  }
  // Error genérico de token
  return res.status(401).json({ msg: 'Error de autenticación. Por favor, inicie sesión nuevamente.' });
}

module.exports = auth;