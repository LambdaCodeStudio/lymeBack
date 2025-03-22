// src/middleware/cache.js
const NodeCache = require('node-cache');

/**
 * Caché centralizada para ser usada en toda la aplicación
 * Configuración optimizada para alto rendimiento:
 * - stdTTL: tiempo de vida por defecto en segundos (30 minutos)
 * - checkperiod: período para verificar claves expiradas (5 minutos)
 * - useClones: false mejora el rendimiento con objetos grandes
 * - maxKeys: limitado para evitar consumo excesivo de memoria
 */
const appCache = new NodeCache({
  stdTTL: 1800,
  checkperiod: 300,
  useClones: false,
  deleteOnExpire: true,
  maxKeys: 10000 // Limitar número de claves para evitar problemas de memoria
});

/**
 * Middleware de caché para rutas Express
 * Optimizado para alto rendimiento y carga de 10,000 peticiones por minuto
 * 
 * @param {Number} duration - Duración de la caché en segundos
 * @param {Function} keyGenerator - Función personalizada para generar claves de caché
 * @returns {Function} - Middleware Express
 */
const cacheMiddleware = (duration = 300, keyGenerator = null) => {
  return (req, res, next) => {
    // No cachear si el método no es GET
    if (req.method !== 'GET') {
      return next();
    }
    
    // No cachear si hay cabecera específica
    if (req.headers['x-no-cache']) {
      return next();
    }
    
    // No cachear peticiones autenticadas por defecto (pueden tener datos personalizados)
    if (req.user && !req.headers['x-cache-auth']) {
      return next();
    }
    
    // Generar clave de caché optimizada
    const key = keyGenerator ? 
      keyGenerator(req) : 
      `${req.originalUrl || req.url}`;
    
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
      // Solo cachear respuestas exitosas (2xx) y no vacías
      if (res.statusCode >= 200 && res.statusCode < 300 && body) {
        // No cachear respuestas con errores
        if (!body.error && (body.success === undefined || body.success === true)) {
          // Usar TTL dinámico basado en tamaño de respuesta para optimizar memoria
          const dataSize = JSON.stringify(body).length;
          let cacheDuration = duration;
          
          // Ajustar duración de caché basado en tamaño para optimizar
          if (dataSize > 500000) { // 500KB
            cacheDuration = Math.min(duration, 60); // 1 minuto máximo para datos grandes
          } else if (dataSize > 100000) { // 100KB
            cacheDuration = Math.min(duration, 300); // 5 minutos máximo para datos medianos
          }
          
          appCache.set(key, {
            status: res.statusCode,
            body: body
          }, cacheDuration);
        }
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
 * Optimizado para rendimiento en alta carga
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
  
  // Limitar el número de eliminaciones por operación para prevenir bloqueo
  const maxDeletions = 1000;
  const keysToDelete = keys.filter(key => pattern.test(key)).slice(0, maxDeletions);
  
  if (keysToDelete.length > 0) {
    appCache.del(keysToDelete);
    deletedCount = keysToDelete.length;
  }
  
  return deletedCount;
};

/**
 * Middleware para limpiar la caché al recibir solicitudes POST, PUT, PATCH o DELETE
 * Optimizado para alto rendimiento
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
    
    // Capturar la ruta base para invalidación selectiva
    const baseRoute = req.baseUrl || req.path.split('/')[1];
    
    // Ejecutar después de completar la solicitud
    res.on('finish', () => {
      // Solo invalidar caché si la respuesta fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (pattern) {
          // Invalidar por patrón en segundo plano para no bloquear respuesta
          setImmediate(() => {
            deleteCachePattern(pattern);
          });
        } else {
          // Si no se proporciona patrón, solo invalidar caché relacionada con la ruta base
          setImmediate(() => {
            deleteCachePattern(new RegExp(`^/${baseRoute}`));
          });
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

/**
 * Elimina las claves de caché menos usadas para liberar memoria
 * Útil para mantener rendimiento en escenarios de alta carga
 * @param {Number} percentage - Porcentaje de claves a eliminar (1-100)
 * @returns {Number} - Número de claves eliminadas
 */
const pruneCache = (percentage = 20) => {
  const keys = appCache.keys();
  if (keys.length === 0) return 0;
  
  // Calcular cuántas claves eliminar
  const numToDelete = Math.ceil(keys.length * (percentage / 100));
  if (numToDelete <= 0) return 0;
  
  // Obtener estadísticas de uso para cada clave
  const keyStats = [];
  keys.forEach(key => {
    const stats = appCache.getTtl(key);
    keyStats.push({ key, ttl: stats });
  });
  
  // Ordenar por TTL ascendente (eliminar primero las que caducarán pronto)
  keyStats.sort((a, b) => a.ttl - b.ttl);
  
  // Eliminar el porcentaje especificado de claves
  const keysToDelete = keyStats.slice(0, numToDelete).map(item => item.key);
  appCache.del(keysToDelete);
  
  return keysToDelete.length;
};

module.exports = {
  appCache,
  cacheMiddleware,
  clearCache,
  deleteCacheKey,
  deleteCachePattern,
  clearCacheOnWrite,
  getCacheStats,
  pruneCache // Nueva función para optimizar la caché
};