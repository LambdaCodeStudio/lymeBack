// src/middleware/security.js
const toobusy = require('toobusy-js');
const { validationResult } = require('express-validator');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

/**
 * Configuración de toobusy para protección contra sobrecarga
 * Aumentado el maxLag para permitir más carga antes de rechazar solicitudes
 */
toobusy.maxLag(process.env.SERVER_MAX_LAG || 150);

/**
 * Middleware de protección contra DoS - adaptado para entornos serverless
 * Optimizado para soportar más carga de solicitudes
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const dosProtection = (req, res, next) => {
  // En producción, ser más permisivo para manejar más solicitudes
  if (process.env.NODE_ENV === 'production') {
    // Reducir la probabilidad de rechazar solicitudes cuando el servidor está ocupado
    if (toobusy() && Math.random() < 0.5) {
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
 * Optimizado para mayor rendimiento en alta carga
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
        // Sanitizar valores string - método optimizado
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
  
  // Optimización: solo sanitizar si hay datos
  if (req.body && Object.keys(req.body).length > 0) req.body = sanitizeObject(req.body);
  if (req.query && Object.keys(req.query).length > 0) req.query = sanitizeObject(req.query);
  if (req.params && Object.keys(req.params).length > 0) req.params = sanitizeObject(req.params);
  
  next();
};

/**
 * Middleware para sanitización de datos MongoDB
 * Previene inyecciones de MongoDB
 */
const mongoSanitizer = mongoSanitize({
  replaceWith: '_',
  // Deshabilitado el log para mejorar rendimiento en alta carga
  onSanitize: ({ req, key }) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Intento de inyección MongoDB detectado en '${key}'`);
    }
  }
});

/**
 * Middleware para sanitización XSS
 * Limpia datos para prevenir ataques XSS (Cross-Site Scripting)
 */
const xssSanitizer = xss();

/**
 * Middleware de límite de tasa - configurado para API de alto rendimiento
 * @param {Number} windowMs - Ventana de tiempo en milisegundos
 * @param {Number} max - Número máximo de solicitudes por ventana
 * @returns {Function} - Middleware configurado
 */
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100000) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Demasiadas solicitudes, por favor intente nuevamente más tarde.'
    },
    // Función optimizada para mayor rendimiento
    keyGenerator: (req) => {
      // Usar solo IP para mejor rendimiento
      return process.env.NODE_ENV === 'production' ? 
        req.ip : 
        `${req.method}:${req.path}:${req.ip}`;
    },
    // Deshabilitar logging para mejorar rendimiento
    skip: (req) => {
      // No aplicar limitación a solicitudes de verificación de estado
      return req.path === '/api/health';
    }
  });
};

/**
 * Limitador específico para operaciones de carga masiva
 * Aumentado considerablemente para permitir 10,000 peticiones por minuto
 */
const bulkOperationsLimiter = createRateLimiter(1 * 60 * 1000, 10000); // 10000 peticiones por minuto

/**
 * Límite de tasa para rutas de autenticación (más estricto pero aumentado)
 */
const authLimiter = createRateLimiter(15 * 60 * 1000, 150000); // 10000 por minuto

/**
 * Límite de tasa global para toda la API (aumentado)
 */
const apiLimiter = createRateLimiter(15 * 60 * 1000, 500000); // ~33000 por minuto

/**
 * Middleware que agrupa todas las protecciones básicas de seguridad
 * Optimizado para permitir mayor volumen de solicitudes
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
  bulkOperationsLimiter,
  
  // Bundle de seguridad (todos en uno)
  securityBundle
};