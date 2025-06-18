const mongoose = require('mongoose');

const receptorSchema = new mongoose.Schema({
    razonSocialNombre:{type: String, require:true, trim:true},
    cuitDni:{type: String, require:true, trim:true},
    telefEmail:{type: String, require:true, trim:true},
})
// Exportar tanto el schema como el modelo
module.exports = {
    receptorSchema,
    Receptor: mongoose.model('Receptor', receptorSchema)
};