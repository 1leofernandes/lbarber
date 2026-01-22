const pool = require('../config/database');

class Assinatura {
    static async findById(id) {
        const query = `
            SELECT a.*, 
                   u.nome as cliente_nome, u.email as cliente_email,
                   p.nome as plano_nome, p.valor_mensal
            FROM assinaturas a
            JOIN usuarios u ON a.usuario_id = u.id
            JOIN planos p ON a.plano_id = p.id
            WHERE a.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findByUsuarioId(usuario_id) {
        const query = `
            SELECT a.*, p.nome as plano_nome, p.valor_mensal
            FROM assinaturas a
            JOIN planos p ON a.plano_id = p.id
            WHERE a.usuario_id = $1
            AND a.status = 'ativo'
            ORDER BY a.created_at DESC
            LIMIT 1
        `;
        const result = await pool.query(query, [usuario_id]);
        return result.rows[0];
    }

    static async findAll(filters = {}) {
        let query = `
            SELECT a.*, 
                   u.nome as cliente_nome, u.email as cliente_email,
                   p.nome as plano_nome, p.valor_mensal
            FROM assinaturas a
            JOIN usuarios u ON a.usuario_id = u.id
            JOIN planos p ON a.plano_id = p.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (filters.status) {
            query += ` AND a.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }
        
        query += ' ORDER BY a.created_at DESC';
        
        const result = await pool.query(query, params);
        return result.rows;
    }

    static async create(assinaturaData) {
        const { usuario_id, plano_id, data_inicio, data_vencimento, status } = assinaturaData;
        
        const query = `
            INSERT INTO assinaturas 
            (usuario_id, plano_id, data_inicio, data_vencimento, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            usuario_id, plano_id, data_inicio, data_vencimento, status || 'ativo'
        ]);
        
        return result.rows[0];
    }

    static async update(id, assinaturaData) {
        const { plano_id, data_vencimento, status } = assinaturaData;
        
        const query = `
            UPDATE assinaturas 
            SET plano_id = $1, data_vencimento = $2, status = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `;
        
        const result = await pool.query(query, [plano_id, data_vencimento, status, id]);
        return result.rows[0];
    }

    static async updateStatus(id, status) {
        const query = `
            UPDATE assinaturas 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await pool.query(query, [status, id]);
        return result.rows[0];
    }

    static async delete(id) {
        const query = 'DELETE FROM assinaturas WHERE id = $1 RETURNING id';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async count(status = 'ativo') {
        const query = 'SELECT COUNT(*) as total FROM assinaturas WHERE status = $1';
        const result = await pool.query(query, [status]);
        return parseInt(result.rows[0].total);
    }

    static async getReceitaMensal() {
        const query = `
            SELECT 
                EXTRACT(MONTH FROM data_inicio) as mes,
                EXTRACT(YEAR FROM data_inicio) as ano,
                COUNT(*) as total_assinaturas,
                SUM(p.valor_mensal) as receita_total
            FROM assinaturas a
            JOIN planos p ON a.plano_id = p.id
            WHERE a.status = 'ativo'
            AND a.data_inicio >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')
            GROUP BY EXTRACT(YEAR FROM data_inicio), EXTRACT(MONTH FROM data_inicio)
            ORDER BY ano DESC, mes DESC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }
}

module.exports = Assinatura;