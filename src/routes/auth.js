const router = require('express').Router();
const { 
  login,
  register,
  createTemporaryUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCurrentUser,
  toggleUserStatus,
  reactivateTemporaryUser
} = require('../controllers/auth');
const auth = require('../middleware/auth');
const ROLES = require('../constants/roles');

// Middleware para verificar si es admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ msg: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
};

// Rutas públicas
router.post('/login', login);

// Rutas protegidas
router.use(auth); // Middleware de autenticación para todas las rutas siguientes

// Rutas de usuario actual
router.get('/me', getCurrentUser);

// Rutas de registro (requieren autenticación)
router.post('/register', register);
router.post('/temporary', createTemporaryUser);

// Rutas de administración (requieren ser admin)
router.get('/users', isAdmin, getAllUsers);
router.get('/users/:id', isAdmin, getUserById);
router.put('/users/:id', isAdmin, updateUser);
router.put('/users/:id/:action(activate|deactivate)', isAdmin, toggleUserStatus);
router.delete('/users/:id', isAdmin, deleteUser);
router.post('/reactivate-temporary', auth, reactivateTemporaryUser);

module.exports = router;