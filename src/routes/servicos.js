// src/routes/servicos.js
const express = require('express');
const router = express.Router();
const servicoController = require('../controllers/servicoController');

// GET /servicos - Buscar todos os serviços (público)
router.get('/', servicoController.getAll);

// GET /servicos/:id - Buscar serviço por ID (público)
router.get('/:id', servicoController.getById);

module.exports = router;