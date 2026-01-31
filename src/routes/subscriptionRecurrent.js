// src/routes/subscriptionRecurrent.js
const express = require('express');
const router = express.Router();
const subscriptionRecurrentController = require('../controllers/subscriptionRecurrentController');
const { authenticateToken } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// ==================== ASSINATURAS RECORRENTES (CLIENT) ===
// Observação: não armazenamos cartões nem criamos assinaturas diretamente.
// O fluxo de assinatura ocorre via redirecionamento para o Mercado Pago.

// GET /subscricoes-recorrentes/planos - Listar planos disponíveis
router.get('/planos', subscriptionRecurrentController.listPlanos);

// GET /subscricoes-recorrentes/minha-assinatura - Buscar minha assinatura
router.get('/minha-assinatura', subscriptionRecurrentController.getMinhaAssinatura);

// GET /subscricoes-recorrentes/minhas-assinaturas - Listar minhas assinaturas
router.get('/minhas-assinaturas', subscriptionRecurrentController.minhasAssinaturas);

// POST /subscricoes-recorrentes/checkout - Criar preapproval no Mercado Pago e retornar URL de redirecionamento
router.post('/checkout', subscriptionRecurrentController.checkout);

// DELETE /subscricoes-recorrentes/:assinaturaRecurrenteId - Cancelar assinatura
router.delete('/:assinaturaRecurrenteId', subscriptionRecurrentController.cancelarAssinatura);


router.post('/confirmar', subscriptionRecurrentController.confirmarAssinatura);


// ==================== HISTÓRICO ====================
// GET /subscricoes-recorrentes/historico/cobrancas - Histórico de cobranças
router.get('/historico/cobrancas', subscriptionRecurrentController.getHistoricoCobrancas);

// ==================== HISTÓRICO ====================

// GET /subscricoes-recorrentes/historico/cobrancas - Histórico de cobranças
router.get('/historico/cobrancas', subscriptionRecurrentController.getHistoricoCobrancas);


// POST /subscricoes-recorrentes/confirmar-manual - Confirmar assinatura manualmente
router.post('/confirmar-manual', subscriptionRecurrentController.confirmarAssinaturaManual);

module.exports = router;
