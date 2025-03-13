// src/services/cacheService.js
const NodeCache = require('node-cache');
const crypto = require('crypto');

// Configuración de caché con valores optimizados
const defaultCache = new NodeCache({
  stdTTL: 300,             // 5 minutos por defecto
  checkperiod: 120,        // Verificar cada 2 minutos
  useClones: false,        // No clonar objetos para mejor rendimiento
  deleteOnExpire: true,    // Liberar memoria inmediatamente
  maxKeys: -1              // Sin límite de claves
});

// Caché específica para productos con TTL más largo
const productoCache = new NodeCache({
  stdTTL: 600,             // 10 minutos para productos
  checkperiod: 240,        // Verificar cada 4 minutos
  useClones: false
});

// Caché para datos frecuentes con TTL corto
const frequentCache = new NodeCache({
  stdTTL: 60,              // 1 minuto
  checkperiod: 30,         // Verificar cada 30 segundos
  useClones: false
});

// Estadísticas de cache
const stats = {
  hits: 0,
  misses: 0,
  keys: 0,
  lastReset: Date.now()
};

// Resetear estadísticas cada hora
setInterval(() => {
  stats.hits = 0;
  stats.misses = 0;
  stats.keys = defaultCache.keys().length + 
               productoCache.keys().length + 
               frequentCache.keys().length;
  stats.lastReset = Date.now();
}, 3600000);

// Generar hash para claves de caché
function hashKey(key) {
  if (typeof key === 'string') {
    return key;
  }
  // Para objetos complejos, crear hash
  const str = JSON.stringify(key);
  return crypto.createHash('md5').update(str).digest('hex');
}

// Funciones generales de caché con diferente TTL según el tipo de datos
const cacheService = {
  // Caché para productos (larga duración, más utilizada)
  productos: {
    get: (key) => {
      const hashedKey = hashKey(key);
      const value = productoCache.get(hashedKey);
      if (value !== undefined) {
        stats.hits++;
        return value;
      }
      stats.misses++;
      return null;
    },
    set: (key, value, ttl = 600) => {
      const hashedKey = hashKey(key);
      productoCache.set(hashedKey, value, ttl);
    },
    del: (key) => {
      const hashedKey = hashKey(key);
      productoCache.del(hashedKey);
    },
    flush: () => {
      productoCache.flushAll();
    }
  },
  
  // Caché para datos frecuentes (corta duración, alto hit ratio)
  frequent: {
    get: (key) => {
      const hashedKey = hashKey(key);
      const value = frequentCache.get(hashedKey);
      if (value !== undefined) {
        stats.hits++;
        return value;
      }
      stats.misses++;
      return null;
    },
    set: (key, value, ttl = 60) => {
      const hashedKey = hashKey(key);
      frequentCache.set(hashedKey, value, ttl);
    },
    del: (key) => {
      const hashedKey = hashKey(key);
      frequentCache.del(hashedKey);
    },
    flush: () => {
      frequentCache.flushAll();
    }
  },
  
  // Caché general (duración media)
  default: {
    get: (key) => {
      const hashedKey = hashKey(key);
      const value = defaultCache.get(hashedKey);
      if (value !== undefined) {
        stats.hits++;
        return value;
      }
      stats.misses++;
      return null;
    },
    set: (key, value, ttl = 300) => {
      const hashedKey = hashKey(key);
      defaultCache.set(hashedKey, value, ttl);
    },
    del: (key) => {
      const hashedKey = hashKey(key);
      defaultCache.del(hashedKey);
    },
    flush: () => {
      defaultCache.flushAll();
    }
  },
  
  // Funciones globales
  flushAll: () => {
    defaultCache.flushAll();
    productoCache.flushAll();
    frequentCache.flushAll();
  },
  
  getStats: () => {
    return {
      ...stats,
      keys: {
        default: defaultCache.keys().length,
        productos: productoCache.keys().length,
        frequent: frequentCache.keys().length,
        total: defaultCache.keys().length + 
               productoCache.keys().length + 
               frequentCache.keys().length
      },
      hitRatio: stats.hits + stats.misses > 0 ? 
                (stats.hits / (stats.hits + stats.misses)) * 100 : 0
    };
  }
};

module.exports = cacheService;