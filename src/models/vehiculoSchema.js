const mongoose = require('mongoose');

const vehiculoSchema = new mongoose.Schema({

    marca:{type: String, require:true, trim:true},
    modelo:{type: String, require:true, trim:true},
    patente:{type: String, require:true, trim:true},
});

module.exports = mongoose.model('Vehiculo', vehiculoSchema);