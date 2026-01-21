// src/services/agendamentoService.js
const pool = require('../config/database');

class AgendamentoService {
    // Criar novo agendamento
    async createAgendamento(agendamentoData) {
        try {
            const { usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes } = agendamentoData;
            
            const query = `
                INSERT INTO agendamentos 
                (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING *
            `;
            
            const values = [usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes || null];
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no createAgendamento:', error);
            throw error;
        }
    }
    
    // Buscar horários disponíveis
    async getHorariosDisponiveis(data, duracao, barbeiroId = null) {
        try {
            // Verificar se é fim de semana
            const dataObj = new Date(data);
            const diaSemana = dataObj.getDay();
            
            if (diaSemana === 0) { // Domingo
                return [];
            }
            
            // Definir horário de funcionamento
            let horaInicioFunc, horaFimFunc;
            if (diaSemana === 6) { // Sábado
                horaInicioFunc = '08:30';
                horaFimFunc = '18:30';
            } else { // Segunda a Sexta
                horaInicioFunc = '08:30';
                horaFimFunc = '19:00';
            }
            
            // Gerar todos os slots possíveis
            const slotsDisponiveis = [];
            const [inicioHora, inicioMin] = horaInicioFunc.split(':').map(Number);
            const [fimHora, fimMin] = horaFimFunc.split(':').map(Number);
            
            let horaAtual = inicioHora;
            let minAtual = inicioMin;
            
            while (horaAtual < fimHora || (horaAtual === fimHora && minAtual < fimMin)) {
                const inicio = `${String(horaAtual).padStart(2, '0')}:${String(minAtual).padStart(2, '0')}`;
                
                const disponivel = await this.verificarSlotDisponivel(data, inicio, duracao, barbeiroId);
                if (disponivel) {
                    slotsDisponiveis.push({ inicio });
                }
                
                // Avançar 30 minutos
                minAtual += 30;
                if (minAtual >= 60) {
                    horaAtual += 1;
                    minAtual = minAtual % 60;
                }
            }
            
            return slotsDisponiveis;
        } catch (error) {
            console.error('Erro no getHorariosDisponiveis:', error);
            throw error;
        }
    }
    
    // Verificar se slot está disponível
    async verificarSlotDisponivel(data, inicio, duracao, barbeiroId) {
        try {
            // Calcular hora de término
            const [hora, min] = inicio.split(':').map(Number);
            const inicioDate = new Date(`${data}T${inicio}:00`);
            const fimDate = new Date(inicioDate.getTime() + duracao * 60000);
            const fim = `${String(fimDate.getHours()).padStart(2, '0')}:${String(fimDate.getMinutes()).padStart(2, '0')}`;
            
            let query;
            let params;
            
            if (barbeiroId) {
                query = `
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
                params = [barbeiroId, data, inicio, fim];
            } else {
                // Sem preferência - verificar disponibilidade geral
                // Vamos verificar se há algum barbeiro disponível
                query = `
                    SELECT COUNT(DISTINCT barbeiro_id) as count 
                    FROM agendamentos 
                    WHERE data_agendada = $1 
                    AND status != 'cancelado'
                    AND (
                        (hora_inicio < $3 AND hora_fim > $2) OR
                        (hora_inicio >= $2 AND hora_inicio < $3)
                    )
                `;
                params = [data, inicio, fim];
                
                const result = await pool.query(query, params);
                const barbeirosOcupados = parseInt(result.rows[0].count);
                
                // Buscar total de barbeiros
                const barbeirosQuery = 'SELECT COUNT(*) as total FROM usuarios WHERE role = \'barbeiro\'';
                const barbeirosResult = await pool.query(barbeirosQuery);
                const totalBarbeiros = parseInt(barbeirosResult.rows[0].total);
                
                // Se há pelo menos um barbeiro livre, o slot está disponível
                return barbeirosOcupados < totalBarbeiros;
            }
            
            const result = await pool.query(query, params);
            return parseInt(result.rows[0].count) === 0;
        } catch (error) {
            console.error('Erro no verificarSlotDisponivel:', error);
            throw error;
        }
    }
    
    // Buscar agendamentos do usuário
    async getAgendamentosByUsuario(usuarioId) {
        try {
            const query = `
                SELECT a.*, s.nome_servico, s.valor_servico, u.nome as barbeiro_nome
                FROM agendamentos a
                JOIN servicos s ON a.servico_id = s.id
                JOIN usuarios u ON a.barbeiro_id = u.id
                WHERE a.usuario_id = $1 
                AND a.data_agendada >= CURRENT_DATE
                AND a.status != 'cancelado'
                ORDER BY a.data_agendada, a.hora_inicio ASC
            `;
            const result = await pool.query(query, [usuarioId]);
            return result.rows;
        } catch (error) {
            console.error('Erro no getAgendamentosByUsuario:', error);
            throw error;
        }
    }
}

module.exports = new AgendamentoService();