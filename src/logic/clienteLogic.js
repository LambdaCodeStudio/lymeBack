// src/logic/clienteLogic.js
const Cliente = require('../models/clienteSchema');
const mongoose = require('mongoose');

// Obtener todos los clientes con su estructura completa
const obtenerClientes = async () => {
    return await Cliente.find()
        .populate('userId', 'nombre email usuario apellido role isActive')
        .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive');
};

// Obtener cliente por ID
const obtenerClientePorId = async (id) => {
    return await Cliente.findById(id)
        .populate('userId', 'nombre email usuario apellido role isActive')
        .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive');
};

// Crear nuevo cliente con estructura completa
const crearCliente = async (data) => {
    const cliente = new Cliente(data);
    return await cliente.save();
};

// Actualizar cliente y su estructura
const actualizarCliente = async (id, data) => {
    return await Cliente.findByIdAndUpdate(id, data, { new: true });
};

// Eliminar cliente
const eliminarCliente = async (id) => {
    return await Cliente.findByIdAndDelete(id);
};

// Obtener clientes por ID de usuario
const obtenerClientesPorUserId = async (userId) => {
    return await Cliente.find({ userId })
        .populate('userId', 'nombre email usuario apellido role isActive')
        .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive');
};

// Obtener clientes por supervisor de subServicio
const obtenerClientesPorSupervisorId = async (supervisorId) => {
    return await Cliente.find({ 'subServicios.supervisorId': supervisorId })
        .populate('userId', 'nombre email usuario apellido role isActive')
        .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive');
};

// Obtener subServicios por supervisor
const obtenerSubServiciosPorSupervisorId = async (supervisorId) => {
    const clientes = await Cliente.find({ 'subServicios.supervisorId': supervisorId })
        .populate('userId', 'nombre email usuario apellido role isActive')
        .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive');
    
    // Procesar para devolver solo los subServicios asignados a este supervisor
    const subServiciosDelSupervisor = [];
    
    clientes.forEach(cliente => {
        const subServiciosFiltrados = cliente.subServicios.filter(
            subServ => subServ.supervisorId && 
            subServ.supervisorId._id.toString() === supervisorId.toString()
        );
        
        if (subServiciosFiltrados.length > 0) {
            subServiciosDelSupervisor.push({
                clienteId: cliente._id,
                nombreCliente: cliente.nombre,
                userId: cliente.userId,
                subServicios: subServiciosFiltrados
            });
        }
    });
    
    return subServiciosDelSupervisor;
};


// Obtener clientes sin asignar (sin userId o con usuario inactivo)
const obtenerClientesSinAsignar = async (idsUsuariosInactivos) => {
    // Obtener clientes sin userId
    const clientesSinUsuario = await Cliente.find({ userId: { $exists: false } }).exec();
    
    // Obtener clientes con usuarios inactivos
    const clientesUsuarioInactivo = await Cliente.find({ 
        userId: { $in: idsUsuariosInactivos } 
    })
    .populate('userId', 'email usuario nombre apellido role isActive')
    .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive')
    .exec();
    
    return { clientesSinUsuario, clientesUsuarioInactivo };
};

// Agregar un nuevo subservicio a un cliente existente
const agregarSubServicio = async (clienteId, subServicioData) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    cliente.subServicios.push(subServicioData);
    return await cliente.save();
};

// Actualizar un subservicio existente
const actualizarSubServicio = async (clienteId, subServicioId, subServicioData) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    // Actualizar propiedades del subservicio
    Object.assign(subServicio, subServicioData);
    
    return await cliente.save();
};

// Eliminar un subservicio
const eliminarSubServicio = async (clienteId, subServicioId) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    cliente.subServicios = cliente.subServicios.filter(
        sub => sub._id.toString() !== subServicioId
    );
    
    return await cliente.save();
};

// Agregar sububicación a un subservicio
const agregarSubUbicacion = async (clienteId, subServicioId, subUbicacionData) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    subServicio.subUbicaciones.push(subUbicacionData);
    return await cliente.save();
};

// Actualizar sububicación
const actualizarSubUbicacion = async (clienteId, subServicioId, subUbicacionId, subUbicacionData) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    const subUbicacion = subServicio.subUbicaciones.id(subUbicacionId);
    if (!subUbicacion) return null;
    
    // Actualizar propiedades de la sububicación
    Object.assign(subUbicacion, subUbicacionData);
    
    return await cliente.save();
};

// Eliminar sububicación
const eliminarSubUbicacion = async (clienteId, subServicioId, subUbicacionId) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    subServicio.subUbicaciones = subServicio.subUbicaciones.filter(
        sub => sub._id.toString() !== subUbicacionId
    );
    
    return await cliente.save();
};


// NUEVA FUNCIÓN: Remover supervisor de un subservicio
const removerSupervisorSubServicio = async (clienteId, subServicioId) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    // Eliminar el supervisor del subservicio
    subServicio.supervisorId = undefined;
    
    return await cliente.save();
};

const obtenerSubServiciosSinSupervisor = async () => {
    // Encontrar clientes con subservicios sin supervisor asignado
    const clientes = await Cliente.find({ 
        'subServicios': { 
            $elemMatch: { 
                $or: [
                    { supervisorId: { $exists: false } },
                    { supervisorId: { $size: 0 } },
                    { supervisorId: null }
                ] 
            } 
        } 
    }).populate('userId', 'nombre email usuario apellido role isActive');
    
    // Extraer solo los subservicios sin supervisor
    const resultado = [];
    
    clientes.forEach(cliente => {
        const subServiciosSinSupervisor = cliente.subServicios.filter(
            subServ => !subServ.supervisorId || (Array.isArray(subServ.supervisorId) && subServ.supervisorId.length === 0)
        );
        
        if (subServiciosSinSupervisor.length > 0) {
            resultado.push({
                clienteId: cliente._id,
                nombreCliente: cliente.nombre,
                userId: cliente.userId,
                subServicios: subServiciosSinSupervisor
            });
        }
    });
    
    return resultado;
};

// Obtener clientes en formato de corte de control (estructura plana)
const obtenerClientesEstructurados = async () => {
    return await Cliente.aggregate([
        // Primera etapa: desplegar el array de subServicios
        { $unwind: { path: '$subServicios', preserveNullAndEmptyArrays: false } },
        
        // Segunda etapa: desplegar el array de subUbicaciones
        { $unwind: { path: '$subServicios.subUbicaciones', preserveNullAndEmptyArrays: false } },
        
        // Lookup para obtener datos de supervisores
        {
            $lookup: {
                from: 'users',
                localField: 'subServicios.supervisorId',
                foreignField: '_id',
                as: 'supervisorInfo'
            }
        },
        
        // Tercera etapa: proyectar los campos en la estructura deseada
        {
            $project: {
                _id: 0,
                tipo: 'CLIENTE',
                CLIENTE: '$nombre',
                SUBSERVICIO: '$subServicios.nombre',
                SUBUBICACION: '$subServicios.subUbicaciones.nombre',
                SUPERVISOR: { $arrayElemAt: ['$supervisorInfo.nombre', 0] }
            }
        },
        
        // Cuarta etapa: ordenar los resultados
        { $sort: { CLIENTE: 1, SUBSERVICIO: 1, SUBUBICACION: 1 } }
    ]);
};


// Asignar operario a un subservicio
const asignarOperarioSubServicio = async (clienteId, subServicioId, operarioId) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    // Verificar si el operario ya está asignado
    if (!subServicio.operarios) {
        subServicio.operarios = [];
    }
    
    if (!subServicio.operarios.includes(operarioId)) {
        subServicio.operarios.push(operarioId);
    }
    
    return await cliente.save();
};

// Remover operario de un subservicio
const removerOperarioSubServicio = async (clienteId, subServicioId, operarioId) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    if (subServicio.operarios && subServicio.operarios.length > 0) {
        subServicio.operarios = subServicio.operarios.filter(
            op => op.toString() !== operarioId.toString()
        );
    }
    
    return await cliente.save();
};

// Obtener subServicios asignados a un operario
const obtenerSubServiciosPorOperarioId = async (operarioId) => {
    const clientes = await Cliente.find({ 'subServicios.operarios': operarioId })
        .populate('userId', 'nombre email usuario apellido role isActive')
        .populate('subServicios.supervisorId', 'nombre email usuario apellido role isActive')
        .populate('subServicios.operarios', 'nombre email usuario apellido role isActive');
    
    const subServiciosDelOperario = [];
    
    clientes.forEach(cliente => {
        const subServiciosFiltrados = cliente.subServicios.filter(
            subServ => subServ.operarios && 
            subServ.operarios.some(op => op._id.toString() === operarioId.toString())
        );
        
        if (subServiciosFiltrados.length > 0) {
            subServiciosDelOperario.push({
                clienteId: cliente._id,
                nombreCliente: cliente.nombre,
                userId: cliente.userId,
                subServicios: subServiciosFiltrados
            });
        }
    });
    
    return subServiciosDelOperario;
};

// Modificar la función existente para usar el nuevo campo supervisores
const asignarSupervisorSubServicio = async (clienteId, subServicioId, supervisorId) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    // Inicializar array si no existe
    if (!subServicio.supervisores) {
        subServicio.supervisores = [];
    }
    
    // Verificar si ya está asignado
    if (!subServicio.supervisores.includes(supervisorId)) {
        subServicio.supervisores.push(supervisorId);
    }
    
    // Para compatibilidad, mantener también el campo supervisorId
    subServicio.supervisorId = supervisorId;
    
    return await cliente.save();
};


const asignarSupervisoresSubServicio = async (clienteId, subServicioId, supervisorIds) => {
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return null;
    
    const subServicio = cliente.subServicios.id(subServicioId);
    if (!subServicio) return null;
    
    // Asignar los supervisores al subservicio
    subServicio.supervisorId = supervisorIds;
    
    return await cliente.save();
};

module.exports = {
    obtenerClientes,
    obtenerClientePorId,
    crearCliente,
    actualizarCliente,
    eliminarCliente,
    obtenerClientesPorUserId,
    obtenerClientesPorSupervisorId,
    obtenerSubServiciosPorSupervisorId,
    obtenerClientesSinAsignar,
    agregarSubServicio,
    actualizarSubServicio,
    eliminarSubServicio,
    agregarSubUbicacion,
    actualizarSubUbicacion,
    eliminarSubUbicacion,
    obtenerClientesEstructurados,
    asignarSupervisorSubServicio,
    removerSupervisorSubServicio,
    obtenerSubServiciosSinSupervisor,
    asignarOperarioSubServicio,
    removerOperarioSubServicio,
    obtenerSubServiciosPorOperarioId,
    asignarSupervisoresSubServicio
};