const Lyme = require('../models/lyme');

const getAll = async () => {
    return await Lyme.find();
};

const getById = async (id) => {
    return await Lyme.findById(id);
};

const create = async (data) => {
    const nuevo = new Lyme(data);
    return await nuevo.save();
};

const update = async (id, data) => {
    return await Lyme.findByIdAndUpdate(id, data, { new: true });
};

const remove = async (id) => {
    return await Lyme.findByIdAndDelete(id);
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};
