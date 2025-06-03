const mongoose = require('mongoose');

const conductorSchema = new mongoose.Schema({

    nombre:{type: String, require:true, trim:true},
    dni:{type: String, require:true, trim:true}
});



module.exports = mongoose.model('Conductor', conductorSchema);