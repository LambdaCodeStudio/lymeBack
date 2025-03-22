// src/middleware/validate.js
const { validationResult } = require('express-validator');

/**
 * Middleware para validar solicitudes utilizando express-validator
 * Verifica los resultados de validación y devuelve errores si los hay
 * 
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 * @returns {Object|Function} - Respuesta con errores o pasa al siguiente middleware
 */
const validate = (req, res, next) => {
  // Obtener resultados de validación
  const errors = validationResult(req);
  
  // Si hay errores, devolver respuesta con errores
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación en los datos proporcionados',
      errors: errors.array().map(error => ({
        param: error.param,
        value: error.value,
        message: error.msg
      }))
    });
  }

  // Si no hay errores, continuar
  next();
};

module.exports = validate;