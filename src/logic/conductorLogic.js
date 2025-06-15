const Conductor = require('../models/conductorSchema');

const getAll = async () => {
    return await Conductor.find();
};

const getById = async (id) => {
    return await Conductor.findById(id);
};

const create = async (data) => {
    const conductor = new Conductor(data);
    return await conductor.save();
};

const update = async (id, data) => {
    return await Conductor.findByIdAndUpdate(id, data, { new: true });
};

const remove = async (id) => {
    return await Conductor.findByIdAndDelete(id);
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};
