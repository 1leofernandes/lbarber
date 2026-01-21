// src/services/barbeiroService.js
const pool = require('../config/database');

class BarbeiroService {
    // Buscar todos os barbeiros
    async getAllBarbeiros() {
        try {
            const query = `
                SELECT id, nome, email, telefone, created_at
                FROM usuarios 
                WHERE role = 'barbeiro'
                ORDER BY nome ASC
            `;
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Erro no getAllBarbeiros:', error);
            throw error;
        }
    }
    
    // Buscar barbeiro por ID
    async getBarbeiroById(id) {
        try {
            const query = `
                SELECT id, nome, email, telefone, created_at
                FROM usuarios 
                WHERE id = $1 AND role = 'barbeiro'
            `;
            const result = await pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no getBarbeiroById:', error);
            throw error;
        }
    }
    
    // Verificar disponibilidade do barbeiro
    async verificarDisponibilidade(barbeiroId, data, horaInicio, duracao) {
        try {
            // Calcular hora de término
            const [hora, min] = horaInicio.split(':').map(Number);
            const inicioDate = new Date(`${data}T${horaInicio}:00`);
            const fimDate = new Date(inicioDate.getTime() + duracao * 60000);
            const horaFim = `${String(fimDate.getHours()).padStart(2, '0')}:${String(fimDate.getMinutes()).padStart(2, '0')}`;
            
            const query = `
                SELECT COUNT(*) as count 
                FROM agendamentos 
                WHERE barbeiro_id = $1 
                AND data_agendada = $2 
                AND status != 'cancelado'
                AND (
                    (hora_inicio < $4 AND hora_fim > $3) OR
                    (hora_inicio >= $3 AND hora_inicio < $4)
                )
            `;
            
            const result = await pool.query(query, [barbeiroId, data, horaInicio, horaFim]);
            return parseInt(result.rows[0].count) === 0;
        } catch (error) {
            console.error('Erro no verificarDisponibilidade:', error);
            throw error;
        }
    }
}

module.exports = new BarbeiroService();