// src/services/agendamentoService.js
const pool = require('../config/database');

class AgendamentoService {
    // Criar novo agendamento COM MÚLTIPLOS SERVIÇOS
    async createAgendamentoComServicos(agendamentoData) {
        const client = await pool.connect();
        try {
            const { usuario_id, barbeiro_id, servicos_ids, data_agendada, hora_inicio, hora_fim, observacoes } = agendamentoData;
            
            await client.query('BEGIN');
            
            // 1. Verificar disponibilidade do horário
            const disponivel = await this.verificarDisponibilidadeCompleta(
                barbeiro_id, 
                data_agendada, 
                hora_inicio, 
                hora_fim,
                null
            );
            
            if (!disponivel) {
                throw new Error('Horário indisponível para agendamento');
            }
            
            // 2. Calcular duração total para validação
            const servicosInfo = await Promise.all(
                servicos_ids.map(async (id) => {
                    const result = await client.query(
                        'SELECT duracao_servico FROM servicos WHERE id = $1',
                        [id]
                    );
                    return result.rows[0];
                })
            );
            
            // 3. Criar o agendamento (servico_id pode ser NULL ou primeiro serviço)
            const primeiroServico = servicos_ids[0] || null;
            const agendamentoQuery = `
                INSERT INTO agendamentos 
                (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING *
            `;
            
            const agendamentoValues = [usuario_id, barbeiro_id, primeiroServico, data_agendada, hora_inicio, hora_fim, observacoes || null];
            const agendamentoResult = await client.query(agendamentoQuery, agendamentoValues);
            const agendamento = agendamentoResult.rows[0];
            
            // 4. Inserir relações na tabela agendamento_servicos
            for (const servicoId of servicos_ids) {
                await client.query(
                    'INSERT INTO agendamento_servicos (agendamento_id, servico_id) VALUES ($1, $2)',
                    [agendamento.id, servicoId]
                );
            }
            
            await client.query('COMMIT');
            
            // 5. Retornar agendamento completo com serviços
            return await this.getAgendamentoComServicosById(agendamento.id);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro no createAgendamentoComServicos:', error);
            throw error;
        } finally {
            client.release();
        }
    }
    
    // MÉTODO ORIGINAL (mantido para compatibilidade)
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
    
    // Buscar agendamentos do usuário COM MÚLTIPLOS SERVIÇOS
    async getAgendamentosComServicosByUsuario(usuarioId) {
        try {
            const query = `
                SELECT 
                    a.*, 
                    u.nome as barbeiro_nome,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', s.id,
                                'nome_servico', s.nome_servico,
                                'valor_servico', s.valor_servico,
                                'duracao_servico', s.duracao_servico,
                                'descricao', s.descricao
                            )
                        ) FILTER (WHERE s.id IS NOT NULL),
                        '[]'::json
                    ) as servicos
                FROM agendamentos a
                LEFT JOIN usuarios u ON a.barbeiro_id = u.id
                LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                LEFT JOIN servicos s ON ags.servico_id = s.id
                WHERE a.usuario_id = $1 
                AND a.status != 'cancelado'
                GROUP BY a.id, u.nome
                ORDER BY a.data_agendada DESC, a.hora_inicio DESC
            `;
            const result = await pool.query(query, [usuarioId]);
            return result.rows;
        } catch (error) {
            console.error('Erro no getAgendamentosComServicosByUsuario:', error);
            throw error;
        }
    }
    
    // MÉTODO ORIGINAL (mantido para compatibilidade)
    async getAgendamentosByUsuario(usuarioId) {
        try {
            const query = `
                SELECT a.*, s.nome_servico, s.valor_servico, u.nome as barbeiro_nome
                FROM agendamentos a
                LEFT JOIN servicos s ON a.servico_id = s.id
                LEFT JOIN usuarios u ON a.barbeiro_id = u.id
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
    
    // Buscar um agendamento específico com serviços
    async getAgendamentoComServicosById(agendamentoId, usuarioId = null) {
        try {
            let query;
            let params;
            
            if (usuarioId) {
                query = `
                    SELECT 
                        a.*, 
                        u.nome as barbeiro_nome,
                        COALESCE(
                            json_agg(
                                json_build_object(
                                    'id', s.id,
                                    'nome_servico', s.nome_servico,
                                    'valor_servico', s.valor_servico,
                                    'duracao_servico', s.duracao_servico
                                )
                            ) FILTER (WHERE s.id IS NOT NULL),
                            '[]'::json
                        ) as servicos
                    FROM agendamentos a
                    LEFT JOIN usuarios u ON a.barbeiro_id = u.id
                    LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                    LEFT JOIN servicos s ON ags.servico_id = s.id
                    WHERE a.id = $1 AND a.usuario_id = $2
                    GROUP BY a.id, u.nome
                `;
                params = [agendamentoId, usuarioId];
            } else {
                query = `
                    SELECT 
                        a.*, 
                        u.nome as barbeiro_nome,
                        COALESCE(
                            json_agg(
                                json_build_object(
                                    'id', s.id,
                                    'nome_servico', s.nome_servico,
                                    'valor_servico', s.valor_servico,
                                    'duracao_servico', s.duracao_servico
                                )
                            ) FILTER (WHERE s.id IS NOT NULL),
                            '[]'::json
                        ) as servicos
                    FROM agendamentos a
                    LEFT JOIN usuarios u ON a.barbeiro_id = u.id
                    LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                    LEFT JOIN servicos s ON ags.servico_id = s.id
                    WHERE a.id = $1
                    GROUP BY a.id, u.nome
                `;
                params = [agendamentoId];
            }
            
            const result = await pool.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no getAgendamentoComServicosById:', error);
            throw error;
        }
    }
    
    // Cancelar agendamento
    async cancelarAgendamento(agendamentoId, usuarioId) {
        try {
            const query = `
                UPDATE agendamentos 
                SET status = 'cancelado', updated_at = NOW()
                WHERE id = $1 AND usuario_id = $2 AND status != 'cancelado'
                RETURNING *
            `;
            const result = await pool.query(query, [agendamentoId, usuarioId]);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no cancelarAgendamento:', error);
            throw error;
        }
    }
    
    // Verificar disponibilidade completa (com transações)
    async verificarDisponibilidadeCompleta(barbeiro_id, data_agendada, hora_inicio, hora_fim, excluir_agendamento_id = null) {
        try {
            let query;
            let params;
            
            if (barbeiro_id) {
                query = `
                    SELECT COUNT(*) as total
                    FROM agendamentos
                    WHERE barbeiro_id = $1
                    AND data_agendada = $2
                    AND status NOT IN ('cancelado')
                    AND (
                        (hora_inicio < $4 AND hora_fim > $3) OR
                        (hora_inicio >= $3 AND hora_inicio < $4)
                    )
                    ${excluir_agendamento_id ? 'AND id != $5' : ''}
                `;
                params = [barbeiro_id, data_agendada, hora_inicio, hora_fim];
                if (excluir_agendamento_id) params.push(excluir_agendamento_id);
            } else {
                // Sem barbeiro específico - verificar se há algum disponível
                query = `
                    SELECT COUNT(DISTINCT barbeiro_id) as total
                    FROM agendamentos
                    WHERE data_agendada = $1
                    AND status NOT IN ('cancelado')
                    AND (
                        (hora_inicio < $3 AND hora_fim > $2) OR
                        (hora_inicio >= $2 AND hora_inicio < $3)
                    )
                `;
                params = [data_agendada, hora_inicio, hora_fim];
                
                const result = await pool.query(query, params);
                const barbeirosOcupados = parseInt(result.rows[0].total);
                
                // Buscar total de barbeiros
                const barbeirosQuery = `SELECT COUNT(*) as total FROM usuarios WHERE role = 'barbeiro'`;
                const barbeirosResult = await pool.query(barbeirosQuery);
                const totalBarbeiros = parseInt(barbeirosResult.rows[0].total);
                
                return barbeirosOcupados < totalBarbeiros;
            }
            
            const result = await pool.query(query, params);
            return parseInt(result.rows[0].total) === 0;
        } catch (error) {
            console.error('Erro ao verificar disponibilidade:', error);
            throw error;
        }
    }
    
    // Métodos existentes (mantidos sem alteração)
    async getHorariosDisponiveis(data, duracao, barbeiroId = null) {
        try {
            // ... (código mantido igual) ...
            const dataObj = new Date(data);
            const diaSemana = dataObj.getDay();
            
            if (diaSemana === 0) { // Domingo
                return [];
            }
            
            let horaInicioFunc, horaFimFunc;
            if (diaSemana === 6) { // Sábado
                horaInicioFunc = '08:30';
                horaFimFunc = '18:30';
            } else { // Segunda a Sexta
                horaInicioFunc = '08:30';
                horaFimFunc = '19:00';
            }
            
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
    
    async verificarSlotDisponivel(data, inicio, duracao, barbeiroId) {
        try {
            // ... (código mantido igual) ...
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
                
                const barbeirosQuery = 'SELECT COUNT(*) as total FROM usuarios WHERE role = \'barbeiro\'';
                const barbeirosResult = await pool.query(barbeirosQuery);
                const totalBarbeiros = parseInt(barbeirosResult.rows[0].total);
                
                return barbeirosOcupados < totalBarbeiros;
            }
            
            const result = await pool.query(query, params);
            return parseInt(result.rows[0].count) === 0;
        } catch (error) {
            console.error('Erro no verificarSlotDisponivel:', error);
            throw error;
        }
    }
}

module.exports = new AgendamentoService();