const Vehiculo = require('../models/vehiculoSchema');

const getAll = async () => {
    return await Vehiculo.find();
};

const getById = async (id) => {
    return await Vehiculo.findById(id);
};

const create = async (data) => {
    const vehiculo = new Vehiculo(data);
    return await vehiculo.save();
};

const update = async (id, data) => {
    return await Vehiculo.findByIdAndUpdate(id, data, { new: true });
};

const remove = async (id) => {
    return await Vehiculo.findByIdAndDelete(id);
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};
