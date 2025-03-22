// src/middleware/security.js
const toobusy = require('toobusy-js');
const { validationResult } = require('express-validator');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

/**
 * Configuración de toobusy para protección contra sobrecarga
 * Desactivado para pruebas
 */
toobusy.maxLag(1000); // Valor muy alto para desactivarlo efectivamente

/**
 * Middleware de protección contra DoS - desactivado para pruebas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const dosProtection = (req, res, next) => {
  // Desactivado para pruebas
  next();
};

/**
 * Middleware para validar resultados de express-validator
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
 * Desactivado para pruebas
 */
const paramProtection = (req, res, next) => {
  next();
};

/**
 * Middleware para sanitización básica de datos
 * Versión simplificada para pruebas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const sanitizeData = (req, res, next) => {
  next();
};

/**
 * Middleware para sanitización de datos MongoDB
 * Versión simplificada para pruebas
 */
const mongoSanitizer = (req, res, next) => {
  next();
};

/**
 * Middleware para sanitización XSS
 * Versión simplificada para pruebas
 */
const xssSanitizer = (req, res, next) => {
  next();
};

/**
 * Middleware de límite de tasa - desactivado para pruebas
 * @param {Number} windowMs - Ventana de tiempo en milisegundos
 * @param {Number} max - Número máximo de solicitudes por ventana
 * @returns {Function} - Middleware configurado que no limita
 */
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100000) => {
  return (req, res, next) => next();
};

/**
 * Limitadores desactivados para pruebas
 */
const bulkOperationsLimiter = (req, res, next) => next();
const apiLimiter = (req, res, next) => next();
const authLimiter = (req, res, next) => next();
const subserviceOperationsLimiter = (req, res, next) => next();

/**
 * Middleware que agrupa todas las protecciones básicas de seguridad
 * Desactivado para pruebas
 */
const securityBundle = [
  (req, res, next) => next()
];

module.exports = { 
  // Middleware individuales
  dosProtection, 
  validateInput,
  paramProtection,
  sanitizeData,
  mongoSanitizer,
  xssSanitizer,
  
  // Limitadores de tasa (desactivados)
  apiLimiter,
  authLimiter,
  createRateLimiter,
  bulkOperationsLimiter,
  subserviceOperationsLimiter,
  
  // Bundle de seguridad (desactivado)
  securityBundle
};