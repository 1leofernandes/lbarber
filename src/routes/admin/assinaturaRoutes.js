// src/routes/admin/assinaturaRoutes.js
const express = require('express');
const router = express.Router();
const AssinaturaController = require('../../controllers/admin/assinaturaController');

// ==================== PLANOS DE ASSINATURA ====================

// GET /admin/assinaturas/planos - Listar todos os planos
router.get('/planos', AssinaturaController.listarPlanos);

// GET /admin/assinaturas/planos/:planoId - Obter detalhes de um plano
router.get('/planos/:planoId', AssinaturaController.obterDetalhesPlano);

// POST /admin/assinaturas/planos - Criar novo plano
router.post('/planos', AssinaturaController.criarPlano);

// PUT /admin/assinaturas/planos/:planoId - Editar plano
router.put('/planos/:planoId', AssinaturaController.editarPlano);

// DELETE /admin/assinaturas/planos/:planoId - Deletar plano
router.delete('/planos/:planoId', AssinaturaController.deletarPlano);

// ==================== ASSINANTES ====================

// GET /admin/assinaturas/assinantes - Listar usuários com assinatura ativa
router.get('/assinantes', AssinaturaController.listarAssinantesAtivos);

// GET /admin/assinaturas - Alias para listar assinantes
router.get('/', AssinaturaController.listarAssinaturas);

module.exports = router;
