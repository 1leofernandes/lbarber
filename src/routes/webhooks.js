// src/routes/webhooks.js
const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhookController');

// ==================== WEBHOOKS - SEM AUTENTICAÇÃO ====================

// POST /webhooks/mercado-pago - Webhook do Mercado Pago
router.post('/mercado-pago', WebhookController.mercadoPagoWebhook);

module.exports = router;
