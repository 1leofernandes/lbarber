const pool = require('../config/database');

class Plano {
    static async findById(id) {
        const query = `
            SELECT id, nome, descricao, valor_mensal, beneficios, 
                   ativo, created_at, updated_at
            FROM planos 
            WHERE id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findAll(ativosOnly = true) {
        let query = `
            SELECT id, nome, descricao, valor_mensal, beneficios, ativo
            FROM planos
        `;
        
        if (ativosOnly) {
            query += ' WHERE ativo = true';
        }
        
        query += ' ORDER BY valor_mensal ASC';
        
        const result = await pool.query(query);
        return result.rows;
    }

    static async create(planoData) {
        const { nome, descricao, valor_mensal, beneficios = [] } = planoData;
        
        const query = `
            INSERT INTO planos 
            (nome, descricao, valor_mensal, beneficios, ativo)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            nome, descricao, valor_mensal, beneficios
        ]);
        
        return result.rows[0];
    }

    static async update(id, planoData) {
        const { nome, descricao, valor_mensal, beneficios, ativo } = planoData;
        
        const query = `
            UPDATE planos 
            SET nome = $1, descricao = $2, valor_mensal = $3,
                beneficios = $4, ativo = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            nome, descricao, valor_mensal, beneficios, ativo, id
        ]);
        
        return result.rows[0];
    }

    static async delete(id) {
        const query = 'DELETE FROM planos WHERE id = $1 RETURNING id';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async count() {
        const query = 'SELECT COUNT(*) as total FROM planos WHERE ativo = true';
        const result = await pool.query(query);
        return parseInt(result.rows[0].total);
    }
}

module.exports = Plano;