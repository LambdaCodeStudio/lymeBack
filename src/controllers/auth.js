// src/controllers/auth.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ROLES = require('../constants/roles');
const mongoose = require('mongoose');

/**
 * Crea el usuario administrador inicial si no existe
 * @returns {Promise<void>}
 */
const createInitialAdmin = async () => {
  try {
    // Optimización: Usar countDocuments en lugar de findOne para verificar existencia
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN });
    
    if (adminCount === 0) {
      console.log('Creando usuario administrador inicial');
      await User.create({
        usuario: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin',
        role: ROLES.ADMIN,
        secciones: 'ambos'
      });
      console.log('Usuario administrador creado exitosamente');
    }
  } catch (error) {
    console.error('Error al crear administrador inicial:', error);
  }
};

/**
 * Verifica si un rol puede crear otro rol según la jerarquía
 * @param {String} creatorRole - Rol del creador
 * @param {String} newRole - Rol a crear
 * @returns {Boolean} - True si puede crear, false de lo contrario
 */
const isAllowedToCreate = (creatorRole, newRole) => {
  const roleHierarchy = {
    [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES, ROLES.SUPERVISOR, ROLES.OPERARIO],
    [ROLES.SUPERVISOR_DE_SUPERVISORES]: [ROLES.SUPERVISOR, ROLES.OPERARIO],
    [ROLES.SUPERVISOR]: [],
    [ROLES.OPERARIO]: []
  };
  
  return roleHierarchy[creatorRole]?.includes(newRole) || false;
};

/**
 * Genera un token JWT para un usuario
 * @param {Object} user - Usuario para el que generar el token
 * @returns {String} - Token JWT generado
 */
const generateToken = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    secciones: user.secciones
  };
  
  // Opciones de token mejoradas
  const options = {
    expiresIn: process.env.JWT_EXPIRATION || '24h' // Configurable desde variables de entorno
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

/**
 * Inicia sesión del usuario y devuelve el token JWT
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Respuesta con token o error
 */
const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    // Validación de entrada
    if (!usuario || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Usuario y contraseña son requeridos' 
      });
    }
    
    // Buscar usuario optimizando la consulta con índices
    const user = await User.findOne({ usuario }).select('+password');
    
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
    }

    // Verificar si el usuario está activo
    if (user.isActive === false) {
      return res.status(403).json({ 
        success: false,
        message: 'Usuario desactivado. Contacte al administrador' 
      });
    }

    // Comparar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
    }

    // Verificar expiración para operarios temporales
    if (user.role === ROLES.OPERARIO && user.expiresAt) {
      const now = new Date();
      
      if (user.expiresAt < now) {
        // Marcar como inactivo en lugar de eliminar
        user.isActive = false;
        await user.save();
        
        return res.status(401).json({ 
          success: false,
          message: 'Su cuenta temporal ha expirado. Contacte a su supervisor' 
        });
      }
    }

    // Generar token JWT
    const token = generateToken(user);
    
    // Respuesta exitosa con información básica
    res.json({ 
      success: true,
      token,
      user: {
        id: user._id,
        usuario: user.usuario,
        nombre: user.nombre,
        role: user.role,
        secciones: user.secciones
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor al procesar el inicio de sesión',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Registra un nuevo usuario en el sistema
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Respuesta con token o error
 */
const register = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Validaciones de entrada
    const { usuario, password, role, isTemporary, secciones } = req.body;
    
    if (!usuario || !password || !role || !secciones) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan campos requeridos (usuario, password, role, secciones)'
      });
    }
    
    // Verificar creador
    const creator = await User.findById(req.user.id).session(session);
    if (!creator) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ 
        success: false,
        message: 'Usuario creador no encontrado o sesión expirada' 
      });
    }

    // Verificar permisos para crear este tipo de usuario
    if (!isAllowedToCreate(creator.role, role)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        success: false,
        message: `No tiene permisos para crear usuarios de tipo ${role}` 
      });
    }

    // Verificar si el nombre de usuario ya existe
    const existingUser = await User.findOne({ usuario }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'El nombre de usuario ya existe' 
      });
    }

    // Preparar datos del usuario
    let userData = { 
      ...req.body, 
      createdBy: creator._id,
      isActive: true
    };
    
    // Gestionar operario temporal
    if (role === ROLES.OPERARIO && isTemporary) {
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + 30); // 30 minutos por defecto
      userData.expiresAt = expirationDate;
    }

    // Crear el usuario
    const user = new User(userData);
    await user.save({ session });
    
    // Commit de la transacción
    await session.commitTransaction();
    session.endSession();
    
    // Generar token JWT
    const token = generateToken(user);
    
    // Respuesta exitosa
    res.status(201).json({ 
      success: true,
      message: 'Usuario creado exitosamente',
      token,
      user: {
        id: user._id,
        usuario: user.usuario,
        role: user.role,
        secciones: user.secciones
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error en register:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'El usuario ya existe' 
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error al registrar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene todos los usuarios del sistema
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Lista de usuarios
 */
const getAllUsers = async (req, res) => {
  try {
    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Filtros
    const filters = {};
    if (req.query.role) {
      filters.role = req.query.role;
    }
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filters.$or = [
        { usuario: searchRegex },
        { nombre: searchRegex },
        { apellido: searchRegex }
      ];
    }
    
    // Ejecución optimizada de consultas en paralelo
    const [users, total] = await Promise.all([
      User.find(filters)
        .select('-password')
        .populate('createdBy', 'usuario nombre apellido')
        .sort({ isActive: -1, role: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filters)
    ]);
    
    // Procesamiento y enriquecimiento de datos
    const now = new Date();
    const processedUsers = users.map(user => {
      // Procesamiento de operarios temporales
      if (user.role === ROLES.OPERARIO && user.expiresAt) {
        const expirationDate = new Date(user.expiresAt);
        const isExpired = now > expirationDate;
        
        return {
          ...user,
          expirationInfo: {
            expired: isExpired,
            expirationDate,
            minutesRemaining: isExpired ? 0 : Math.max(
              0,
              Math.ceil((expirationDate - now) / (1000 * 60))
            )
          }
        };
      }
      return user;
    });

    // Respuesta con metadatos de paginación
    res.json({
      success: true,
      users: processedUsers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener usuarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene un usuario por su ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Usuario o error
 */
const getUserById = async (req, res) => {
  try {
    // Validar ID de MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        message: 'ID de usuario inválido' 
      });
    }
    
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'usuario nombre apellido')
      .lean();
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }
    
    // Procesar información de expiración para operarios temporales
    if (user.role === ROLES.OPERARIO && user.expiresAt) {
      const now = new Date();
      const expirationDate = new Date(user.expiresAt);
      
      user.expirationInfo = {
        expired: now > expirationDate,
        expirationDate,
        minutesRemaining: Math.max(
          0,
          Math.ceil((expirationDate - now) / (1000 * 60))
        )
      };
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error en getUserById:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Actualiza un usuario existente
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Usuario actualizado o error
 */
const updateUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Validación de ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de usuario inválido' 
      });
    }
    
    // Obtener usuario a actualizar - IMPORTANTE: Usar .session(session) en todas las consultas
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // Validar permisos para cambios críticos
    const requestUser = await User.findById(req.user.id).session(session);
    
    // Cambio de rol: solo admin puede hacerlo
    if (req.body.role && requestUser.role !== ROLES.ADMIN) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        success: false, 
        message: 'No tiene permisos para cambiar roles de usuario' 
      });
    }

    // Proteger al admin principal
    if (user.role === ROLES.ADMIN && !user.createdBy) {
      // Si intentan cambiar campos críticos del admin principal
      if (req.body.role || req.body.isActive === false) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ 
          success: false, 
          message: 'No se pueden modificar atributos críticos del administrador principal' 
        });
      }
    }

    // Preparar datos de actualización
    const updateData = { ...req.body };
    
    // Manejar contraseña si se proporciona
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    // Convertir isActive a booleano si se proporciona como string
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive === true || updateData.isActive === 'true';
    }

    // Gestionar operario temporal
    if (user.role === ROLES.OPERARIO && updateData.isTemporary !== undefined) {
      if (updateData.isTemporary === true) {
        // Usar minutos personalizados o por defecto 30 minutos
        const expirationMinutes = updateData.expirationMinutes || 30;
        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + expirationMinutes);
        updateData.expiresAt = expirationDate;
      } else {
        updateData.expiresAt = null;
      }
    }

    // Actualizar el usuario - IMPORTANTE: Usar .session(session) aquí también
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true, session }
    ).select('-password');

    if (!updatedUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado durante la actualización' 
      });
    }
    
    // Registrar la actualización
    console.log(`Usuario ${updatedUser._id} actualizado por ${req.user.id}`);
    
    // Commit de la transacción
    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Usuario actualizado correctamente',
      user: updatedUser
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error en updateUser:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error al actualizar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Elimina un usuario y reasigna sus clientes
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Respuesta con resultado o error
 */
const deleteUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Validación de ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de usuario inválido' 
      });
    }
    
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // No permitir eliminar al admin principal
    if (user.role === ROLES.ADMIN && !user.createdBy) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        success: false, 
        message: 'No se puede eliminar al administrador principal' 
      });
    }

    // Encontrar y actualizar clientes asociados
    const Cliente = require('../models/clienteSchema');
    const clientesQuery = { userId: user._id };
    
    // Contar primero para evitar operación innecesaria
    const clientCount = await Cliente.countDocuments(clientesQuery).session(session);
    let clientesActualizados = 0;
    
    if (clientCount > 0) {
      console.log(`Reasignando ${clientCount} clientes del usuario ${user._id}`);
      
      const updateResult = await Cliente.updateMany(
        clientesQuery,
        { $unset: { userId: "" } },
        { session }
      );
      
      clientesActualizados = updateResult.modifiedCount;
      console.log(`${clientesActualizados} clientes preparados para reasignación`);
    }

    // Eliminar el usuario
    const deleteResult = await User.deleteOne({ _id: user._id }).session(session);
    
    if (deleteResult.deletedCount !== 1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ 
        success: false, 
        message: 'Error al eliminar usuario' 
      });
    }
    
    // Commit de la transacción
    await session.commitTransaction();
    session.endSession();
    
    res.json({ 
      success: true,
      message: 'Usuario eliminado correctamente', 
      clientesEnStandBy: clientesActualizados 
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al eliminar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene el perfil del usuario actual
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Perfil de usuario o error
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('createdBy', 'usuario nombre apellido')
      .lean();
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Procesar información de expiración para operarios temporales
    if (user.role === ROLES.OPERARIO && user.expiresAt) {
      const now = new Date();
      const expirationDate = new Date(user.expiresAt);
      
      user.expirationInfo = {
        expired: now > expirationDate,
        expirationDate,
        minutesRemaining: Math.max(
          0,
          Math.ceil((expirationDate - now) / (1000 * 60))
        )
      };
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil de usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Activa o desactiva un usuario
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Respuesta con resultado o error
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id, action } = req.params;
    
    // Validación de ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de usuario inválido' 
      });
    }
    
    // Validación de acción
    if (action !== 'activate' && action !== 'deactivate') {
      return res.status(400).json({ 
        success: false, 
        message: 'Acción inválida. Use "activate" o "deactivate"' 
      });
    }
    
    const isActivating = action === 'activate';
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // No permitir desactivar al admin principal
    if (!isActivating && user.role === ROLES.ADMIN && !user.createdBy) {
      return res.status(403).json({ 
        success: false, 
        message: 'No se puede desactivar al administrador principal' 
      });
    }

    // Actualizar estado
    user.isActive = isActivating;
    
    // Si es activación de operario temporal, reiniciar expiración
    if (isActivating && user.role === ROLES.OPERARIO && user.expiresAt) {
      const newExpirationDate = new Date();
      newExpirationDate.setMinutes(newExpirationDate.getMinutes() + 30);
      user.expiresAt = newExpirationDate;
    }

    await user.save();

    // Obtener usuario actualizado con relaciones
    const updatedUser = await User.findById(id)
      .select('-password')
      .populate('createdBy', 'usuario nombre apellido');

    res.json({
      success: true,
      message: `Usuario ${isActivating ? 'activado' : 'desactivado'} correctamente`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error en toggleUserStatus:', error);
    res.status(500).json({ 
      success: false,
      message: `Error al ${req.params.action === 'activate' ? 'activar' : 'desactivar'} usuario`,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Reactiva un operario temporal cuya sesión ha expirado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Respuesta con resultado o error
 */
const reactivateTemporaryOperator = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que sea un operario temporal
    if (user.role !== ROLES.OPERARIO || !user.expiresAt) {
      return res.status(403).json({ 
        success: false,
        message: 'Solo operarios temporales pueden usar esta función'
      });
    }

    // Si ya está inactivo o expirado, reactivar
    const now = new Date();
    const isExpired = user.expiresAt < now;
    
    if (!user.isActive || isExpired) {
      // Extender por 30 minutos
      const newExpirationDate = new Date();
      newExpirationDate.setMinutes(newExpirationDate.getMinutes() + 30);

      user.isActive = true;
      user.expiresAt = newExpirationDate;
      await user.save();

      return res.json({ 
        success: true,
        message: 'Sesión reactivada exitosamente',
        expiresAt: newExpirationDate,
        minutesRemaining: 30
      });
    }

    // Si ya está activo
    const minutesRemaining = Math.ceil((user.expiresAt - now) / (1000 * 60));
    
    res.json({ 
      success: true,
      message: 'Su sesión ya está activa',
      expiresAt: user.expiresAt,
      minutesRemaining
    });
  } catch (error) {
    console.error('Error en reactivateTemporaryOperator:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al reactivar operario temporal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene la lista de supervisores activos
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Object} - Lista de supervisores o error
 */
const getSupervisors = async (req, res) => {
  try {
    // Cache de supervisores (5 minutos)
    const cacheKey = 'supervisors_list';
    const cachedData = global.cache?.get(cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        supervisors: cachedData,
        fromCache: true
      });
    }
    
    // Obtener supervisores activos de forma eficiente
    const supervisors = await User.find({ 
      role: ROLES.SUPERVISOR, 
      isActive: true 
    })
    .select('_id usuario nombre apellido role')
    .sort({ nombre: 1, apellido: 1 })
    .lean();
    
    // Opcional: almacenar en caché
    if (global.cache) {
      global.cache.set(cacheKey, supervisors, 300); // 5 minutos
    }
    
    res.json({
      success: true,
      count: supervisors.length,
      supervisors
    });
  } catch (error) {
    console.error('Error al obtener supervisores:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener supervisores',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  login,
  register,
  createInitialAdmin,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCurrentUser,
  toggleUserStatus,
  reactivateTemporaryOperator,
  getSupervisors
};