// Model de Serviço com cache
const pool = require('../config/database');
const cache = require('../utils/cache');

class Service {
  static async getAllServices() {
    // Tentar pegar do cache primeiro
    const cached = await cache.get('servicos:all');
    if (cached) {
      return cached;
    }

    const query = `
      SELECT id, servico, preco, duracao, descricao, ativo
      FROM servicos
      WHERE ativo = true
      ORDER BY servico ASC
    `;
    const result = await pool.query(query);
    
    // Cachear por 1 hora
    await cache.set('servicos:all', result.rows, 3600);
    
    return result.rows;
  }

  static async getServiceById(id) {
    const query = `
      SELECT id, servico, preco, duracao, descricao, ativo
      FROM servicos
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async invalidateServiceCache() {
    await cache.delete('servicos:all');
  }
}

module.exports = Service;
