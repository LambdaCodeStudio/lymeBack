// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { 
  login,
  register,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCurrentUser,
  toggleUserStatus,
  reactivateTemporaryOperator,
  getSupervisors,
  getSupervisorInfo
} = require('../controllers/auth');
const { auth } = require('../middleware/auth');
const { isAdmin, isOnlyAdmin, hasRole } = require('../middleware/roleMiddleware');
const ROLES = require('../constants/roles');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate'); // Middleware para validar solicitudes

// ===== VALIDADORES =====

// Validador para login
const loginValidator = [
  body('usuario')
    .notEmpty().withMessage('El nombre de usuario es requerido')
    .isString().withMessage('El nombre de usuario debe ser un texto'),
  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isString().withMessage('La contraseña debe ser un texto')
];

// Validador para registro
const registerValidator = [
  body('usuario')
    .notEmpty().withMessage('El nombre de usuario es requerido')
    .isString().withMessage('El nombre de usuario debe ser un texto')
    .isLength({ min: 3, max: 50 }).withMessage('El nombre de usuario debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_\.]+$/).withMessage('El nombre de usuario solo puede contener letras, números, puntos y guiones bajos'),
  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isString().withMessage('La contraseña debe ser un texto')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('role')
    .notEmpty().withMessage('El rol es requerido')
    .isIn(Object.values(ROLES)).withMessage('Rol no válido'),
  body('secciones')
    .notEmpty().withMessage('La sección es requerida')
    .isIn(['limpieza', 'mantenimiento', 'ambos']).withMessage('Sección no válida')
];

// Validador para actualización
const updateValidator = [
  param('id')
    .isMongoId().withMessage('ID de usuario inválido'),
  body('usuario')
    .optional()
    .isString().withMessage('El nombre de usuario debe ser un texto')
    .isLength({ min: 3, max: 50 }).withMessage('El nombre de usuario debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_\.]+$/).withMessage('El nombre de usuario solo puede contener letras, números, puntos y guiones bajos'),
  body('password')
    .optional()
    .isString().withMessage('La contraseña debe ser un texto')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('role')
    .optional()
    .isIn(Object.values(ROLES)).withMessage('Rol no válido'),
  body('secciones')
    .optional()
    .isIn(['limpieza', 'mantenimiento', 'ambos']).withMessage('Sección no válida'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive debe ser un valor booleano')
];

// ===== RUTAS PÚBLICAS =====

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Público
 */
router.post('/login', loginValidator, validate, login);

// ===== MIDDLEWARE DE AUTENTICACIÓN =====
// Todas las rutas siguientes requieren autenticación
router.use(auth);

// ===== RUTAS DE USUARIO ACTUAL =====

/**
 * @route   GET /api/auth/me
 * @desc    Obtener perfil del usuario actual
 * @access  Privado
 */
router.get('/me', getCurrentUser);

/**
 * @route   POST /api/auth/reactivate-temporary
 * @desc    Reactivar operario temporal
 * @access  Privado (solo operarios temporales)
 */
router.post('/reactivate-temporary', reactivateTemporaryOperator);

// ===== RUTAS DE GESTIÓN DE USUARIOS =====

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Privado (admin y supervisor de supervisores)
 */
router.post(
  '/register', 
  hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES]),
  registerValidator,
  validate,
  register
);

/**
 * @route   GET /api/auth/users
 * @desc    Obtener todos los usuarios
 * @access  Privado (admin y supervisor de supervisores)
 */
router.get(
  '/users',
  hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES]),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido'),
    query('role').optional().isIn(Object.values(ROLES)).withMessage('Rol inválido'),
    query('isActive').optional().isBoolean().withMessage('isActive debe ser un valor booleano')
  ],
  validate,
  getAllUsers
);

/**
 * @route   GET /api/auth/users/:id
 * @desc    Obtener usuario por ID
 * @access  Privado (admin y supervisor de supervisores)
 */
router.get(
  '/users/:id',
  hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES]),
  [param('id').isMongoId().withMessage('ID de usuario inválido')],
  validate,
  getUserById
);

/**
 * @route   PUT /api/auth/users/:id
 * @desc    Actualizar usuario
 * @access  Privado (admin y supervisor de supervisores)
 */
router.put(
  '/users/:id',
  hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES]),
  updateValidator,
  validate,
  updateUser
);

/**
 * @route   PUT /api/auth/users/:id/:action
 * @desc    Activar/desactivar usuario
 * @access  Privado (admin y supervisor de supervisores)
 */
router.put(
  '/users/:id/:action(activate|deactivate)',
  hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES]),
  [
    param('id').isMongoId().withMessage('ID de usuario inválido'),
    param('action').isIn(['activate', 'deactivate']).withMessage('Acción inválida')
  ],
  validate,
  toggleUserStatus
);

/**
 * @route   DELETE /api/auth/users/:id
 * @desc    Eliminar usuario
 * @access  Privado (admin y supervisor de supervisores)
 */
router.delete(
  '/users/:id',
  hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES]),
  [param('id').isMongoId().withMessage('ID de usuario inválido')],
  validate,
  deleteUser
);

/**
 * @route   GET /api/auth/supervisors
 * @desc    Obtener supervisores
 * @access  Privado (cualquier usuario autenticado)
 */
router.get('/supervisors', getSupervisors);

/**
 * @route   GET /api/auth/me/supervisor
 * @desc    Obtener información del supervisor asignado al usuario actual (para operarios)
 * @access  Privado (para cualquier usuario autenticado, principalmente operarios)
 */
router.get('/me/supervisor', getSupervisorInfo);

module.exports = router;