// // Rotas de pagamentos
// const express = require('express');
// const router = express.Router();
// const PaymentController = require('../controllers/paymentController');
// const { authenticateToken } = require('../middlewares/auth');

// // ==================== PLANOS ====================

// // GET /pagamentos/planos - Listar todos os planos
// router.get('/planos', PaymentController.getAllPlans);

// // ==================== ASSINATURAS ====================

// // POST /pagamentos/assinatura - Criar assinatura
// router.post('/assinatura', authenticateToken, PaymentController.createSubscription);

// // GET /pagamentos/assinatura - Ver minha assinatura
// router.get('/assinatura', authenticateToken, PaymentController.getMySubscription);

// // DELETE /pagamentos/assinatura - Cancelar assinatura
// router.delete('/assinatura', authenticateToken, PaymentController.cancelSubscription);

// // ==================== HISTÓRICO ====================

// // GET /pagamentos/historico - Ver histórico de pagamentos
// router.get('/historico', authenticateToken, PaymentController.getPaymentHistory);

// // ==================== WEBHOOKS ====================

// // POST /pagamentos/webhook/stripe - Webhook do Stripe
// router.post('/webhook/stripe', PaymentController.stripeWebhook);

// // POST /pagamentos/webhook/pagar-me - Webhook do Pagar.me
// router.post('/webhook/pagar-me', PaymentController.pagarMeWebhook);

// module.exports = router;
