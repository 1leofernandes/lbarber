// src/services/assinaturaService.js
const pool = require('../config/database');

class AssinaturaService {
    // Buscar assinatura por ID
    async getAssinaturaById(id) {
        try {
            const query = 'SELECT * FROM assinatura WHERE id = $1';
            const result = await pool.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const assinatura = result.rows[0];
            
            // Buscar serviços cobertos
            const servicosQuery = `
                SELECT s.* 
                FROM servicos s
                WHERE $1 = ANY(s.assinatura_ids)
            `;
            const servicosResult = await pool.query(servicosQuery, [id]);

            // Buscar dias da semana que o plano cobre (1..7)
            const diasQuery = `
                SELECT dia_semana FROM assinatura_dias_semana WHERE assinatura_id = $1 ORDER BY dia_semana
            `;
            const diasResult = await pool.query(diasQuery, [id]);
            const dias_semana = diasResult.rows.map(r => r.dia_semana);
            
            return {
                ...assinatura,
                servicos_cobertos: servicosResult.rows,
                dias_semana
            };
        } catch (error) {
            console.error('Erro no getAssinaturaById:', error);
            throw error;
        }
    }
    
    // Verificar se assinatura cobre serviço específico
    async assinaturaCobreServico(assinaturaId, servicoId) {
        try {
            const query = `
                SELECT 1 FROM servicos 
                WHERE id = $1 AND $2 = ANY(assinatura_ids)
            `;
            const result = await pool.query(query, [servicoId, assinaturaId]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Erro no assinaturaCobreServico:', error);
            throw error;
        }
    }
    
    // Buscar todas as assinaturas (para admin)
    async getAllAssinaturas() {
        try {
            const query = 'SELECT * FROM assinatura ORDER BY valor ASC';
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Erro no getAllAssinaturas:', error);
            throw error;
        }
    }
}

module.exports = new AssinaturaService();