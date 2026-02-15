// src/routes/admin/assinaturaRoutes.js
const express = require('express');
const router = express.Router();
const assinaturaController = require('../../controllers/admin/assinaturaController');

// ==================== ASSINATURAS (ADMIN) ====================

// GET /admin/assinaturas - Listar todas as assinaturas ativas
router.get('/', assinaturaController.listarAssinaturas);

// GET /admin/assinaturas/:assinaturaId - Detalhes de uma assinatura
router.get('/:assinaturaId', assinaturaController.obterDetalhesAssinatura);

// GET /admin/assinaturas/relatorio/resumo - Resumo de assinaturas
router.get('/relatorio/resumo', assinaturaController.obterResumoAssinaturas);

module.exports = router;
