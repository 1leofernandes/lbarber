// src/services/servicoService.js
const pool = require('../config/database');

class ServicoService {
    // Buscar todos os serviços
    async getAllServicos() {
        try {
            const query = `
                SELECT id, nome_servico, duracao_servico, 
                    CAST(valor_servico AS FLOAT) as valor_servico,
                    descricao, assinatura_ids, created_at
                FROM servicos 
                ORDER BY nome_servico ASC
            `;
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Erro no getAllServicos:', error);
            throw error;
        }
    }
    
    // Buscar serviço por ID
    async getServicoById(id) {
        try {
            const query = `
                SELECT id, nome_servico, duracao_servico, 
                CAST(valor_servico AS FLOAT) as valor_servico,
                       descricao, assinatura_ids, created_at
                FROM servicos 
                WHERE id = $1
            `;
            const result = await pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no getServicoById:', error);
            throw error;
        }
    }
    
    // Buscar serviços por IDs (para múltiplos serviços)
    async getServicosByIds(ids) {
        try {
            if (!ids || ids.length === 0) return [];
            
            const query = `
                SELECT id, nome_servico, duracao_servico, 
                CAST(valor_servico AS FLOAT) as valor_servico,
                       descricao, assinatura_ids, created_at
                FROM servicos 
                WHERE id = ANY($1::int[])
                ORDER BY nome_servico ASC
            `;
            const result = await pool.query(query, [ids]);
            return result.rows;
        } catch (error) {
            console.error('Erro no getServicosByIds:', error);
            throw error;
        }
    }
    
    // Verificar se serviço é coberto por assinatura
    async isServicoCobertoPorAssinatura(servicoId, assinaturaId) {
        try {
            if (!assinaturaId) return false;
            
            const query = `
                SELECT 1 FROM servicos 
                WHERE id = $1 AND $2 = ANY(assinatura_ids)
            `;
            const result = await pool.query(query, [servicoId, assinaturaId]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Erro no isServicoCobertoPorAssinatura:', error);
            throw error;
        }
    }
}

module.exports = new ServicoService();