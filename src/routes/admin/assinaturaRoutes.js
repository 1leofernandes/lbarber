// src/routes/admin/assinaturaRoutes.js
const express = require('express');
const router = express.Router();
const assinaturaAdminController = require('../../controllers/admin/assinaturaAdminController');

// ==================== ASSINATURAS (ADMIN) ====================

// GET /admin/assinaturas - Listar todas as assinaturas ativas
router.get('/', assinaturaAdminController.listarAssinaturas);

// GET /admin/assinaturas/:assinaturaId - Detalhes de uma assinatura
router.get('/:assinaturaId', assinaturaAdminController.obterDetalhesAssinatura);

// GET /admin/assinaturas/relatorio/resumo - Resumo de assinaturas
router.get('/relatorio/resumo', assinaturaAdminController.obterResumoAssinaturas);

module.exports = router;
