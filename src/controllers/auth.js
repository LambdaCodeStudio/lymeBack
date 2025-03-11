// src/controllers/auth.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ROLES = require('../constants/roles');

// Crear usuario administrador inicial
const createInitialAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: ROLES.ADMIN });
    if (!adminExists) {
      await User.create({
        usuario: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD,
        role: ROLES.ADMIN,
        secciones: 'ambos'
      });
    }
  } catch (error) {
    console.error('Error creating admin:', error);
  }
};

// Función actualizada para validar permisos de creación con la nueva jerarquía
const isAllowedToCreate = (creatorRole, newRole) => {
  switch (creatorRole) {
    case ROLES.ADMIN:
      return [ROLES.ADMIN, ROLES.SUPERVISOR_DE_SUPERVISORES, ROLES.SUPERVISOR, ROLES.OPERARIO].includes(newRole);
    case ROLES.SUPERVISOR_DE_SUPERVISORES:
      return [ROLES.SUPERVISOR, ROLES.OPERARIO].includes(newRole);
    default:
      return false;
  }
};

// Login actualizado
const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    // Buscar usuario solo por nombre de usuario
    const user = await User.findOne({ usuario: usuario });
    
    if (!user) return res.status(400).json({ msg: 'Usuario no existe' });

    // Verificar si el usuario está activo
    if (user.isActive === false) {
      return res.status(403).json({ msg: 'Usuario desactivado' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Contraseña incorrecta' });

    // Si es un operario con expiración, verificar si no ha expirado
    if (user.role === ROLES.OPERARIO && user.expiresAt) {
      if (!user.expiresAt) {
        await User.deleteOne({ _id: user._id });
        return res.status(401).json({ msg: 'Usuario temporal inválido' });
      }

      if (user.expiresAt < new Date()) {
        await User.deleteOne({ _id: user._id });
        return res.status(401).json({ msg: 'Usuario temporal expirado' });
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registro de usuario con nueva lógica de roles
const register = async (req, res) => {
  try {
    const creator = await User.findById(req.user.id);
    if (!creator) {
      return res.status(401).json({ msg: 'Usuario creador no encontrado' });
    }

    const { role, isTemporary } = req.body;
    
    if (!isAllowedToCreate(creator.role, role)) {
      return res.status(403).json({ msg: 'No tienes permisos para crear este tipo de usuario' });
    }

    // Gestionar operario temporal
    let userData = { ...req.body, createdBy: creator._id };
    
    if (role === ROLES.OPERARIO && isTemporary) {
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + 30); // 30 minutos por defecto
      userData.expiresAt = expirationDate;
    }

    const user = new User(userData);
    await user.save();
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener todos los usuarios con nueva jerarquía de roles
const getAllUsers = async (req, res) => {
  try {
    // Obtener todos los usuarios sin filtrar por expiración
    const users = await User.find()
      .select('-password')
      .populate('createdBy', 'usuario nombre apellido');
    
    // Procesar cada usuario para actualizar su estado
    const processedUsers = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject();

      // Manejar operarios temporales
      if (user.role === ROLES.OPERARIO && user.expiresAt) {
        const now = new Date();
        const expirationDate = new Date(user.expiresAt);
        
        // Si está expirado, actualizar su estado en la base de datos
        if (now > expirationDate && user.isActive) {
          user.isActive = false;
          await user.save();
          userObj.isActive = false;
        }

        // Agregar información adicional útil
        userObj.expirationInfo = {
          expired: now > expirationDate,
          expirationDate: expirationDate,
          minutesRemaining: Math.max(
            0,
            Math.ceil((expirationDate - now) / (1000 * 60))
          )
        };
      }

      return userObj;
    }));

    // Ordenar usuarios: activos primero, luego por rol
    const sortedUsers = processedUsers.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      
      const rolePriority = {
        [ROLES.ADMIN]: 5,
        [ROLES.SUPERVISOR_DE_SUPERVISORES]: 4,
        [ROLES.SUPERVISOR]: 3,
        [ROLES.OPERARIO]: 2
      };
      
      return (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
    });

    res.json(sortedUsers);
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener usuario por ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'usuario nombre apellido');
    
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar usuario con nueva jerarquía
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Sólo admin puede cambiar roles
    if (req.body.role && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ msg: 'No tienes permisos para cambiar roles' });
    }

    // No permitir cambios en el admin principal
    if (user.role === ROLES.ADMIN && !user.createdBy) {
      return res.status(403).json({ msg: 'No se puede modificar al administrador principal' });
    }

    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Verificar si se está actualizando el estado isActive
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive === 'true' || updateData.isActive === true;
    }

    // Gestionar operario temporal
    if (user.role === ROLES.OPERARIO && updateData.isTemporary !== undefined) {
      if (updateData.isTemporary) {
        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + 30);
        updateData.expiresAt = expirationDate;
      } else {
        updateData.expiresAt = null;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // No permitir eliminar al admin principal
    if (user.role === ROLES.ADMIN && !user.createdBy) {
      return res.status(403).json({ msg: 'No se puede eliminar al administrador principal' });
    }

    // Primero buscamos todos los clientes asociados a este usuario
    const Cliente = require('../models/clienteSchema');
    const clientesAsociados = await Cliente.find({ userId: req.params.id });
    
    console.log(`Se encontraron ${clientesAsociados.length} clientes asociados al usuario ${req.params.id}`);
    
    // En lugar de eliminar los clientes, los dejamos sin userId para que puedan ser reasignados
    let clientesActualizados = 0;
    if (clientesAsociados.length > 0) {
      const resultado = await Cliente.updateMany(
        { userId: req.params.id },
        { $unset: { userId: "" } }
      );
      clientesActualizados = resultado.modifiedCount;
      console.log(`Se actualizaron ${clientesActualizados} clientes para reasignación futura`);
    }

    // Finalmente eliminamos el usuario
    await User.deleteOne({ _id: req.params.id });
    
    res.json({ 
      msg: 'Usuario eliminado correctamente', 
      clientesEnStandBy: clientesActualizados 
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener perfil del usuario actual
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('createdBy', 'usuario nombre apellido');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Activar/desactivar usuario
const toggleUserStatus = async (req, res) => {
  try {
    const { id, action } = req.params;
    const isActivating = action === 'activate';

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Si estamos activando un operario temporal
    if (isActivating && user.role === ROLES.OPERARIO && user.expiresAt) {
      // Establecer nueva fecha de expiración
      const newExpirationDate = new Date();
      newExpirationDate.setMinutes(newExpirationDate.getMinutes() + 30);
      
      user.expiresAt = newExpirationDate;
    }

    user.isActive = isActivating;
    await user.save();

    // Obtener el usuario actualizado con sus relaciones
    const updatedUser = await User.findById(id)
      .select('-password')
      .populate('createdBy', 'usuario nombre apellido');

    res.json(updatedUser);
  } catch (error) {
    console.error('Error en toggleUserStatus:', error);
    res.status(500).json({ error: error.message });
  }
};

// Reactivar operario temporal
const reactivateTemporaryOperator = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Verificar que sea un operario temporal
    if (user.role !== ROLES.OPERARIO || !user.expiresAt) {
      return res.status(403).json({ msg: 'Solo operarios temporales pueden ser reactivados' });
    }

    // Verificar si ya está desactivado
    if (!user.isActive) {
      // Restablecer la fecha de expiración por 30 minutos
      const newExpirationDate = new Date();
      newExpirationDate.setMinutes(newExpirationDate.getMinutes() + 30);

      // Actualizar usuario
      user.isActive = true;
      user.expiresAt = newExpirationDate;

      await user.save();

      return res.json({ 
        msg: 'Operario temporal reactivado', 
        expiresAt: newExpirationDate 
      });
    }

    // Si ya está activo, retornar mensaje
    res.json({ 
      msg: 'El usuario ya está activo', 
      expiresAt: user.expiresAt 
    });

  } catch (error) {
    res.status(500).json({ 
      msg: 'Error al reactivar operario temporal', 
      error: error.message 
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
  reactivateTemporaryOperator
};