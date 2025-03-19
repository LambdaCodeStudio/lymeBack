const toobusy = require('toobusy-js');
const { validationResult } = require('express-validator');
const hpp = require('hpp');

// Configurar toobusy para ser menos sensible en Vercel
toobusy.maxLag(70); // Valor predeterminado es 70ms, aumentarlo para entornos serverless

// Protección contra DoS - adaptada para entornos serverless
const dosProtection = (req, res, next) => {
  // En entornos de producción como Vercel, podemos ajustar o deshabilitar esta protección
  if (process.env.NODE_ENV === 'production') {
    // En Vercel, podríamos querer ser más permisivos ya que las funciones se escalan automáticamente
    if (toobusy() && Math.random() < 0.8) { // Solo rechazar ~80% de las solicitudes cuando está ocupado
      return res.status(503).json({ 
        error: 'El servidor está experimentando alta carga. Por favor, intente nuevamente en unos momentos.' 
      });
    }
    return next();
  }
  
  // En desarrollo, comportamiento normal
  if (toobusy()) {
    return res.status(503).json({ error: 'Servidor ocupado. Intente más tarde.' });
  }
  
  next();
};

// Validación de entrada mejorada
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      mensaje: 'Error de validación en los datos enviados', 
      errores: errors.array() 
    });
  }
  next();
};

// Protección contra manipulación de parámetros
const paramProtection = hpp({
  whitelist: [
    // Lista de parámetros que pueden repetirse
    'sort', 'filter', 'fields', 'populate'
  ]
});

// Sanitización básica de datos
const sanitizeData = (req, res, next) => {
  // Función simple para sanitizar strings recursivamente en un objeto
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

module.exports = { 
  dosProtection, 
  validate,
  paramProtection,
  sanitizeData
};