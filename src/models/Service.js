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
      SELECT id, nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids
      FROM servicos
      ORDER BY nome_servico ASC
    `;
    const result = await pool.query(query);
    
    // Cachear por 1 hora
    await cache.set('servicos:all', result.rows, 3600);
    
    return result.rows;
  }

  static async getServiceById(id) {
    const query = `
      SELECT id, nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids
      FROM servicos
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async create(servicoData) {
    const { nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids = [] } = servicoData;
    
    const query = `
        INSERT INTO servicos 
        (nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids
    `;
    
    const result = await pool.query(query, [
        nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids
    ]);
    
    // Invalidar cache
    await cache.delete('servicos:all');
    
    return result.rows[0];
  }

  static async update(id, servicoData) {
      const { nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids = [] } = servicoData;
      
      const query = `
          UPDATE servicos 
          SET nome_servico = $1, duracao_servico = $2, valor_servico = $3,
              descricao = $4, assinatura_ids = $5,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING id, nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids
      `;
      
      const result = await pool.query(query, [
          nome_servico, duracao_servico, valor_servico, 
          descricao, assinatura_ids, id
      ]);
      
      // Invalidar cache
      await cache.delete('servicos:all');
      
      return result.rows[0];
  }

  static async delete(id) {
      const query = 'DELETE FROM servicos WHERE id = $1 RETURNING id';
      const result = await pool.query(query, [id]);
      
      // Invalidar cache
      await cache.delete('servicos:all');
      
      return result.rows[0];
  }

  static async count() {
      const query = 'SELECT COUNT(*) as total FROM servicos';
      const result = await pool.query(query);
      return parseInt(result.rows[0].total);
  }

  static async getServicosPorAssinatura(assinatura_id) {
      const query = `
          SELECT id, nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids
          FROM servicos
          WHERE $1 = ANY(assinatura_ids)
          ORDER BY nome_servico ASC
      `;
      
      const result = await pool.query(query, [assinatura_id]);
      return result.rows;
  }

  static async invalidateServiceCache() {
    await cache.delete('servicos:all');
  }

  // Método adicional para buscar múltiplos serviços por IDs (útil para agendamentos)
  static async getServicesByIds(ids) {
    if (!ids || ids.length === 0) {
      return [];
    }
    
    const query = `
      SELECT id, nome_servico, duracao_servico, valor_servico, descricao
      FROM servicos
      WHERE id = ANY($1)
      ORDER BY nome_servico ASC
    `;
    
    const result = await pool.query(query, [ids]);
    return result.rows;
  }

  static async findAll(ativosOnly = true) {
    // Este é um alias para getAllServices para compatibilidade
    return await this.getAllServices();
  }

  static async findById(id) {
    return await this.getServiceById(id);
  }

}

module.exports = Service;