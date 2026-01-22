const pool = require('../config/database');

class Pagamento {
    static async findById(id) {
        const query = `
            SELECT p.*, 
                   u.nome as cliente_nome,
                   a.id as agendamento_id,
                   s.nome_servico,
                   pl.nome as plano_nome
            FROM pagamentos p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            LEFT JOIN agendamentos a ON p.agendamento_id = a.id
            LEFT JOIN servicos s ON a.servico_id = s.id
            LEFT JOIN assinaturas asig ON p.assinatura_id = asig.id
            LEFT JOIN planos pl ON asig.plano_id = pl.id
            WHERE p.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findAll(filters = {}, limit = 100, offset = 0) {
        let query = `
            SELECT p.*, 
                   u.nome as cliente_nome,
                   a.id as agendamento_id,
                   s.nome_servico,
                   pl.nome as plano_nome
            FROM pagamentos p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            LEFT JOIN agendamentos a ON p.agendamento_id = a.id
            LEFT JOIN servicos s ON a.servico_id = s.id
            LEFT JOIN assinaturas asig ON p.assinatura_id = asig.id
            LEFT JOIN planos pl ON asig.plano_id = pl.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (filters.tipo) {
            query += ` AND p.tipo = $${paramCount}`;
            params.push(filters.tipo);
            paramCount++;
        }
        
        if (filters.status) {
            query += ` AND p.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }
        
        if (filters.data_inicio) {
            query += ` AND p.data_pagamento >= $${paramCount}`;
            params.push(filters.data_inicio);
            paramCount++;
        }
        
        if (filters.data_fim) {
            query += ` AND p.data_pagamento <= $${paramCount}`;
            params.push(filters.data_fim);
            paramCount++;
        }
        
        query += ` ORDER BY p.data_pagamento DESC
                   LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        return result.rows;
    }

    static async create(pagamentoData) {
        const { usuario_id, agendamento_id, assinatura_id, tipo, 
                valor, metodo_pagamento, status, transacao_id } = pagamentoData;
        
        const query = `
            INSERT INTO pagamentos 
            (usuario_id, agendamento_id, assinatura_id, tipo, 
             valor, metodo_pagamento, status, transacao_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            usuario_id, agendamento_id, assinatura_id, tipo,
            valor, metodo_pagamento, status || 'pendente', transacao_id
        ]);
        
        return result.rows[0];
    }

    static async updateStatus(id, status) {
        const query = `
            UPDATE pagamentos 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await pool.query(query, [status, id]);
        return result.rows[0];
    }

    static async getReceitaTotal(data_inicio, data_fim) {
        const query = `
            SELECT 
                COALESCE(SUM(valor), 0) as total,
                COUNT(*) as quantidade,
                tipo,
                status
            FROM pagamentos
            WHERE data_pagamento BETWEEN $1 AND $2
            GROUP BY tipo, status
        `;
        
        const result = await pool.query(query, [data_inicio, data_fim]);
        return result.rows;
    }

    static async count() {
        const query = 'SELECT COUNT(*) as total FROM pagamentos';
        const result = await pool.query(query);
        return parseInt(result.rows[0].total);
    }

    static async getTotalHoje() {
        const query = `
            SELECT COALESCE(SUM(valor), 0) as total
            FROM pagamentos
            WHERE DATE(data_pagamento) = CURRENT_DATE
            AND status = 'pago'
        `;
        
        const result = await pool.query(query);
        return parseFloat(result.rows[0].total);
    }
}

module.exports = Pagamento;