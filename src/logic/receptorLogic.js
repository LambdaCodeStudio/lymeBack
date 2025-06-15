const Receptor = require('../models/receptorSchema');

const getAll = async () => {
    return await Receptor.find();
};

const getById = async (id) => {
    return await Receptor.findById(id);
};

const create = async (data) => {
    const nuevo = new Receptor(data);
    return await nuevo.save();
};

const update = async (id, data) => {
    return await Receptor.findByIdAndUpdate(id, data, { new: true });
};

const remove = async (id) => {
    return await Receptor.findByIdAndDelete(id);
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};
