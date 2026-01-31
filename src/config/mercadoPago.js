const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');

const MercadoPago = {
  async getAccessToken() {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }
    return token;
  },

  async getPayment(paymentId) {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      return await res.json();
    } catch (error) {
      logger.error('Erro ao buscar pagamento Mercado Pago:', error);
      throw error;
    }
  },

  async getSubscription(subscriptionId) {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      return await res.json();
    } catch (error) {
      logger.error('Erro ao buscar assinatura Mercado Pago:', error);
      throw error;
    }
  },

  async cancelSubscription(subscriptionId) {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });

      const data = await res.json();
      if (res.status >= 400) {
        logger.warn('Resposta ao cancelar assinatura retornou erro:', data);
        throw new Error('Erro ao cancelar assinatura no Mercado Pago');
      }

      return data;
    } catch (error) {
      logger.error('Erro ao cancelar assinatura no Mercado Pago:', error);
      throw error;
    }
  },

  async createPreapproval({ reason, transaction_amount, payer_email, back_url, external_reference } = {}) {
    try {
      const token = await this.getAccessToken();
      const body = {
        reason: reason || 'Assinatura',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: parseFloat(transaction_amount) || 0,
          currency_id: 'BRL'
        },
        payer_email: payer_email || undefined,
        back_url: back_url || process.env.FRONTEND_URL || null,
        external_reference: external_reference || undefined
      };

      // Remove undefined keys
      Object.keys(body).forEach(k => (body[k] === undefined) && delete body[k]);

      const res = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.status >= 400) {
        logger.warn('Erro ao criar preapproval no Mercado Pago:', data);
        throw new Error('Erro ao criar preapproval no Mercado Pago: ' + JSON.stringify(data));
      }

      // Prefer sandbox_init_point se disponível em sandbox
      const initPoint = data.sandbox_init_point || data.init_point || data.init_point_url || data.init_point_web || null;

      return Object.assign({}, data, { init_point: initPoint });
    } catch (error) {
      logger.error('Erro ao criar preapproval no Mercado Pago:', error);
      throw error;
    }
  }
};

module.exports = MercadoPago;