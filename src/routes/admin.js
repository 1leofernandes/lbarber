const express = require('express');
const router = express.Router();
const adminRoutes = require('./admin');

// Rotas de admin (requer autenticação e privilégios de admin)
router.use('/admin', adminRoutes);

module.exports = router;