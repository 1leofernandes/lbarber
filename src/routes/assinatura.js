// // src/routes/assinatura.js
// const express = require('express');
// const router = express.Router();
// const { assinaturaController } = require('../controllers/assinaturaController');
// const { authenticateToken } = require('../middlewares/auth');

// // Todas as rotas exigem autenticação
// router.use(authenticateToken);

// // GET /assinatura/:id - Buscar assinatura por ID
// router.get('/:id', assinaturaController.getById);

// // GET /assinatura - Buscar todas as assinaturas
// router.get('/', assinaturaController.getAll);

// // module.exports = router;

// // import express from 'express';
// // import { authenticateToken } from '../middlewares/authMiddleware.js';
// // import {
// //   criarPlanoMercadoPago,
// //   listarPlanos,
// //   criarAssinatura,
// //   cancelarAssinatura,
// //   minhasAssinaturas,
// //   obterDetalhesAssinatura,
// //   webhookMercadoPago,
// //   listarCobrancas,
// //   reativarAssinatura,
// //   atualizarMetodoPagamento
// // } from '../controllers/assinaturaController.js';

// // const router = express.Router();

// // Rotas públicas (webhooks)
// router.post('/webhook/mercado-pago', webhookMercadoPago);

// // Rotas autenticadas
// router.get('/planos', authenticateToken, listarPlanos);
// router.post('/assinar/:planoId', authenticateToken, criarAssinatura);
// router.post('/cancelar/:assinaturaId', authenticateToken, cancelarAssinatura);
// router.post('/reativar/:assinaturaId', authenticateToken, reativarAssinatura);
// router.get('/minhas-assinaturas', authenticateToken, minhasAssinaturas);
// router.get('/detalhes/:assinaturaId', authenticateToken, obterDetalhesAssinatura);
// router.get('/cobrancas/:assinaturaId', authenticateToken, listarCobrancas);
// router.post('/atualizar-pagamento/:assinaturaId', authenticateToken, atualizarMetodoPagamento);

// // Rotas admin
// router.post('/admin/criar-plano', authenticateToken, criarPlanoMercadoPago);

// module.exports = router;