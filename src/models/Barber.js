const pool = require('../config/database');

class Barbeiro {
    static async findById(id) {
        const query = `
            SELECT id, nome, email, telefone,  created_at, updated_at
            FROM usuarios 
            WHERE id = $1 AND 'barbeiro' = ANY(role)
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findAll(ativosOnly = true) {
        let query = `
            SELECT id, nome, email, telefone, 
                    created_at
            FROM usuarios 
            WHERE 'barbeiro' = ANY(role)
        `;
        
        query += ' ORDER BY nome ASC';
        
        const result = await pool.query(query);
        return result.rows;
    }

    static async create(barbeiroData) {
        const { nome, email, telefone, senha = [] } = barbeiroData;
        
        const query = `
            INSERT INTO usuarios 
            (nome, email, telefone, senha,
             role)
            VALUES ($1, $2, $3, $4, 'barbeiro')
            RETURNING id, nome, email, telefone, role, created_at
        `;
        
        const result = await pool.query(query, [
            nome, email, telefone, senha
        ]);
        
        return result.rows[0];
    }

    static async update(id, barbeiroData) {
        const { nome, email, telefone} = barbeiroData;
        
        const query = `
            UPDATE usuarios 
            SET nome = $1, email = $2, telefone = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND 'barbeiro' = ANY(role)
            RETURNING id, nome, email, telefone
        `;
        
        const result = await pool.query(query, [
            nome, email, telefone, id
        ]);
        
        return result.rows[0];
    }

    static async promoverParaBarbeiro(usuario_id, especialidades = []) {
        const query = `
            UPDATE usuarios 
            SET role = array_append(role, 'barbeiro'),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, nome, email, telefone, role
        `;
        
        const result = await pool.query(query, [usuario_id]);
        return result.rows[0];
    }

    static async rebaixarParaCliente(usuario_id) {
        const query = `
            UPDATE usuarios 
            SET roles = array_remove(roles, 'barbeiro'),
                especialidades = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, nome, email, telefone, roles
        `;
        
        const result = await pool.query(query, [usuario_id]);
        return result.rows[0];
    }

    static async delete(id) {
        const query = `
            DELETE FROM usuarios 
            WHERE id = $1 AND 'barbeiro' = ANY(roles)
            RETURNING id
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async count() {
        const query = `
            SELECT COUNT(*) as total 
            FROM usuarios 
            WHERE 'barbeiro' = ANY(roles)
        `;
        const result = await pool.query(query);
        return parseInt(result.rows[0].total);
    }

    static async getAgendamentosHoje(barbeiro_id) {
        const query = `
            SELECT COUNT(*) as total
            FROM agendamentos
            WHERE barbeiro_id = $1
            AND DATE(data_agendada) = CURRENT_DATE
            AND status NOT IN ('cancelado')
        `;
        
        const result = await pool.query(query, [barbeiro_id]);
        return parseInt(result.rows[0].total);
    }
}

module.exports = Barbeiro;