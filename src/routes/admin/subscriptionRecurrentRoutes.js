// src/routes/admin/subscriptionRecurrentRoutes.js
const express = require('express');
const router = express.Router();
const subscriptionRecurrentAdminController = require('../../controllers/admin/subscriptionRecurrentAdminController');

// ==================== ASSINATURAS RECORRENTES (ADMIN) ===
// Observação: o proprietário gerencia Mercado Pago externamente. Mantemos endpoints de monitoramento e relatórios.

// ==================== ASSINATURAS RECORRENTES ====================

// GET /admin/assinaturas-recorrentes - Listar assinaturas
router.get('/', subscriptionRecurrentAdminController.listarAssinaturasRecorrentes);

// GET /admin/assinaturas-recorrentes/:assinaturaId - Detalhes de assinatura
router.get('/:assinaturaId', subscriptionRecurrentAdminController.getAssinaturaRecorrenteDetalhes);

// ==================== COBRANÇAS ====================

// GET /admin/assinaturas-recorrentes/cobrancas - Listar cobranças
router.get('/cobrancas/lista', subscriptionRecurrentAdminController.listarCobrancas);

// ==================== RESUMO ====================

// GET /admin/assinaturas-recorrentes/resumo - Resumo de assinaturas
router.get('/resumo/geral', subscriptionRecurrentAdminController.getResumoAssinaturas);

module.exports = router;
