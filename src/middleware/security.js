// Middleware de seguridad optimizado para alto rendimiento
const { validationResult } = require('express-validator');
const hpp = require('hpp');
const cacheService = require('../services/cacheService');

// Sistema de protección contra DoS con caché y probabilidad
let lastDoSCheck = Date.now();
const CHECK_INTERVAL = 5000; // 5 segundos entre verificaciones completas
const SERVER_BUSY_THRESHOLD = process.env.SERVER_BUSY_THRESHOLD || 0.8;

// Métricas de carga
const metrics = {
  requestCount: 0,
  lastMinuteRequests: 0,
  lastReset: Date.now(),
  activeRequests: 0,
  peakActiveRequests: 0
};

// Resetear métricas cada minuto
setInterval(() => {
  metrics.lastMinuteRequests = metrics.requestCount;
  metrics.requestCount = 0;
  metrics.lastReset = Date.now();
}, 60000);

// Protección contra DoS optimizada - no usa toobusy para evitar bloqueo de evento loop
const dosProtection = (req, res, next) => {
  metrics.requestCount++;
  metrics.activeRequests++;
  
  // Actualizar pico de solicitudes activas
  if (metrics.activeRequests > metrics.peakActiveRequests) {
    metrics.peakActiveRequests = metrics.activeRequests;
  }
  
  // Envolver la respuesta para detectar fin de solicitud
  const originalEnd = res.end;
  res.end = function(...args) {
    metrics.activeRequests--;
    return originalEnd.apply(this, args);
  };
  
  // Solo ejecutar la lógica completa cada cierto intervalo
  const now = Date.now();
  if (now - lastDoSCheck > CHECK_INTERVAL) {
    lastDoSCheck = now;
    
    // Calcular factor de carga actual (simplificado)
    const loadFactor = Math.min(
      metrics.activeRequests / 100, // Factor de concurrencia
      metrics.lastMinuteRequests / 5000 // Factor de peticiones por minuto
    );
    
    // Si el sistema está bajo carga alta, rechazar algunas solicitudes
    if (loadFactor > SERVER_BUSY_THRESHOLD) {
      // Probabilidad de rechazo proporcional a la carga
      const rejectProbability = (loadFactor - SERVER_BUSY_THRESHOLD) / (1 - SERVER_BUSY_THRESHOLD);
      
      // No rechazar solicitudes importantes
      const isImportantPath = req.path.includes('/api/auth/login') || 
                             req.path.includes('/api/health');
      
      if (!isImportantPath && Math.random() < rejectProbability) {
        return res.status(503).json({ 
          error: 'El servidor está experimentando alta carga. Por favor, intente nuevamente en unos momentos.',
          retryAfter: 5
        });
      }
    }
  }
  
  next();
};

// Validación de entrada optimizada
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      mensaje: 'Error de validación', 
      errores: errors.array().map(e => ({ param: e.param, msg: e.msg })) // Versión reducida
    });
  }
  next();
};

// Protección contra manipulación de parámetros optimizada
const paramProtectionConfig = {
  whitelist: ['sort', 'filter', 'fields', 'populate'] // Parámetros que pueden repetirse
};

// Crear una sola instancia de middleware
const paramProtection = hpp(paramProtectionConfig);

// Sanitización optimizada - solo ejecuta en rutas que lo necesitan
const sanitizeData = (req, res, next) => {
  // Rutas que no requieren sanitización
  const noSanitizationPaths = [
    '/api/health',
    '/api/producto/imagen',
    '/api/downloads'
  ];
  
  // Comprobar si la ruta actual coincide con alguna de las excluidas
  for (const path of noSanitizationPaths) {
    if (req.path.includes(path)) {
      return next();
    }
  }
  
  // Función optimizada para sanitizar
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>]/g, '').trim();
  };
  
  // Función recursiva simplificada
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }
    
    const result = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        result[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  };
  
  // Sanitizar solo si hay datos
  if (req.body && Object.keys(req.body).length > 0) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params && Object.keys(req.params).length > 0) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Función para obtener estadísticas
const getSecurityStats = () => {
  return {
    metrics: { ...metrics },
    cache: cacheService.getStats()
  };
};

// Middleware para permitir verificar el estado de seguridad
const securityStatsMiddleware = (req, res) => {
  // Solo accesible en desarrollo o con token admin
  if (process.env.NODE_ENV !== 'production' || req.user?.role === 'admin') {
    res.json(getSecurityStats());
  } else {
    res.status(403).json({ error: 'Acceso denegado' });
  }
};

module.exports = { 
  dosProtection, 
  validate,
  paramProtection,
  sanitizeData,
  securityStatsMiddleware
};