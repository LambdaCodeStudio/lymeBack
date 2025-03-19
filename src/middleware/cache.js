// src/middleware/cache.js
const NodeCache = require('node-cache');

/**
 * Caché centralizada para ser usada en toda la aplicación
 * Configuración:
 * - stdTTL: tiempo de vida por defecto en segundos (10 minutos)
 * - checkperiod: período para verificar claves expiradas (2 minutos)
 * - useClones: false mejora el rendimiento con objetos grandes
 */
const appCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  useClones: false,
  deleteOnExpire: true
});

/**
 * Middleware de caché para rutas Express
 * Cachea respuestas por tiempo definido basadas en la URL y parámetros
 * 
 * @param {Number} duration - Duración de la caché en segundos
 * @param {Function} keyGenerator - Función personalizada para generar claves de caché
 * @returns {Function} - Middleware Express
 */
const cacheMiddleware = (duration = 60, keyGenerator = null) => {
  return (req, res, next) => {
    // No cachear si el método no es GET
    if (req.method !== 'GET') {
      return next();
    }
    
    // No cachear si hay cabecera específica
    if (req.headers['x-no-cache']) {
      return next();
    }
    
    // Generar clave de caché
    const key = keyGenerator ? 
      keyGenerator(req) : 
      `${req.originalUrl || req.url}_${JSON.stringify(req.query)}`;
    
    // Verificar si existe en caché
    const cachedData = appCache.get(key);
    
    if (cachedData) {
      // Devolver los datos cacheados
      res.set('X-Cache', 'HIT');
      return res.status(cachedData.status).json(cachedData.body);
    }
    
    // Si no está en caché, interceptar la respuesta para cachearla
    const originalSend = res.json;
    
    res.json = function(body) {
      // Solo cachear respuestas exitosas (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        appCache.set(key, {
          status: res.statusCode,
          body: body
        }, duration);
      }
      
      res.set('X-Cache', 'MISS');
      return originalSend.call(this, body);
    };
    
    next();
  };
};

/**
 * Limpia toda la caché
 * @returns {Boolean} - true si la operación fue exitosa
 */
const clearCache = () => {
  return appCache.flushAll();
};

/**
 * Elimina una clave específica de la caché
 * @param {String} key - Clave a eliminar
 * @returns {Boolean} - true si la clave existía y fue eliminada
 */
const deleteCacheKey = (key) => {
  return appCache.del(key);
};

/**
 * Elimina claves que coincidan con un patrón
 * @param {RegExp} pattern - Patrón para coincidencia (RegExp)
 * @returns {Number} - Número de claves eliminadas
 */
const deleteCachePattern = (pattern) => {
  if (!(pattern instanceof RegExp)) {
    console.error('El patrón debe ser una expresión regular');
    return 0;
  }
  
  const keys = appCache.keys();
  let deletedCount = 0;
  
  keys.forEach(key => {
    if (pattern.test(key)) {
      appCache.del(key);
      deletedCount++;
    }
  });
  
  return deletedCount;
};

/**
 * Middleware para limpiar la caché al recibir solicitudes POST, PUT, PATCH o DELETE
 * Útil para invalidar caché automáticamente en rutas que modifican datos
 * 
 * @param {RegExp} pattern - Patrón para determinar qué claves de caché invalidar
 * @returns {Function} - Middleware Express
 */
const clearCacheOnWrite = (pattern) => {
  return (req, res, next) => {
    // Solo aplicar en métodos de escritura
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    
    if (!writeMethods.includes(req.method)) {
      return next();
    }
    
    // Ejecutar después de completar la solicitud
    res.on('finish', () => {
      // Solo invalidar caché si la respuesta fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (pattern) {
          deleteCachePattern(pattern);
        } else {
          // Si no se proporciona patrón, solo invalidar caché relacionada con la ruta base
          const baseRoute = req.baseUrl || req.path.split('/')[1];
          deleteCachePattern(new RegExp(`^/${baseRoute}`));
        }
      }
    });
    
    next();
  };
};

/**
 * Estadísticas sobre el estado actual de la caché
 * @returns {Object} - Estadísticas de uso
 */
const getCacheStats = () => {
  return appCache.getStats();
};

module.exports = {
  appCache,
  cacheMiddleware,
  clearCache,
  deleteCacheKey,
  deleteCachePattern,
  clearCacheOnWrite,
  getCacheStats
};