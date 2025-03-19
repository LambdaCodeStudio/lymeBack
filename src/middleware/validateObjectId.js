// src/middleware/validateObjectId.js
const mongoose = require('mongoose');

/**
 * Middleware para validar que un parámetro sea un ObjectId válido de MongoDB
 * @param {String} paramName - Nombre del parámetro a validar (params, query o body)
 * @param {String} location - Ubicación del parámetro ('params', 'query', 'body')
 * @returns {Function} - Middleware de Express
 */
const validateObjectId = (paramName, location = 'params') => {
  return (req, res, next) => {
    const value = req[location][paramName];
    
    if (!value) {
      return res.status(400).json({ 
        success: false, 
        message: `El parámetro ${paramName} es requerido` 
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ 
        success: false, 
        message: `El valor de ${paramName} no es un ID válido` 
      });
    }
    
    next();
  };
};

/**
 * Middleware para validar que un campo en el body sea un ObjectId válido
 * @param {String} fieldName - Nombre del campo a validar
 * @returns {Function} - Middleware de Express
 */
const validateBodyObjectId = (fieldName) => {
  return validateObjectId(fieldName, 'body');
};

/**
 * Middleware para validar que un parámetro de consulta sea un ObjectId válido
 * @param {String} paramName - Nombre del parámetro de consulta a validar
 * @returns {Function} - Middleware de Express
 */
const validateQueryObjectId = (paramName) => {
  return validateObjectId(paramName, 'query');
};

module.exports = {
  validateObjectId,
  validateBodyObjectId,
  validateQueryObjectId
};