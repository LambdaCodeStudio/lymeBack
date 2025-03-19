// src/middleware/security.js
const toobusy = require('toobusy-js');
const { validationResult } = require('express-validator');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

/**
 * Configuración de toobusy para protección contra sobrecarga
 * Valores más altos reducen falsos positivos pero reaccionan más lento a la sobrecarga
 */
toobusy.maxLag(process.env.SERVER_MAX_LAG || 70);

/**
 * Middleware de protección contra DoS - adaptado para entornos serverless
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const dosProtection = (req, res, next) => {
  // En producción, ser más permisivo ya que las funciones serverless escalan automáticamente
  if (process.env.NODE_ENV === 'production') {
    // Rechazar solo una parte de las solicitudes cuando el servidor está ocupado
    if (toobusy() && Math.random() < 0.8) {
      return res.status(503).json({ 
        success: false,
        message: 'El servidor está experimentando alta carga. Por favor, intente nuevamente en unos momentos.' 
      });
    }
    return next();
  }
  
  // En entornos de desarrollo, comportamiento más estricto para detectar problemas
  if (toobusy()) {
    return res.status(503).json({ 
      success: false,
      message: 'Servidor ocupado. Intente más tarde.' 
    });
  }
  
  next();
};

/**
 * Middleware para validar resultados de express-validator
 * NOTA: Esta función se mantiene por compatibilidad pero se recomienda usar
 * el middleware 'validate.js' para nuevas rutas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Error de validación en los datos enviados', 
      errors: errors.array() 
    });
  }
  next();
};

/**
 * Middleware de protección contra manipulación de parámetros HTTP
 * Evita duplicación de parámetros que podría llevar a confusión o ataques
 */
const paramProtection = hpp({
  whitelist: [
    // Lista de parámetros que pueden repetirse de forma segura
    'sort', 'filter', 'fields', 'populate', 'ids', 'tags'
  ]
});

/**
 * Middleware para sanitización básica de datos
 * Elimina caracteres potencialmente peligrosos de las entradas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const sanitizeData = (req, res, next) => {
  // Función recursiva para sanitizar strings en un objeto
  const sanitizeObject = (obj) => {
    if (!obj) return obj;
    
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        // Sanitizar valores string
        obj[key] = obj[key]
          .replace(/[<>]/g, '') // Eliminar < y > para prevenir XSS básico
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Recursivamente sanitizar objetos anidados
        sanitizeObject(obj[key]);
      }
    });
    
    return obj;
  };
  
  // Sanitizar body, query y params
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  
  next();
};

/**
 * Middleware para sanitización de datos MongoDB
 * Previene inyecciones de MongoDB
 */
const mongoSanitizer = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Intento de inyección MongoDB detectado en '${key}'`);
  }
});

/**
 * Middleware para sanitización XSS
 * Limpia datos para prevenir ataques XSS (Cross-Site Scripting)
 */
const xssSanitizer = xss();

/**
 * Middleware de límite de tasa - configurado para API
 * @param {Number} windowMs - Ventana de tiempo en milisegundos
 * @param {Number} max - Número máximo de solicitudes por ventana
 * @returns {Function} - Middleware configurado
 */
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Demasiadas solicitudes, por favor intente nuevamente más tarde.'
    },
    // Personalizar función de clave para considerar IP y usuario
    keyGenerator: (req) => {
      const identifier = req.user ? `user:${req.user.id}` : req.ip;
      return `${req.method}:${req.path}:${identifier}`;
    }
  });
};

/**
 * Límite de tasa para rutas de autenticación (más estricto)
 */
const authLimiter = createRateLimiter(15 * 60 * 1000, 20);

/**
 * Límite de tasa global para toda la API
 */
const apiLimiter = createRateLimiter(15 * 60 * 1000, 100);

/**
 * Middleware que agrupa todas las protecciones básicas de seguridad
 * Útil para aplicar un conjunto estándar de protecciones a todas las rutas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const securityBundle = [
  dosProtection,
  mongoSanitizer,
  xssSanitizer,
  paramProtection,
  sanitizeData
];

module.exports = { 
  // Middleware individuales
  dosProtection, 
  validateInput,
  paramProtection,
  sanitizeData,
  mongoSanitizer,
  xssSanitizer,
  
  // Limitadores de tasa
  apiLimiter,
  authLimiter,
  createRateLimiter,
  
  // Bundle de seguridad (todos en uno)
  securityBundle
};