// src/routes/productoRoutes.js
const express = require('express');
const productoController = require('../controllers/productoController');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const { isAdmin, hasRole } = require('../middleware/roleMiddleware');
const ROLES = require('../constants/roles');

// Middleware de autenticación para todas las rutas
router.use(auth);

// ===== Rutas de consulta básicas =====

// Listado general con filtros
router.get('/', productoController.obtenerTodos);

// Consulta por ID
router.get('/:id', productoController.obtenerPorId);

// ===== Rutas de gestión básica =====

// Crear producto
router.post('/', productoController.crearProducto);

// Actualizar producto
router.put('/:id', productoController.actualizarProducto);

// Eliminar producto
router.delete('/:id', productoController.eliminarProducto);

// ===== Rutas para operaciones de venta =====

// Vender producto
router.post('/:id/vender', productoController.venderProducto);

// Cancelar venta
router.post('/:id/cancelar-venta', productoController.cancelarVenta);

// ===== Rutas para gestión de imágenes =====

// Subir imagen (formato binario/multipart)
router.post('/:id/imagen', upload.single('imagen'), productoController.uploadImagen);

// Obtener imagen
router.get('/:id/imagen', productoController.getImagen);

// Eliminar imagen
router.delete('/:id/imagen', productoController.deleteImagen);

// Subir imagen (formato base64)
router.post('/:id/imagen-base64', productoController.uploadImagenBase64);

// Obtener imagen (formato base64)
router.get('/:id/imagen-base64', productoController.getImagenBase64);

// ===== Rutas para combos =====

// Calcular precio de combo
router.get('/:id/precio-combo', productoController.calcularPrecioCombo);

// ===== NUEVAS RUTAS DE CONSULTA ESPECIALIZADA =====

// Nota: es importante que estas rutas vayan ANTES de la ruta /:id para evitar
// que sean interpretadas como IDs de producto

// Consultas por filtros específicos
router.get('/marca/:marca', productoController.obtenerProductosPorMarca);
router.get('/proveedor/:proveedor', productoController.obtenerProductosPorProveedor);
router.get('/rango-precio', productoController.obtenerProductosPorRangoPrecio);
router.get('/stock-bajo', productoController.obtenerProductosStockBajo);
router.get('/sin-stock', productoController.obtenerProductosSinStock);
router.get('/mas-vendidos', productoController.obtenerProductosMasVendidos);

// ===== NUEVAS RUTAS PARA REPORTES Y ESTADÍSTICAS =====

// Estadísticas básicas
router.get('/stats/stock', productoController.getStockStats);

// Reportes avanzados (requieren permisos de administrador o supervisor)
router.get('/reportes/inventario', 
    hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES, ROLES.SUPERVISOR]),
    productoController.generarReporteInventario
);

router.get('/reportes/estadisticas-categoria', 
    hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES, ROLES.SUPERVISOR]),
    productoController.obtenerEstadisticasPorCategoria
);

router.get('/reportes/pronostico-agotamiento', 
    hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES, ROLES.SUPERVISOR]),
    productoController.generarPronosticoAgotamiento
);

// Exportación de datos
router.get('/exportar', 
    hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES, ROLES.SUPERVISOR]),
    productoController.exportarDatosProductos
);

// Actualización de estadísticas (solo para administradores)
router.post('/actualizar-estadisticas', 
    hasRole([ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES]),
    productoController.actualizarEstadisticasProductos
);

module.exports = router;