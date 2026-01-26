// src/services/agendamentoService.js
const pool = require('../config/database');

class AgendamentoService {
    // Criar novo agendamento COM MÚLTIPLOS SERVIÇOS
    async createAgendamentoComServicos(agendamentoData) {
        const client = await pool.connect();
        try {
            const { usuario_id, barbeiro_id, servicos_ids, data_agendada, hora_inicio, hora_fim, observacoes } = agendamentoData;
            
            await client.query('BEGIN');
            
            // 1. Verificar disponibilidade do horário (INCLUINDO BLOQUEIOS)
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
                                DISTINCT jsonb_build_object(
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
                                DISTINCT jsonb_build_object(
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
                DELETE FROM agendamentos 
                WHERE id = $1 AND usuario_id = $2
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
    
    // MÉTODO ATUALIZADO: Buscar horários disponíveis (AGORA COM BLOQUEIOS)
    async getHorariosDisponiveis(barbeiro_id, data, servicosIds = [], duracaoMinutos = 30) {
        try {
            console.log(`Buscando horários para barbeiro: ${barbeiro_id}, data: ${data}, duração: ${duracaoMinutos}min`);
            
            // 1. Primeiro verificar se há bloqueios para esta data/barbeiro
            const bloqueios = await this.verificarBloqueios(barbeiro_id, data);
            
            if (bloqueios.todoDiaBloqueado) {
                console.log('Dia inteiro bloqueado para este barbeiro');
                return []; // Retorna array vazio - dia inteiro bloqueado
            }
            
            // 2. Obter horários padrão da barbearia para este dia
            const horariosPadrao = this.gerarHorariosPadrao(data);
            
            // 3. Obter horários ocupados por agendamentos
            const horariosOcupados = await this.getHorariosOcupados(barbeiro_id, data);
            
            // 4. Filtrar horários disponíveis considerando bloqueios
            const horariosDisponiveis = this.filtrarHorariosDisponiveis(
                horariosPadrao, 
                horariosOcupados, 
                bloqueios.horariosBloqueados,
                duracaoMinutos
            );
            
            console.log(`Horários disponíveis encontrados: ${horariosDisponiveis.length}`);
            return horariosDisponiveis;
        } catch (error) {
            console.error('Erro ao buscar horários disponíveis:', error);
            throw error;
        }
    }
    
    // NOVO: Método para verificar bloqueios
    async verificarBloqueios(barbeiro_id, data) {
        try {
            const query = `
                SELECT 
                    tipo,
                    hora_inicio,
                    hora_fim
                FROM bloqueios
                WHERE ativo = true
                AND (
                    barbeiro_id = $1 
                    OR barbeiro_id IS NULL  -- Bloqueios para todos os barbeiros
                )
                AND (
                    (tipo = 'dia' AND $2 BETWEEN data_inicio AND COALESCE(data_fim, data_inicio))
                    OR
                    (tipo = 'periodo' AND $2 BETWEEN data_inicio AND data_fim)
                    OR
                    (tipo = 'horario' AND $2 BETWEEN data_inicio AND COALESCE(data_fim, data_inicio))
                )
                ORDER BY hora_inicio ASC
            `;
            
            const result = await pool.query(query, [barbeiro_id, data]);
            
            const bloqueios = result.rows;
            const resultado = {
                todoDiaBloqueado: false,
                horariosBloqueados: []
            };
            
            // Verificar se há bloqueio de dia inteiro
            resultado.todoDiaBloqueado = bloqueios.some(b => b.tipo === 'dia' || b.tipo === 'periodo');
            
            if (!resultado.todoDiaBloqueado) {
                // Coletar horários bloqueados específicos
                bloqueios.forEach(bloqueio => {
                    if (bloqueio.tipo === 'horario' && bloqueio.hora_inicio && bloqueio.hora_fim) {
                        resultado.horariosBloqueados.push({
                            inicio: bloqueio.hora_inicio,
                            fim: bloqueio.hora_fim
                        });
                    }
                });
            }
            
            console.log(`Bloqueios encontrados: ${JSON.stringify(resultado)}`);
            return resultado;
        } catch (error) {
            console.error('Erro ao verificar bloqueios:', error);
            return { todoDiaBloqueado: false, horariosBloqueados: [] };
        }
    }
    
    // Método para gerar horários padrão
    gerarHorariosPadrao(dataStr) {
        const data = new Date(dataStr);
        const diaSemana = data.getDay(); // 0 = domingo, 1 = segunda, etc.
        
        // Definir horário de funcionamento baseado no dia da semana
        let inicioExpediente, fimExpediente, intervalo;
        
        if (diaSemana === 0) { // Domingo - fechado
            return [];
        } else if (diaSemana === 6) { // Sábado
            inicioExpediente = 8; // 8:00
            fimExpediente = 17; // 17:00 (5:00 PM)
        } else { // Segunda a Sexta
            inicioExpediente = 8; // 8:00
            fimExpediente = 19; // 19:00 (7:00 PM)
        }
        
        intervalo = 30; // 30 minutos
        
        const horarios = [];
        for (let hora = inicioExpediente; hora < fimExpediente; hora++) {
            for (let minuto = 0; minuto < 60; minuto += intervalo) {
                const horaFormatada = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
                
                // Não adicionar horários muito próximos do fim do expediente
                if (hora === fimExpediente - 1 && minuto + intervalo > 60) {
                    continue;
                }
                
                horarios.push(horaFormatada);
            }
        }
        
        return horarios;
    }
    
    // Método para obter horários ocupados
    async getHorariosOcupados(barbeiro_id, data) {
        try {
            let query;
            let params;
            
            if (barbeiro_id) {
                // Para barbeiro específico
                query = `
                    SELECT hora_inicio
                    FROM agendamentos
                    WHERE barbeiro_id = $1
                    AND data_agendada = $2
                    AND status NOT IN ('cancelado')
                `;
                params = [barbeiro_id, data];
            } else {
                // Para "sem preferência" - ver todos os barbeiros
                query = `
                    SELECT hora_inicio
                    FROM agendamentos
                    WHERE data_agendada = $1
                    AND status NOT IN ('cancelado')
                `;
                params = [data];
            }
            
            const result = await pool.query(query, params);
            
            const horariosOcupados = result.rows.map(row => row.hora_inicio);
            console.log(`Horários ocupados encontrados: ${horariosOcupados.length}`);
            return horariosOcupados;
        } catch (error) {
            console.error('Erro ao buscar horários ocupados:', error);
            return [];
        }
    }
    
    // Método para filtrar horários disponíveis
    filtrarHorariosDisponiveis(horariosPadrao, horariosOcupados, horariosBloqueados, duracaoMinutos) {
        if (!horariosPadrao || horariosPadrao.length === 0) {
            return [];
        }
        
        return horariosPadrao.filter(horario => {
            // Verificar se não está ocupado
            if (horariosOcupados.includes(horario)) {
                return false;
            }
            
            // Verificar se não está em um horário bloqueado
            const estaBloqueado = horariosBloqueados.some(bloqueio => {
                const horarioMinutos = this.converterParaMinutos(horario);
                const inicioBloqueio = this.converterParaMinutos(bloqueio.inicio);
                const fimBloqueio = this.converterParaMinutos(bloqueio.fim);
                
                // Verificar se o horário começa durante o bloqueio
                // OU se o horário (com duração) se sobrepõe ao bloqueio
                const horarioComDuracao = horarioMinutos + duracaoMinutos;
                return (horarioMinutos >= inicioBloqueio && horarioMinutos < fimBloqueio) ||
                       (horarioComDuracao > inicioBloqueio && horarioComDuracao <= fimBloqueio) ||
                       (horarioMinutos <= inicioBloqueio && horarioComDuracao >= fimBloqueio);
            });
            
            if (estaBloqueado) {
                return false;
            }
            
            return true;
        });
    }
    
    // Método auxiliar para converter horário para minutos
    converterParaMinutos(horario) {
        if (!horario) return 0;
        const [horas, minutos] = horario.split(':').map(Number);
        return horas * 60 + minutos;
    }
    
    // MÉTODO ORIGINAL (mantido para compatibilidade)
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