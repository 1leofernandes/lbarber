// Service de pagamentos - Exemplo de estrutura (implemente conforme sua escolha)
const pool = require('../config/database');
const logger = require('../utils/logger');

class PaymentService {
  // ==================== PLANOS ====================
  
  static async createPlan(nome, descricao, preco, intervalo, features) {
    const query = `
      INSERT INTO planos_assinatura (nome, descricao, preco, intervalo, features, ativo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, nome, preco, intervalo
    `;
    const result = await pool.query(query, [
      nome,
      descricao,
      preco,
      intervalo,
      JSON.stringify(features)
    ]);
    return result.rows[0];
  }

  static async getAllPlans() {
    const query = `
      SELECT id, nome, descricao, preco, intervalo, features
      FROM planos_assinatura
      WHERE ativo = true
      ORDER BY preco ASC
    `;
    const result = await pool.query(query);
    return result.rows.map(plan => ({
      ...plan,
      features: JSON.parse(plan.features)
    }));
  }

  // ==================== ASSINATURAS ====================

  static async createSubscription(usuario_id, plano_id, metodo = 'stripe') {
    // Esta função será implementada conforme escolha entre Stripe/Pagar.me
    
    const query = `
      INSERT INTO assinaturas (usuario_id, plano_id, status, data_proxima_cobranca)
      VALUES ($1, $2, 'ativa', NOW() + INTERVAL '30 days')
      RETURNING id, usuario_id, plano_id, status, data_proxima_cobranca
    `;
    const result = await pool.query(query, [usuario_id, plano_id]);
    
    logger.info('Assinatura criada', {
      usuario_id,
      plano_id,
      subscription_id: result.rows[0].id
    });
    
    return result.rows[0];
  }

  static async getActiveSubscription(usuario_id) {
    const query = `
      SELECT a.*, p.nome, p.preco, p.features
      FROM assinaturas a
      JOIN planos_assinatura p ON a.plano_id = p.id
      WHERE a.usuario_id = $1
      AND a.status = 'ativa'
      LIMIT 1
    `;
    const result = await pool.query(query, [usuario_id]);
    return result.rows[0] || null;
  }

  static async cancelSubscription(usuario_id, subscription_id) {
    const query = `
      UPDATE assinaturas
      SET status = 'cancelada', data_cancelamento = NOW()
      WHERE id = $1 AND usuario_id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [subscription_id, usuario_id]);
    
    if (result.rows.length === 0) {
      throw new Error('Assinatura não encontrada');
    }
    
    logger.info('Assinatura cancelada', { usuario_id, subscription_id });
    return result.rows[0];
  }

  // ==================== PAGAMENTOS ====================

  static async recordPayment(usuario_id, assinatura_id, amount, status, metodo, transacao_id) {
    const query = `
      INSERT INTO pagamentos (usuario_id, assinatura_id, amount, status, metodo, transacao_id, descricao)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, usuario_id, amount, status, created_at
    `;
    const result = await pool.query(query, [
      usuario_id,
      assinatura_id,
      amount,
      status,
      metodo,
      transacao_id,
      `Pagamento via ${metodo}`
    ]);
    
    logger.info('Pagamento registrado', {
      usuario_id,
      amount,
      status,
      metodo
    });
    
    return result.rows[0];
  }

  static async getPaymentHistory(usuario_id, limit = 10, offset = 0) {
    const query = `
      SELECT id, amount, status, metodo, created_at
      FROM pagamentos
      WHERE usuario_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [usuario_id, limit, offset]);
    return result.rows;
  }
}

module.exports = PaymentService;
