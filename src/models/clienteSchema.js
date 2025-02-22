const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
    servicio: { 
        type: String, 
        required: true 
    },
    seccionDelServicio: {
        type: String,
        default: ' ' 
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

});

module.exports = mongoose.model('Cliente', clienteSchema);