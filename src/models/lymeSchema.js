const mongoose = require('mongoose');


const lymeSchema = new mongoose.Schema({

    razonSocial:{type: String, require:true, trim:true},
    cuit:{type: String, require:true, trim:true},
    condiccIva:{type: String, require:true, trim:true},
    domFiscal:{type: String, require:true, trim:true},
    telMail:{type: String, require:true, trim:true},
    puntoVenta:{type: String, require:true, trim:true},
    numRemito:{type: String, require:true, trim:true},
    direcOrigen:{type: String, require:true, trim:true},
})



module.exports = mongoose.model('lyme', lymeSchema);


