// src/routes/assinatura.js
const express = require('express');
const router = express.Router();
const assinaturaController = require('../controllers/assinaturaController');
const { authenticateToken } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// GET /assinatura/:id - Buscar assinatura por ID
router.get('/:id', assinaturaController.getById);

// GET /assinatura - Buscar todas as assinaturas
router.get('/', assinaturaController.getAll);

module.exports = router;