const pool = require('../config/database');

class Barbeiro {
    static async findById(id) {
        const query = `
            SELECT u.id, u.nome, u.email, u.telefone, u.role, 
                   u.created_at, u.updated_at
            FROM usuarios u
            WHERE u.id = $1 AND u.role = 'barbeiro'
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findAll() {
        const query = `
            SELECT u.id, u.nome, u.email, u.telefone, u.role, 
                   u.created_at, u.updated_at
            FROM usuarios u
            WHERE u.role = 'barbeiro'
            ORDER BY u.nome ASC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    static async create(barbeiroData) {
        const { nome, email, telefone, senha } = barbeiroData;
        
        const query = `
            INSERT INTO usuarios 
            (nome, email, telefone, senha, role)
            VALUES ($1, $2, $3, $4, 'barbeiro')
            RETURNING id, nome, email, telefone, role, created_at
        `;
        
        const result = await pool.query(query, [
            nome, email, telefone, senha
        ]);
        
        return result.rows[0];
    }

    static async update(id, barbeiroData) {
        const { nome, email, telefone } = barbeiroData;
        
        const query = `
            UPDATE usuarios 
            SET nome = $1, email = $2, telefone = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND role = 'barbeiro'
            RETURNING id, nome, email, telefone, role
        `;
        
        const result = await pool.query(query, [
            nome, email, telefone, id
        ]);
        
        return result.rows[0];
    }

    static async promoverParaBarbeiro(usuario_id, especialidades = []) {
        const query = `
            UPDATE usuarios
            SET role = 'barbeiro',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, nome, email, telefone, role
        `;
        const result = await pool.query(query, [usuario_id]);
        return result.rows[0];
    }

    static async rebaixarParaCliente(usuario_id) {
        const query = `
            UPDATE usuarios 
            SET role = 'cliente',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, nome, email, telefone, role
        `;
        
        const result = await pool.query(query, [usuario_id]);
        return result.rows[0];
    }

    static async delete(id) {
        const query = `
            DELETE FROM usuarios 
            WHERE id = $1 AND role = 'barbeiro'
            RETURNING id
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async getAgendamentosHoje(barbeiro_id) {
        const query = `
            SELECT COUNT(*) as total
            FROM agendamentos
            WHERE barbeiro_id = $1
            AND DATE(data_agendada) = CURRENT_DATE
            AND status != 'cancelado'
        `;
        
        const result = await pool.query(query, [barbeiro_id]);
        return parseInt(result.rows[0].total);
    }

    static async getAgendamentosMes(barbeiro_id) {
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        
        const query = `
            SELECT COUNT(*) as total
            FROM agendamentos
            WHERE barbeiro_id = $1
            AND data_agendada BETWEEN $2 AND $3
            AND status != 'cancelado'
        `;
        
        const result = await pool.query(query, [
            barbeiro_id,
            primeiroDiaMes.toISOString().split('T')[0],
            ultimoDiaMes.toISOString().split('T')[0]
        ]);
        
        return parseInt(result.rows[0].total);
    }
}

module.exports = Barbeiro;