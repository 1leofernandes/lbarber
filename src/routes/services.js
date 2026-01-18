// Rotas de serviços
const express = require('express');
const router = express.Router();
const ServiceController = require('../controllers/serviceController');

// GET /servicos - Listar todos os serviços (com cache)
router.get('/', ServiceController.getAllServices);

module.exports = router;
