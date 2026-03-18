// src/services/agendamentoService.js
const pool = require('../config/database');
const assinaturaService = require('./assinaturaService');
const subscriptionService = require('./subscriptionRecurrentService');
const servicoService = require('./servicoService');

class AgendamentoService {
    // Criar novo agendamento COM MÚLTIPLOS SERVIÇOS
    async createAgendamentoComServicos(agendamentoData) {
        const client = await pool.connect();
        try {
            let { usuario_id, barbeiro_id, servicos_ids, data_agendada, hora_inicio, hora_fim, observacoes } = agendamentoData;
            
            await client.query('BEGIN');
            
            // 1. SE SEM PREFERÊNCIA (barbeiro_id = null), ENCONTRAR UM BARBEIRO DISPONÍVEL
            if (!barbeiro_id) {
                console.log('[createAgendamentoComServicos] Sem preferência de barbeiro, procurando barbeiro disponível...');
                barbeiro_id = await this.encontrarBarbeiroDisponivel(data_agendada, hora_inicio, hora_fim);
                
                if (!barbeiro_id) {
                    throw new Error('Nenhum barbeiro disponível para este horário');
                }
                console.log(`[createAgendamentoComServicos] Barbeiro atribuído: ${barbeiro_id}`);
            }
            
            // 2. Verificar disponibilidade do horário (INCLUINDO BLOQUEIOS)
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
            
            // 3. Calcular duração total para validação
            const servicosInfo = await Promise.all(
                servicos_ids.map(async (id) => {
                    const result = await client.query(
                        'SELECT duracao_servico FROM servicos WHERE id = $1',
                        [id]
                    );
                    return result.rows[0];
                })
            );
            
            // 4. Criar o agendamento (servico_id pode ser NULL ou primeiro serviço)
            const primeiroServico = servicos_ids[0] || null;
            // Verificar se usuário tem assinatura ativa (para referenciar em agendamento)
            const assinaturaUsuario = await subscriptionService.getActiveAssinaturaUsuario(usuario_id);
            const assinaturaUsuarioId = assinaturaUsuario ? assinaturaUsuario.id : null;

            const agendamentoQuery = `
                INSERT INTO agendamentos 
                (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes, assinatura_usuario_id, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                RETURNING *
            `;
            
            const agendamentoValues = [usuario_id, barbeiro_id, primeiroServico, data_agendada, hora_inicio, hora_fim, observacoes || null, assinaturaUsuarioId];
            const agendamentoResult = await client.query(agendamentoQuery, agendamentoValues);
            const agendamento = agendamentoResult.rows[0];
            
            // 5. Inserir relações na tabela agendamento_servicos
            for (const servicoId of servicos_ids) {
                await client.query(
                    'INSERT INTO agendamento_servicos (agendamento_id, servico_id) VALUES ($1, $2)',
                    [agendamento.id, servicoId]
                );
            }
            
            await client.query('COMMIT');
            
            // 6. Retornar agendamento completo com serviços
            return await this.getAgendamentoComServicosById(agendamento.id);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro no createAgendamentoComServicos:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async createAgendamentoComServicosBarber(agendamentoData) {
        const client = await pool.connect();
        try {
            const { 
                usuario_id, 
                barbeiro_id, 
                servicos_ids, 
                data_agendada, 
                hora_inicio, 
                hora_fim, 
                observacoes,
                cliente_nome_admin
            } = agendamentoData;
            
            await client.query('BEGIN');
            
            // Verificar disponibilidade
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
            
            // Calcular duração total (opcional, apenas para validação)
            const servicosInfo = await Promise.all(
                servicos_ids.map(async (id) => {
                    const result = await client.query(
                        'SELECT duracao_servico FROM servicos WHERE id = $1',
                        [id]
                    );
                    return result.rows[0];
                })
            );
            
            // Inserir agendamento
            const primeiroServico = servicos_ids[0] || null;
            
            // Verificar assinatura ativa (se houver)
            const assinaturaUsuario = await subscriptionService.getActiveAssinaturaUsuario(usuario_id);
            const assinaturaUsuarioId = assinaturaUsuario ? assinaturaUsuario.id : null;

            // Query com a nova coluna cliente_nome_admin
            const agendamentoQuery = `
                INSERT INTO agendamentos 
                (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes, assinatura_usuario_id, cliente_nome_admin, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING *
            `;
            
            const agendamentoValues = [
                usuario_id, 
                barbeiro_id, 
                primeiroServico, 
                data_agendada, 
                hora_inicio, 
                hora_fim, 
                observacoes || null, 
                assinaturaUsuarioId,
                cliente_nome_admin || null
            ];
            
            const agendamentoResult = await client.query(agendamentoQuery, agendamentoValues);
            const agendamento = agendamentoResult.rows[0];
            
            // Inserir relações com serviços
            for (const servicoId of servicos_ids) {
                await client.query(
                    'INSERT INTO agendamento_servicos (agendamento_id, servico_id) VALUES ($1, $2)',
                    [agendamento.id, servicoId]
                );
            }
            
            await client.query('COMMIT');
            
            // Retornar agendamento completo com serviços
            return await this.getAgendamentoComServicosById(agendamento.id);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro no createAgendamentoComServicosBarber:', error);
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
            const agendamentos = result.rows;

            // Aplicar descontos/coberturas em cada agendamento
            const agendamentosEnriquecidos = [];
            for (const a of agendamentos) {
                agendamentosEnriquecidos.push(await this.aplicarDescontosAssinatura(a));
            }

            return agendamentosEnriquecidos;
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
                        cl.telefone as usuario_telefone,
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
                    LEFT JOIN usuarios cl ON a.usuario_id = cl.id
                    LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                    LEFT JOIN servicos s ON ags.servico_id = s.id
                    WHERE a.id = $1 AND a.usuario_id = $2
                    GROUP BY a.id, u.nome, cl.telefone
                `;
                params = [agendamentoId, usuarioId];
            } else {
                query = `
                    SELECT 
                        a.*, 
                        u.nome as barbeiro_nome,
                        cl.telefone as usuario_telefone,
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
                    LEFT JOIN usuarios cl ON a.usuario_id = cl.id
                    LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                    LEFT JOIN servicos s ON ags.servico_id = s.id
                    WHERE a.id = $1
                    GROUP BY a.id, u.nome, cl.telefone
                `;
                params = [agendamentoId];
            }
            
            const result = await pool.query(query, params);
            const agendamento = result.rows[0];

            // Aplicar descontos/coberturas de assinatura (se aplicável)
            const agendamentoEnriquecido = await this.aplicarDescontosAssinatura(agendamento);
            return agendamentoEnriquecido;
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
    
    // NOVO: Encontrar um barbeiro disponível para um horário específico (para "sem preferência")
    async encontrarBarbeiroDisponivel(data_agendada, hora_inicio, hora_fim) {
        try {
            console.log(`[encontrarBarbeiroDisponivel] Procurando barbeiro para ${data_agendada} ${hora_inicio}-${hora_fim}`);
            
            // 1. Obter todos os barbeiros ativos
            const barbeirosQuery = `
                SELECT id FROM usuarios 
                WHERE role = 'barbeiro' 
                ORDER BY id ASC
            `;
            const barbeirosResult = await pool.query(barbeirosQuery);
            const barbeiros = barbeirosResult.rows;
            
            if (!barbeiros || barbeiros.length === 0) {
                console.log('[encontrarBarbeiroDisponivel] Nenhum barbeiro ativo encontrado');
                return null;
            }
            
            // 2. Para cada barbeiro, verificar disponibilidade
            for (const barbeiro of barbeiros) {
                const barbeiroId = barbeiro.id;
                
                // Verificar se não há conflito com agendamentos
                const agendamentosQuery = `
                    SELECT COUNT(*) as total
                    FROM agendamentos
                    WHERE barbeiro_id = $1
                    AND data_agendada = $2
                    AND status NOT IN ('cancelado')
                    AND (
                        (hora_inicio < $4 AND hora_fim > $3) OR
                        (hora_inicio >= $3 AND hora_inicio < $4)
                    )
                `;
                
                const agendamentosResult = await pool.query(agendamentosQuery, [
                    barbeiroId,
                    data_agendada,
                    hora_inicio,
                    hora_fim
                ]);
                
                const temAgendamento = parseInt(agendamentosResult.rows[0].total) > 0;
                
                if (temAgendamento) {
                    console.log(`[encontrarBarbeiroDisponivel] Barbeiro ${barbeiroId} ocupado neste horário`);
                    continue;
                }
                
                // Verificar bloqueios
                const bloqueios = await this.verificarBloqueios(barbeiroId, data_agendada);
                
                if (bloqueios.todoDiaBloqueado) {
                    console.log(`[encontrarBarbeiroDisponivel] Barbeiro ${barbeiroId} tem o dia todo bloqueado`);
                    continue;
                }
                
                // Verificar se há conflito com bloqueios específicos
                const horaInicioMin = this.converterParaMinutos(hora_inicio);
                const horaFimMin = this.converterParaMinutos(hora_fim);
                
                let temBloqueio = false;
                for (const bloqueio of bloqueios.horariosBloqueados) {
                    const inicioBloquMin = this.converterParaMinutos(bloqueio.inicio);
                    const fimBloquMin = this.converterParaMinutos(bloqueio.fim);
                    
                    if (horaInicioMin < fimBloquMin && horaFimMin > inicioBloquMin) {
                        console.log(`[encontrarBarbeiroDisponivel] Barbeiro ${barbeiroId} tem bloqueio neste horário`);
                        temBloqueio = true;
                        break;
                    }
                }
                
                if (!temBloqueio) {
                    // Barbeiro disponível encontrado!
                    console.log(`[encontrarBarbeiroDisponivel] Barbeiro ${barbeiroId} é o PRIMEIRO DISPONÍVEL`);
                    return barbeiroId;
                }
            }
            
            console.log('[encontrarBarbeiroDisponivel] Nenhum barbeiro disponível para este horário');
            return null;
        } catch (error) {
            console.error('Erro ao encontrar barbeiro disponível:', error);
            return null;
        }
    }
    
    // MÉTODO ATUALIZADO: Buscar horários disponíveis (AGORA COM BLOQUEIOS E PREÇOS)
    async getHorariosDisponiveis(barbeiro_id, data, servicosIds = [], duracaoMinutos = 30, usuarioId = null) {
        try {
            console.log(`Buscando horários para barbeiro: ${barbeiro_id}, data: ${data}, duração: ${duracaoMinutos}min`);
            
            // Se barbeiro_id é null (sem preferência), usar lógica especial
            if (!barbeiro_id) {
                return await this.getHorariosDisponiveisSemPreferencia(data, servicosIds, duracaoMinutos, usuarioId);
            }
            
            // 1. Primeiro verificar se há bloqueios para esta data/barbeiro
            const bloqueios = await this.verificarBloqueios(barbeiro_id, data);

            console.log('[getHorariosDisponiveis] Bloqueios retornados:', bloqueios);
            
            if (bloqueios.todoDiaBloqueado) {
                console.log('Dia inteiro bloqueado para este barbeiro');
                return { horarios: [], precoEstimado: 0, precoComDesconto: 0 };
            }
            
            // 2. Obter horários padrão da barbearia para este dia
            const horariosPadrao = this.gerarHorariosPadrao(data);
            
            // 3. Obter intervalos ocupados por agendamentos (agora retorna objetos com inicio e fim)
            const intervalosOcupados = await this.getIntervalosOcupados(barbeiro_id, data);

            console.log('Intervalos ocupados retornados do banco:', intervalosOcupados);
            
            // 4. Combinar intervalos de agendamentos com intervalos de bloqueios
            const todosIntervalosIndisponiveis = [
                ...intervalosOcupados,
                ...bloqueios.horariosBloqueados
            ];
            
            // 5. Filtrar horários disponíveis considerando todos os intervalos indisponíveis
            const horariosDisponiveis = this.filtrarHorariosPorIntervalos(
                horariosPadrao,
                todosIntervalosIndisponiveis,
                duracaoMinutos
            );
            
            console.log(`Horários disponíveis encontrados: ${horariosDisponiveis.length}`);

            // Calcular preços estimado e com desconto (se servicosIds fornecidos)
            let precoEstimado = 0;
            let precoComDesconto = 0;
            if (servicosIds && servicosIds.length > 0) {
                const servicos = await Promise.all(servicosIds.map(id => servicoService.getServicoById(id)));
                precoEstimado = servicos.reduce((acc, s) => acc + (s ? parseFloat(s.valor_servico || 0) : 0), 0);

                // Se usuário identificado e assinante, calcular desconto por serviço e por dia
                if (usuarioId) {
                    const userRes = await pool.query('SELECT assinante, assinatura_id FROM usuarios WHERE id = $1', [usuarioId]);
                    const user = userRes.rows[0];
                    if (user && user.assinante && user.assinatura_id) {
                        // CORRIGIDO: assinatura_id é o ID de assinaturas_usuarios, não de assinatura
                        // Buscar o plano_id (que é o ID de assinatura) via assinaturas_usuarios
                        const auRes = await pool.query(
                            `SELECT plano_id FROM assinaturas_usuarios WHERE id = $1 AND status = 'ativa'`,
                            [user.assinatura_id]
                        );
                        
                        if (auRes.rows.length > 0) {
                            const planoId = auRes.rows[0].plano_id;
                            
                            // identificar dia da semana
                            const diaSemana = await (async () => {
                                const q = `SELECT EXTRACT(ISODOW FROM $1::date)::integer as d`;
                                const r = await pool.query(q, [data]);
                                return r.rows[0].d;
                            })();
                            
                            // buscar servicos do plano (usando plano_id, não assinatura_id)
                            const coveredRes = await pool.query(
                                `SELECT servico_id FROM assinatura_servico WHERE assinatura_id = $1 AND servico_id = ANY($2::int[])`,
                                [planoId, servicosIds]
                            );
                            const coveredIds = coveredRes.rows.map(r => r.servico_id);
                            
                            // checar dia coberto (usando plano_id, não assinatura_id)
                            const diaRes = await pool.query(
                                `SELECT 1 FROM assinatura_dias_semana WHERE assinatura_id = $1 AND dia_semana = $2 LIMIT 1`,
                                [planoId, diaSemana]
                            );
                            const diaCoberto = diaRes.rows.length > 0;
                            
                            // aplicar desconto: servicos cobertos e diaCoberto -> valor 0
                            precoComDesconto = servicos.reduce((acc, s) => {
                                if (!s) return acc;
                                const isCovered = diaCoberto && coveredIds.includes(s.id);
                                return acc + (isCovered ? 0 : parseFloat(s.valor_servico || 0));
                            }, 0);
                        } else {
                            precoComDesconto = precoEstimado;
                        }
                    } else {
                        precoComDesconto = precoEstimado;
                    }
                } else {
                    precoComDesconto = precoEstimado;
                }
            }

            return {
                horarios: horariosDisponiveis,
                precoEstimado,
                precoComDesconto
            };
        } catch (error) {
            console.error('Erro ao buscar horários disponíveis:', error);
            throw error;
        }
    }
    
    // NOVO: Buscar horários disponíveis quando "sem preferência" (qualquer barbeiro)
    async getHorariosDisponiveisSemPreferencia(data, servicosIds = [], duracaoMinutos = 30, usuarioId = null) {
        try {
            console.log(`[getHorariosDisponiveisSemPreferencia] Buscando horários gerais para data: ${data}, duração: ${duracaoMinutos}min`);
            
            // 1. Obter horários padrão da barbearia para este dia
            const horariosPadrao = this.gerarHorariosPadrao(data);
            
            if (!horariosPadrao || horariosPadrao.length === 0) {
                console.log('Nenhum horário padrão para este dia (provavelmente domingo)');
                return { horarios: [], precoEstimado: 0, precoComDesconto: 0 };
            }
            
            // 2. Obter todos os barbeiros
            const barbeirosQuery = `SELECT id FROM usuarios WHERE role = 'barbeiro' ORDER BY id ASC`;
            const barbeirosResult = await pool.query(barbeirosQuery);
            const barbeiros = barbeirosResult.rows;
            
            if (!barbeiros || barbeiros.length === 0) {
                console.log('Nenhum barbeiro ativo encontrado');
                return { horarios: [], precoEstimado: 0, precoComDesconto: 0 };
            }
            
            console.log(`[getHorariosDisponiveisSemPreferencia] Total de barbeiros: ${barbeiros.length}`);
            
            // 3. Para cada horário, verificar se ALGUM barbeiro está disponível
            const horariosComDisponibilidade = [];
            
            for (const horario of horariosPadrao) {
                let temBarbeiroDisponivel = false;
                
                for (const barbeiro of barbeiros) {
                    const barbeiroId = barbeiro.id;
                    
                    // Obter intervalos ocupados por agendamentos
                    const intervalosOcupados = await this.getIntervalosOcupados(barbeiroId, data);
                    
                    // Obter bloqueios
                    const bloqueios = await this.verificarBloqueios(barbeiroId, data);
                    
                    if (bloqueios.todoDiaBloqueado) {
                        continue; // Este barbeiro tem o dia todo bloqueado
                    }
                    
                    // Combinar todos os intervalos indisponíveis
                    const todosIntervalosIndisponiveis = [
                        ...intervalosOcupados,
                        ...bloqueios.horariosBloqueados
                    ];
                    
                    // Usar a lógica existente para filtrar
                    const horariosDisponiveisParaBarbeiro = this.filtrarHorariosPorIntervalos(
                        [horario], // Testar apenas este horário
                        todosIntervalosIndisponiveis,
                        duracaoMinutos
                    );
                    
                    if (horariosDisponiveisParaBarbeiro.length > 0) {
                        // Este barbeiro está disponível para este horário!
                        temBarbeiroDisponivel = true;
                        console.log(`[getHorariosDisponiveisSemPreferencia] Horário ${horario} tem barbeiro ${barbeiroId} disponível`);
                        break; // Não precisa verificar outros barbeiros para este horário
                    }
                }
                
                if (temBarbeiroDisponivel) {
                    horariosComDisponibilidade.push(horario);
                }
            }
            
            console.log(`[getHorariosDisponiveisSemPreferencia] Horários com disponibilidade: ${horariosComDisponibilidade.length}`);
            
            // Calcular preços
            let precoEstimado = 0;
            let precoComDesconto = 0;
            if (servicosIds && servicosIds.length > 0) {
                const servicos = await Promise.all(servicosIds.map(id => servicoService.getServicoById(id)));
                precoEstimado = servicos.reduce((acc, s) => acc + (s ? parseFloat(s.valor_servico || 0) : 0), 0);
                precoComDesconto = precoEstimado; // Para "sem preferência", sem descontos especiais
            }

            return {
                horarios: horariosComDisponibilidade,
                precoEstimado,
                precoComDesconto
            };
        } catch (error) {
            console.error('Erro ao buscar horários sem preferência:', error);
            throw error;
        }
    }
    
    // NOVO: Método para verificar bloqueios
    async verificarBloqueios(barbeiro_id, data) {
        try {
            const pool = require('../config/database');
            
            const query = `
                SELECT 
                    tipo,
                    hora_inicio,
                    hora_fim,
                    dias_semana,
                    data_inicio,
                    data_fim
                FROM bloqueios
                WHERE ativo = true
                AND (
                    barbeiro_id = $1 
                    OR barbeiro_id IS NULL
                )
                AND (
                    (tipo IN ('dia', 'periodo') AND $2 BETWEEN data_inicio AND COALESCE(data_fim, data_inicio))
                    OR
                    (tipo = 'horario' AND $2 BETWEEN data_inicio AND COALESCE(data_fim, data_inicio))
                    OR
                    (tipo = 'recorrente' 
                    AND $2 >= data_inicio 
                    AND (data_fim IS NULL OR $2 <= data_fim)
                    AND (
                        CASE 
                            WHEN EXTRACT(DOW FROM $2::date) = 0 THEN 7
                            ELSE EXTRACT(DOW FROM $2::date)::integer
                        END = ANY(dias_semana)
                    ))
                )
                ORDER BY hora_inicio ASC
            `;

            console.log(`[verificarBloqueios] Barbeiro: ${barbeiro_id}, Data: ${data}`);
            
            // Executa a query e armazena o resultado
            const result = await pool.query(query, [barbeiro_id, data]);
            
            console.log('[verificarBloqueios] Resultado da query:', result.rows);

            const bloqueios = result.rows;
            const resultado = {
                todoDiaBloqueado: false,
                horariosBloqueados: []
            };
            
            resultado.todoDiaBloqueado = bloqueios.some(b => b.tipo === 'dia' || b.tipo === 'periodo');
            
            if (!resultado.todoDiaBloqueado) {
                bloqueios.forEach(bloqueio => {
                    if ((bloqueio.tipo === 'horario' || bloqueio.tipo === 'recorrente') && bloqueio.hora_inicio && bloqueio.hora_fim) {
                        resultado.horariosBloqueados.push({
                            inicio: bloqueio.hora_inicio,
                            fim: bloqueio.hora_fim
                        });
                    }
                });
            }
            
            console.log('[verificarBloqueios] Resultado processado:', resultado);
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
        
        // Horários em minutos desde meia-noite
        let inicioMin, fimMin;
        
        if (diaSemana === 0) { // Domingo
            return [];
        } else if (diaSemana === 6) { // Sábado
            inicioMin = 8 * 60 + 30; // 8:30
            fimMin   = 18 * 60 + 30; // 18:30
        } else { // Segunda a Sexta
            inicioMin = 8 * 60 + 30; // 8:30
            fimMin   = 19 * 60;      // 19:00
        }
        
        const intervalo = 30; // minutos
        const horarios = [];
        
        for (let minutos = inicioMin; minutos + intervalo <= fimMin; minutos += intervalo) {
            const hora = Math.floor(minutos / 60);
            const minuto = minutos % 60;
            horarios.push(`${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`);
        }
        
        return horarios;
    }
    
    // NOVO: Método para obter intervalos ocupados (retorna array de objetos {inicio, fim})
    async getIntervalosOcupados(barbeiro_id, data) {
        try {
            let query;
            let params;
            
            if (barbeiro_id) {
                query = `
                    SELECT hora_inicio, hora_fim
                    FROM agendamentos
                    WHERE barbeiro_id = $1
                    AND data_agendada::date = $2::date
                    AND status NOT IN ('cancelado')
                `;
                params = [barbeiro_id, data];
            } else {
                query = `
                    SELECT hora_inicio, hora_fim
                    FROM agendamentos
                    WHERE data_agendada::date = $1::date
                    AND status NOT IN ('cancelado')
                `;
                params = [data];
            }
            
            const result = await pool.query(query, params);
            // Retorna objetos com inicio e fim (removendo segundos se houver)
            return result.rows.map(row => ({
                inicio: row.hora_inicio.substring(0,5),
                fim: row.hora_fim.substring(0,5)
            }));
        } catch (error) {
            console.error('Erro ao buscar intervalos ocupados:', error);
            return [];
        }
    }
    
    // NOVO: Método para filtrar horários baseado em intervalos indisponíveis
    filtrarHorariosPorIntervalos(horariosPadrao, intervalosIndisponiveis, duracaoMinutos) {
        if (!horariosPadrao || horariosPadrao.length === 0) {
            return [];
        }
        
        return horariosPadrao.filter(horario => {
            const horarioMinutos = this.converterParaMinutos(horario);
            const fimHorario = horarioMinutos + duracaoMinutos;
            
            // Verifica se o intervalo [horario, horario+duracao] conflita com algum intervalo indisponível
            const conflito = intervalosIndisponiveis.some(intervalo => {
                const inicioIntervalo = this.converterParaMinutos(intervalo.inicio);
                const fimIntervalo = this.converterParaMinutos(intervalo.fim);
                
                // Há conflito se os intervalos se sobrepõem
                return (horarioMinutos < fimIntervalo && fimHorario > inicioIntervalo);
            });
            
            return !conflito;
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

    // Aplicar descontos/coberturas de assinatura a um agendamento (retorna agendamento enriquecido com preços)
    async aplicarDescontosAssinatura(agendamento) {
        try {
            if (!agendamento) return agendamento;

            const servicos = agendamento.servicos || [];
            const usuarioId = agendamento.usuario_id;
            const dataAgendada = agendamento.data_agendada;

            // Buscar assinatura do agendamento (prioriza assinatura_usuario_id se existir)
            let assinaturaUsuario = null;
            if (agendamento.assinatura_usuario_id) {
                const res = await pool.query('SELECT * FROM assinaturas_usuarios WHERE id = $1', [agendamento.assinatura_usuario_id]);
                assinaturaUsuario = res.rows[0] || null;
            }
            if (!assinaturaUsuario) {
                assinaturaUsuario = await subscriptionService.getActiveAssinaturaUsuario(usuarioId);
            }

            let assinaturaPlanoId = null;
            let diasSemana = [];

            if (assinaturaUsuario) {
                assinaturaPlanoId = assinaturaUsuario.plano_id;
                const assin = await assinaturaService.getAssinaturaById(assinaturaPlanoId);
                diasSemana = assin && Array.isArray(assin.dias_semana) ? assin.dias_semana : [];
            }

            // Converter data para dia da semana compatível com DB (1..7, segunda=1, domingo=7)
            let dbDay = null;
            if (dataAgendada) {
                const d = new Date(dataAgendada);
                const jsDay = d.getDay(); // 0 (domingo) .. 6 (sabado)
                dbDay = jsDay === 0 ? 7 : jsDay; // 1..7 where segunda=1
            }

            let subtotal = 0;
            let descontoTotal = 0;
            const servicosEnriquecidos = [];

            for (const s of servicos) {
                const valorOriginal = parseFloat(s.valor_servico) || 0;
                let coberto = false;

                if (assinaturaPlanoId && dbDay !== null) {
                    const isCobertoPorPlano = await servicoService.isServicoCobertoPorAssinatura(s.id, assinaturaPlanoId);
                    if (isCobertoPorPlano && diasSemana.includes(dbDay)) {
                        coberto = true;
                    }
                }

                const valorFinal = coberto ? 0 : valorOriginal;
                subtotal += valorOriginal;
                descontoTotal += (valorOriginal - valorFinal);

                servicosEnriquecidos.push({
                    ...s,
                    valor_original: valorOriginal,
                    valor_final: valorFinal,
                    coberto
                });
            }

            const total = subtotal - descontoTotal;

            return {
                ...agendamento,
                servicos: servicosEnriquecidos,
                valor_subtotal: subtotal,
                desconto_total: descontoTotal,
                valor_total: total,
                assinatura_usuario: assinaturaUsuario ? { id: assinaturaUsuario.id, plano_id: assinaturaUsuario.plano_id } : null
            };
        } catch (error) {
            console.error('Erro ao aplicar descontos de assinatura:', error);
            return agendamento;
        }
    }
}

module.exports = new AgendamentoService();