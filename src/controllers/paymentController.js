// // Controller de pagamentos
// const PaymentService = require('../services/paymentService');
// const logger = require('../utils/logger');

// class PaymentController {
//   // ==================== PLANOS ====================

//   static async getAllPlans(req, res, next) {
//     try {
//       const plans = await PaymentService.getAllPlans();
//       res.json({
//         success: true,
//         plans
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   // ==================== ASSINATURAS ====================

//   static async createSubscription(req, res, next) {
//     try {
//       const { plano_id } = req.body;
//       const usuario_id = req.user.id;

//       if (!plano_id) {
//         return res.status(400).json({
//           success: false,
//           message: 'plano_id obrigatório'
//         });
//       }

//       // TODO: Integrar com Stripe/Pagar.me
//       // 1. Criar sessão de pagamento
//       // 2. Redirecionar para checkout
//       // 3. Webhook confirma pagamento
//       // 4. Criar assinatura no DB

//       const subscription = await PaymentService.createSubscription(
//         usuario_id,
//         plano_id,
//         'stripe' // ou 'pagar_me'
//       );

//       res.status(201).json({
//         success: true,
//         message: 'Assinatura criada com sucesso',
//         subscription
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   static async getMySubscription(req, res, next) {
//     try {
//       const usuario_id = req.user.id;
//       const subscription = await PaymentService.getActiveSubscription(usuario_id);

//       res.json({
//         success: true,
//         subscription: subscription || null
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   static async cancelSubscription(req, res, next) {
//     try {
//       const { subscription_id } = req.body;
//       const usuario_id = req.user.id;

//       if (!subscription_id) {
//         return res.status(400).json({
//           success: false,
//           message: 'subscription_id obrigatório'
//         });
//       }

//       await PaymentService.cancelSubscription(usuario_id, subscription_id);

//       res.json({
//         success: true,
//         message: 'Assinatura cancelada com sucesso'
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   // ==================== HISTÓRICO ====================

//   static async getPaymentHistory(req, res, next) {
//     try {
//       const usuario_id = req.user.id;
//       const { limit = 10, offset = 0 } = req.query;

//       const payments = await PaymentService.getPaymentHistory(
//         usuario_id,
//         parseInt(limit),
//         parseInt(offset)
//       );

//       res.json({
//         success: true,
//         payments
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   // ==================== WEBHOOKS ====================

//   // Exemplo para Stripe
//   static async stripeWebhook(req, res, next) {
//     try {
//       const event = req.body;

//       // TODO: Verificar assinatura webhook do Stripe

//       switch (event.type) {
//         case 'charge.succeeded':
//           // Pagamento aprovado
//           logger.info('Stripe: pagamento aprovado', event);
//           break;
//         case 'charge.failed':
//           // Pagamento falhou
//           logger.warn('Stripe: pagamento falhou', event);
//           break;
//         case 'customer.subscription.deleted':
//           // Assinatura cancelada
//           logger.info('Stripe: assinatura cancelada', event);
//           break;
//       }

//       res.json({ received: true });
//     } catch (err) {
//       logger.error('Erro webhook Stripe:', err.message);
//       res.status(400).json({ error: err.message });
//     }
//   }

//   // Exemplo para Pagar.me
//   static async pagarMeWebhook(req, res, next) {
//     try {
//       const event = req.body;

//       // TODO: Verificar assinatura webhook do Pagar.me

//       logger.info('Pagar.me webhook recebido', event);
//       res.json({ success: true });
//     } catch (err) {
//       logger.error('Erro webhook Pagar.me:', err.message);
//       res.status(400).json({ error: err.message });
//     }
//   }
// }

// module.exports = PaymentController;
