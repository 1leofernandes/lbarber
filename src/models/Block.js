const pool = require('../config/database');

class Bloqueio {
    static async findById(id) {
        const query = `
            SELECT b.*, 
                   u.nome as barbeiro_nome
            FROM bloqueios b
            LEFT JOIN usuarios u ON b.barbeiro_id = u.id
            WHERE b.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findAll(filters = {}) {
        let query = `
            SELECT b.*, 
                   u.nome as barbeiro_nome
            FROM bloqueios b
            LEFT JOIN usuarios u ON b.barbeiro_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (filters.data_inicio) {
            query += ` AND b.data_fim >= $${paramCount}`;
            params.push(filters.data_inicio);
            paramCount++;
        }
        
        if (filters.data_fim) {
            query += ` AND b.data_inicio <= $${paramCount}`;
            params.push(filters.data_fim);
            paramCount++;
        }
        
        if (filters.barbeiro_id) {
            query += ` AND (b.barbeiro_id = $${paramCount} OR b.barbeiro_id IS NULL)`;
            params.push(filters.barbeiro_id);
            paramCount++;
        }
        
        query += ' ORDER BY b.data_inicio ASC, b.hora_inicio ASC';
        
        const result = await pool.query(query, params);
        return result.rows;
    }

    static async create(bloqueioData) {
        const { tipo, data_inicio, data_fim, hora_inicio, hora_fim, 
                barbeiro_id, motivo, ativo } = bloqueioData;
        
        const query = `
            INSERT INTO bloqueios 
            (tipo, data_inicio, data_fim, hora_inicio, hora_fim, 
             barbeiro_id, motivo, ativo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            tipo, data_inicio, data_fim, hora_inicio, hora_fim,
            barbeiro_id, motivo, ativo !== false
        ]);
        
        return result.rows[0];
    }

    static async update(id, bloqueioData) {
        const { tipo, data_inicio, data_fim, hora_inicio, hora_fim, 
                barbeiro_id, motivo, ativo } = bloqueioData;
        
        const query = `
            UPDATE bloqueios 
            SET tipo = $1, data_inicio = $2, data_fim = $3,
                hora_inicio = $4, hora_fim = $5, barbeiro_id = $6,
                motivo = $7, ativo = $8, updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            tipo, data_inicio, data_fim, hora_inicio, hora_fim,
            barbeiro_id, motivo, ativo, id
        ]);
        
        return result.rows[0];
    }

    static async delete(id) {
        const query = 'DELETE FROM bloqueios WHERE id = $1 RETURNING id';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async verificarDisponibilidade(barbeiro_id, data, hora_inicio, hora_fim) {
        const query = `
            SELECT EXISTS (
                SELECT 1 
                FROM bloqueios 
                WHERE ativo = true
                AND (
                    barbeiro_id = $1 
                    OR barbeiro_id IS NULL
                )
                AND (
                    -- Bloqueios de dia inteiro
                    (tipo = 'dia' AND $2 BETWEEN data_inicio AND COALESCE(data_fim, data_inicio))
                    OR
                    -- Bloqueios de período
                    (tipo = 'periodo' AND $2 BETWEEN data_inicio AND data_fim)
                    OR
                    -- Bloqueios de horário específico
                    (tipo = 'horario' 
                    AND $2 BETWEEN data_inicio AND COALESCE(data_fim, data_inicio)
                    AND NOT ($4 <= hora_inicio OR $3 >= hora_fim))
                )
            ) as bloqueado
        `;
        
        const result = await pool.query(query, [
            barbeiro_id, 
            data, 
            hora_inicio || '00:00', 
            hora_fim || '23:59'
        ]);
        
        return !result.rows[0].bloqueado;
    }
}

module.exports = Bloqueio;