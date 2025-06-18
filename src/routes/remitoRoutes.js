const express = require('express');
const router = express.Router();
const controller = require('../controllers/remitoController');

router.post('/generarRemito', controller.generarRemito)
module.exports = router;






