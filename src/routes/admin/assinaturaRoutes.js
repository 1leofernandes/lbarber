// src/routes/admin/assinaturaRoutes.js
const express = require('express');
const router = express.Router();
const AssinaturaController = require('../../controllers/admin/assinaturaController');

// ==================== ASSINATURAS (ADMIN) ====================

// GET /admin/assinaturas - Listar todas as assinaturas ativas
router.get('/', AssinaturaController.listarAssinaturas);

// GET /admin/assinaturas/planos - Listar planos de assinatura
router.get('/planos', AssinaturaController.listarPlanos);

// GET /admin/assinaturas/:assinaturaId - Detalhes de uma assinatura
router.get('/:assinaturaId', AssinaturaController.obterDetalhesAssinatura);

// GET /admin/assinaturas/relatorio/resumo - Resumo de assinaturas
router.get('/relatorio/resumo', AssinaturaController.obterResumoAssinaturas);

module.exports = router;
