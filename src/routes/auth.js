const router = require('express').Router();
const { 
  login,
  register,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCurrentUser,
  toggleUserStatus,
  reactivateTemporaryOperator
} = require('../controllers/auth');
const auth = require('../middleware/auth');
const { isAdmin, isOnlyAdmin, hasRole } = require('../middleware/roleMiddleware');
const ROLES = require('../constants/roles');

// Rutas públicas
router.post('/login', login);

// Rutas protegidas
router.use(auth); // Middleware de autenticación para todas las rutas siguientes

// Rutas de usuario actual
router.get('/me', getCurrentUser);

// Rutas de registro (requieren autenticación)
router.post('/register', register);

// Rutas de administración (requieren ser admin)
router.get('/users', auth, getAllUsers);
router.get('/users/:id', auth, getUserById);
router.put('/users/:id', auth, updateUser);
router.put('/users/:id/:action(activate|deactivate)', auth, toggleUserStatus);
router.delete('/users/:id', auth, deleteUser);
router.post('/reactivate-temporary', auth, reactivateTemporaryOperator);

module.exports = router;