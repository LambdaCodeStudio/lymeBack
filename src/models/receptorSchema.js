const mongoose = require('mongoose');

const receptorSchema = new mongoose.Schema({
    razonSocialNombre:{type: String, require:true, trim:true},
    cuitDni:{type: String, require:true, trim:true},
    domEntrega:{type: String, require:true, trim:true},
    telefEmail:{type: String, require:true, trim:true},
})

module.exports = mongoose.model('Receptor', receptorSchema);