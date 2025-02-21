const router = require('express').Router();
  const { register, login, createTemporaryUser } = require('../controllers/auth');
  const auth = require('../middleware/auth');
  
  router.post('/register', auth, register);
  router.post('/login', login);
  router.post('/temporary', auth, createTemporaryUser);
  router.get('/me', auth, (req, res) => res.json(req.user));
  
  module.exports = router;