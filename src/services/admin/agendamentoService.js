// src/services/admin/agendamentoService.js
const Appointment = require('../../models/Appointment');
const User = require('../../models/User');
const Service = require('../../models/Service');
const Barber = require('../../models/Barber');
const Block = require('../../models/Block');
const agendamentoService = require('../agendamentoService');
const pool = require('../../config/database');

class AdminAgendamentoService {
    // NO services/admin/agendamentoService.js - MÉTODO getAllAgendamentos ATUALIZADO

    async getAllAgendamentos(filters = {}, limit = 100, offset = 0) {
        try {
            // --- SQL otimizado: sem GROUP BY ou json_agg complexo ---
            let query = `
                SELECT 
                    a.id,
                    a.usuario_id,
                    a.barbeiro_id,
                    a.servico_id,
                    a.data_agendada,
                    a.hora_inicio,
                    a.hora_fim,
                    a.status,
                    a.observacoes,
                    a.assinatura_usuario_id,
                    a.cliente_nome_admin,
                    a.created_at,
                    a.updated_at,
                    u.nome as usuario_nome,
                    u.telefone as usuario_telefone,
                    b.nome as barbeiro_nome
                FROM agendamentos a
                LEFT JOIN usuarios u ON a.usuario_id = u.id
                LEFT JOIN usuarios b ON a.barbeiro_id = b.id
            `;

            const conditions = [];
            const params = [];
            let paramIndex = 1;

            // Construir filtros dinamicamente
            if (filters.data) {
                conditions.push(`a.data_agendada = $${paramIndex++}`);
                params.push(filters.data);
            }
            if (filters.status) {
                conditions.push(`a.status = $${paramIndex++}`);
                params.push(filters.status);
            }
            if (filters.barbeiro_id) {
                conditions.push(`a.barbeiro_id = $${paramIndex++}`);
                params.push(filters.barbeiro_id);
            }
            if (filters.cliente) {
                conditions.push(`(a.cliente_nome_admin ILIKE $${paramIndex} OR u.nome ILIKE $${paramIndex})`);
                params.push(`%${filters.cliente}%`);
                paramIndex++;
            }
            if (filters.usuario_id) {
                conditions.push(`a.usuario_id = $${paramIndex++}`);
                params.push(filters.usuario_id);
            }
            if (filters.data_inicio) {
                conditions.push(`a.data_agendada >= $${paramIndex++}`);
                params.push(filters.data_inicio);
            }
            if (filters.data_fim) {
                conditions.push(`a.data_agendada <= $${paramIndex++}`);
                params.push(filters.data_fim);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            // Ordenação eficiente com índices
            query += ` ORDER BY a.data_agendada DESC, a.hora_inicio DESC`;
            // Usar LIMIT com offset otimizado (máximo 5000 registros por fetch)
            const limitSafe = Math.min(parseInt(limit) || 100, 5000);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limitSafe, parseInt(offset) || 0);

            const result = await pool.query(query, params);
            const agendamentosBasicos = result.rows;

            // --- OTIMIZAÇÃO CRÍTICA: Enriquecer em PARALELO (Promise.all) não sequencial ---
            // Batches de 10 para não sobrecarregar o pool de conexões
            const batchSize = 10;
            const agendamentosEnriquecidos = [];
            
            for (let i = 0; i < agendamentosBasicos.length; i += batchSize) {
                const batch = agendamentosBasicos.slice(i, i + batchSize);
                const agendamentosEnriquecidosBatch = await Promise.all(
                    batch.map(a => this.enriquecerAgendamentoComServicos(a))
                );
                agendamentosEnriquecidos.push(...agendamentosEnriquecidosBatch);
            }
            
            return agendamentosEnriquecidos;
            
        } catch (error) {
            console.error('Erro ao buscar agendamentos:', error);
            throw error;
        }
    }

    async getAgendamentoById(id) {
        try {
            // Usar agendamentoService para garantir preços e coberturas aplicadas
            const agendamento = await agendamentoService.getAgendamentoComServicosById(id);
            if (!agendamento) {
                throw new Error('Agendamento não encontrado');
            }
            return agendamento;
        } catch (error) {
            console.error('Erro ao buscar agendamento:', error);
            throw error;
        }
    }

    // NOVO: Criar agendamento com múltiplos serviços
    async createAgendamentoComServicos(agendamentoData) {
        try {
            // Validar dados
            await this.validarAgendamentoComServicos(agendamentoData);
            
            // Verificar disponibilidade
            const disponivel = await this.verificarDisponibilidade(
                agendamentoData.barbeiro_id,
                agendamentoData.data_agendada,
                agendamentoData.hora_inicio,
                agendamentoData.hora_fim
            );
            
            if (!disponivel) {
                throw new Error('Horário indisponível para agendamento');
            }
            
            // Criar agendamento com serviços
            return await Appointment.createWithServices(
                agendamentoData.usuario_id,
                agendamentoData.barbeiro_id,
                agendamentoData.servicos_ids,
                agendamentoData.data_agendada,
                agendamentoData.hora_inicio,
                agendamentoData.hora_fim,
                agendamentoData.observacoes
            );
        } catch (error) {
            console.error('Erro ao criar agendamento:', error);
            throw error;
        }
    }

    // MÉTODO ORIGINAL (mantido para compatibilidade)
    async createAgendamento(agendamentoData) {
        try {
            // Validar dados
            await this.validarAgendamento(agendamentoData);
            
            // Verificar disponibilidade
            const disponivel = await this.verificarDisponibilidade(
                agendamentoData.barbeiro_id,
                agendamentoData.data_agendada,
                agendamentoData.hora_inicio,
                agendamentoData.hora_fim
            );
            
            if (!disponivel) {
                throw new Error('Horário indisponível para agendamento');
            }
            
            // Criar agendamento
            return await Appointment.create(
                agendamentoData.usuario_id,
                agendamentoData.barbeiro_id,
                agendamentoData.servico_id,
                agendamentoData.data_agendada,
                agendamentoData.hora_inicio,
                agendamentoData.hora_fim
            );
        } catch (error) {
            console.error('Erro ao criar agendamento:', error);
            throw error;
        }
    }

    // NOVO: Atualizar agendamento com múltiplos serviços
    async updateAgendamentoComServicos(id, agendamentoData) {
        try {
            // Buscar agendamento existente
            const agendamentoExistente = await Appointment.findByIdWithServices(id);
            if (!agendamentoExistente) {
                throw new Error('Agendamento não encontrado');
            }
            
            // Se houve alteração no horário, verificar disponibilidade
            if (agendamentoData.data_agendada || agendamentoData.hora_inicio || agendamentoData.barbeiro_id) {
                const data = agendamentoData.data_agendada || agendamentoExistente.data_agendada;
                const horaInicio = agendamentoData.hora_inicio || agendamentoExistente.hora_inicio;
                const horaFim = agendamentoData.hora_fim || agendamentoExistente.hora_fim;
                const barbeiroId = agendamentoData.barbeiro_id || agendamentoExistente.barbeiro_id;
                
                // Verificar disponibilidade (excluindo o próprio agendamento)
                const disponivel = await this.verificarDisponibilidade(
                    barbeiroId,
                    data,
                    horaInicio,
                    horaFim,
                    id
                );
                
                if (!disponivel) {
                    throw new Error('Horário indisponível para agendamento');
                }
            }
            
            // Atualizar agendamento com serviços
            return await Appointment.updateWithServices(id, agendamentoData);
        } catch (error) {
            console.error('Erro ao atualizar agendamento:', error);
            throw error;
        }
    }

    // MÉTODO ORIGINAL (mantido para compatibilidade)
    async updateAgendamento(id, agendamentoData) {
        try {
            // Buscar agendamento existente
            const agendamentoExistente = await Appointment.findById(id);
            if (!agendamentoExistente) {
                throw new Error('Agendamento não encontrado');
            }
            
            // Se houve alteração no horário, verificar disponibilidade
            if (agendamentoData.data_agendada || agendamentoData.hora_inicio || agendamentoData.barbeiro_id) {
                const data = agendamentoData.data_agendada || agendamentoExistente.data_agendada;
                const horaInicio = agendamentoData.hora_inicio || agendamentoExistente.hora_inicio;
                const horaFim = agendamentoData.hora_fim || agendamentoExistente.hora_fim;
                const barbeiroId = agendamentoData.barbeiro_id || agendamentoExistente.barbeiro_id;
                
                // Verificar disponibilidade (excluindo o próprio agendamento)
                const disponivel = await this.verificarDisponibilidade(
                    barbeiroId,
                    data,
                    horaInicio,
                    horaFim,
                    id
                );
                
                if (!disponivel) {
                    throw new Error('Horário indisponível para agendamento');
                }
            }
            
            // Atualizar agendamento
            return await Appointment.update(id, agendamentoData);
        } catch (error) {
            console.error('Erro ao atualizar agendamento:', error);
            throw error;
        }
    }

    async updateStatus(id, status) {
        try {
            const statusValidos = ['pendente', 'confirmado', 'concluido', 'cancelado'];
            
            if (!statusValidos.includes(status)) {
                throw new Error('Status inválido');
            }
            
            return await Appointment.updateStatus(id, status);
        } catch (error) {
            console.error('Erro ao atualizar status do agendamento:', error);
            throw error;
        }
    }

    async deleteAgendamento(id) {
        try {
            const agendamento = await Appointment.findById(id);
            if (!agendamento) {
                throw new Error('Agendamento não encontrado');
            }
            
            // Verificar se pode ser excluído (não pode excluir agendamentos concluídos)
            if (agendamento.status === 'concluido') {
                throw new Error('Não é possível excluir agendamentos concluídos');
            }

            return await Appointment.delete(id);
        } catch (error) {
            console.error('Erro ao excluir agendamento:', error);
            throw error;
        }
    }

    async verificarDisponibilidade(barbeiro_id, data, hora_inicio, hora_fim, excluir_agendamento_id = null) {
        try {
            // Verificar bloqueios
            const semBloqueios = await Block.verificarDisponibilidade(
                barbeiro_id,
                data,
                hora_inicio,
                hora_fim
            );
            
            if (!semBloqueios) {
                return false;
            }
            
            // Verificar outros agendamentos
            const query = `
                SELECT COUNT(*) as total
                FROM agendamentos
                WHERE barbeiro_id = $1
                AND data_agendada = $2
                AND status NOT IN ('cancelado')
                AND NOT ($4 <= hora_inicio OR $3 >= hora_fim)
                ${excluir_agendamento_id ? 'AND id != $5' : ''}
            `;
            
            const pool = require('../../config/database');
            const params = [barbeiro_id, data, hora_inicio, hora_fim];
            if (excluir_agendamento_id) params.push(excluir_agendamento_id);
            
            const result = await pool.query(query, params);
            return parseInt(result.rows[0].total) === 0;
        } catch (error) {
            console.error('Erro ao verificar disponibilidade:', error);
            throw error;
        }
    }

    // NOVO: Validação para múltiplos serviços
    async validarAgendamentoComServicos(agendamentoData) {
        const { usuario_id, barbeiro_id, servicos_ids, data_agendada, hora_inicio, hora_fim } = agendamentoData;
        
        // Validar usuário
        const usuario = await User.findById(usuario_id);
        if (!usuario) {
            throw new Error('Usuário não encontrado');
        }
        
        // Validar barbeiro
        if (barbeiro_id) {
            const barbeiro = await Barber.findById(barbeiro_id);
            if (!barbeiro) {
                throw new Error('Barbeiro não encontrado');
            }
        }
        
        // Validar serviços
        if (!servicos_ids || !Array.isArray(servicos_ids) || servicos_ids.length === 0) {
            throw new Error('É necessário selecionar pelo menos um serviço');
        }
        
        for (const servicoId of servicos_ids) {
            const servico = await Service.findById(servicoId);
            if (!servico) {
                throw new Error(`Serviço com ID ${servicoId} não encontrado`);
            }
        }
        
        // Validar data e hora
        const dataAgendamento = new Date(data_agendada);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (dataAgendamento < hoje) {
            throw new Error('Não é possível agendar para datas passadas');
        }
        
        // Validar horário de funcionamento
        const horaInicioNum = parseInt(hora_inicio.split(':')[0]);
        const minutoInicioNum = parseInt(hora_inicio.split(':')[1]);
        
        if (horaInicioNum < 8 || horaInicioNum > 19 || 
            (horaInicioNum === 19 && minutoInicioNum > 0)) {
            throw new Error('Horário fora do funcionamento da barbearia (8:00 - 19:00)');
        }
        
        return true;
    }

    // MÉTODO ORIGINAL (mantido para compatibilidade)
    async validarAgendamento(agendamentoData) {
        const { usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim } = agendamentoData;
        
        // Validar usuário
        const usuario = await User.findById(usuario_id);
        if (!usuario) {
            throw new Error('Usuário não encontrado');
        }
        
        // Validar barbeiro
        if (barbeiro_id) {
            const barbeiro = await Barber.findById(barbeiro_id);
            if (!barbeiro) {
                throw new Error('Barbeiro não encontrado');
            }
        }
        
        // Validar serviço
        const servico = await Service.findById(servico_id);
        if (!servico) {
            throw new Error('Serviço não encontrado');
        }
        
        // Validar data e hora
        const dataAgendamento = new Date(data_agendada);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (dataAgendamento < hoje) {
            throw new Error('Não é possível agendar para datas passadas');
        }
        
        // Validar horário de funcionamento
        const horaInicioNum = parseInt(hora_inicio.split(':')[0]);
        const minutoInicioNum = parseInt(hora_inicio.split(':')[1]);
        
        if (horaInicioNum < 8 || horaInicioNum > 19 || 
            (horaInicioNum === 19 && minutoInicioNum > 0)) {
            throw new Error('Horário fora do funcionamento da barbearia (8:00 - 19:00)');
        }
        
        return true;
    }

    async getHorariosDisponiveis(barbeiro_id, data) {
        try {
            // 1. Obter limites de funcionamento para a data
            const dataObj = new Date(data);
            const diaSemana = dataObj.getDay(); // 0=domingo, 1=segunda...
            
            let inicioMin, fimMin;
            if (diaSemana === 0) {
                return []; // domingo fechado
            } else if (diaSemana === 6) { // sábado
                inicioMin = 8 * 60 + 30; // 8:30
                fimMin   = 18 * 60 + 30; // 18:30
            } else { // segunda a sexta
                inicioMin = 8 * 60 + 30; // 8:30
                fimMin   = 19 * 60;      // 19:00
            }

            // 2. Gerar slots de 30 em 30 minutos
            const intervalo = 30; // minutos
            const todosSlots = [];
            for (let minutos = inicioMin; minutos + intervalo <= fimMin; minutos += intervalo) {
                const hora = Math.floor(minutos / 60);
                const min = minutos % 60;
                todosSlots.push(`${hora.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
            }

            // 3. Buscar horários ocupados (agendamentos + bloqueios)
            const [horariosOcupados, bloqueios] = await Promise.all([
                Appointment.getUnavailableHours(barbeiro_id, data),
                Block.findAll({ id_barbeiro: barbeiro_id, data: data })
            ]);

            // 4. Filtrar slots disponíveis
            const horariosDisponiveis = todosSlots.filter(slot => {
                // Verificar se não está em agendamento
                if (horariosOcupados.includes(slot)) return false;

                // Verificar bloqueios
                const slotMinutos = this._converterParaMinutos(slot);
                const estaBloqueado = bloqueios.some(bloqueio => {
                    if (bloqueio.tipo === 'dia') return true;

                    const inicioBloqueio = this._converterParaMinutos(bloqueio.hora_inicio || '00:00');
                    const fimBloqueio   = this._converterParaMinutos(bloqueio.hora_fim || '23:59');
                    // Verifica sobreposição considerando duração padrão (ex: 30 min)
                    return (slotMinutos < fimBloqueio && slotMinutos + intervalo > inicioBloqueio);
                });

                return !estaBloqueado;
            });

            return horariosDisponiveis;
        } catch (error) {
            console.error('Erro ao buscar horários disponíveis (admin):', error);
            throw error;
        }
    }

    async getResumoAgendamentos(data_inicio, data_fim) {
        try {
            const query = `
                SELECT 
                    DATE(a.data_agendada) as data,
                    COUNT(DISTINCT a.id) as total_agendamentos,
                    COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as concluidos,
                    COUNT(CASE WHEN a.status = 'cancelado' THEN 1 END) as cancelados,
                    COALESCE(
                        SUM(
                            CASE
                              WHEN u.assinante = true
                                AND u.assinatura_id IS NOT NULL
                                AND EXISTS (
                                  SELECT 1 FROM assinatura_servico ass WHERE ass.assinatura_id = u.assinatura_id AND ass.servico_id = s2.id
                                )
                                AND EXISTS (
                                  SELECT 1 FROM assinatura_dias_semana ads WHERE ads.assinatura_id = u.assinatura_id AND ads.dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::integer
                                )
                              THEN 0
                              ELSE COALESCE(s2.valor_servico, 0)
                            END
                        ), 
                    0) as receita
                FROM agendamentos a
                LEFT JOIN usuarios u ON a.usuario_id = u.id
                LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                LEFT JOIN servicos s2 ON ags.servico_id = s2.id
                WHERE a.data_agendada BETWEEN $1 AND $2
                GROUP BY DATE(a.data_agendada)
                ORDER BY data ASC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [data_inicio, data_fim]);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar resumo de agendamentos:', error);
            throw error;
        }
    }

    // OTIMIZADO: Enriquecer um agendamento com serviços (paralelo, não sequencial)
    async enriquecerAgendamentoComServicos(agendamento) {
        try {
            // Buscar serviços do agendamento em uma única query
            const servicosResult = await pool.query(`
                SELECT s.id, s.nome_servico, s.valor_servico, s.duracao_servico, s.descricao
                FROM servicos s
                INNER JOIN agendamento_servicos ags ON s.id = ags.servico_id
                WHERE ags.agendamento_id = $1
            `, [agendamento.id]);
            
            const servicos = servicosResult.rows;
            
            // Aplicar descontos (versão otimizada com menos queries)
            const servicosEnriquecidos = await this.aplicarDescontosAssinaturaOtimizado(
                agendamento.usuario_id,
                agendamento.data_agendada,
                servicos,
                agendamento.assinatura_usuario_id
            );
            
            let subtotal = 0;
            let descontoTotal = 0;
            
            for (const s of servicosEnriquecidos) {
                subtotal += parseFloat(s.valor_original) || 0;
                descontoTotal += (parseFloat(s.valor_original) - parseFloat(s.valor_final)) || 0;
            }
            
            return {
                ...agendamento,
                servicos: servicosEnriquecidos,
                valor_subtotal: subtotal,
                desconto_total: descontoTotal,
                valor_total: subtotal - descontoTotal
            };
        } catch (error) {
            console.error('Erro ao enriquecer agendamento:', error);
            // Retornar agendamento básico sem erro crítico
            return {
                ...agendamento,
                servicos: [],
                valor_subtotal: 0,
                desconto_total: 0,
                valor_total: 0
            };
        }
    }
    
    // OTIMIZADO: Aplicar descontos de assinatura (menos queries)
    async aplicarDescontosAssinaturaOtimizado(usuarioId, dataAgendada, servicos, assinaturaUsuarioId) {
        try {
            // Se não há serviços, retornar vazio
            if (!servicos || servicos.length === 0) return [];
            
            // Buscar assinatura ativa uma única vez
            let assinaturaUsuario = null;
            if (assinaturaUsuarioId) {
                const res = await pool.query(
                    'SELECT * FROM assinaturas_usuarios WHERE id = $1',
                    [assinaturaUsuarioId]
                );
                assinaturaUsuario = res.rows[0];
            }
            if (!assinaturaUsuario) {
                const res = await pool.query(`
                    SELECT * FROM assinaturas_usuarios 
                    WHERE usuario_id = $1 AND status = 'ativa'
                    LIMIT 1
                `, [usuarioId]);
                assinaturaUsuario = res.rows[0];
            }
            
            // Se não tem assinatura, retornar serviços como estão
            if (!assinaturaUsuario || !assinaturaUsuario.plano_id) {
                return servicos.map(s => ({
                    ...s,
                    valor_original: parseFloat(s.valor_servico) || 0,
                    valor_final: parseFloat(s.valor_servico) || 0,
                    coberto: false
                }));
            }
            
            // Calcular dia da semana
            let dbDay = null;
            if (dataAgendada) {
                const d = new Date(dataAgendada);
                const jsDay = d.getDay();
                dbDay = jsDay === 0 ? 7 : jsDay;
            }
            
            // Buscar serviços cobertos em UMA query
            const planoResult = await pool.query(`
                SELECT DISTINCT ass.servico_id
                FROM assinatura_servico ass
                WHERE ass.assinatura_id = $1
            `, [assinaturaUsuario.plano_id]);
            
            const servicosCobertos = new Set(planoResult.rows.map(r => r.servico_id));
            
            // Buscar dias da semana cobertos
            let diasCobertos = [];
            if (dbDay) {
                const diasResult = await pool.query(`
                    SELECT dia_semana FROM assinatura_dias_semana 
                    WHERE assinatura_id = $1
                `, [assinaturaUsuario.plano_id]);
                diasCobertos = diasResult.rows.map(r => r.dia_semana);
            }
            
            // Enriquecer serviços
            return servicos.map(s => {
                const valorOriginal = parseFloat(s.valor_servico) || 0;
                const coberto = servicosCobertos.has(s.id) && diasCobertos.includes(dbDay);
                const valorFinal = coberto ? 0 : valorOriginal;
                
                return {
                    ...s,
                    valor_original: valorOriginal,
                    valor_final: valorFinal,
                    coberto
                };
            });
        } catch (error) {
            console.error('Erro ao aplicar descontos:', error);
            return servicos.map(s => ({
                ...s,
                valor_original: parseFloat(s.valor_servico) || 0,
                valor_final: parseFloat(s.valor_servico) || 0,
                coberto: false
            }));
        }
    }

    // NOVO: Método para buscar barbeiros para filtro
    async getBarbeirosParaFiltro() {
        try {
            const query = `
                SELECT id, nome 
                FROM usuarios 
                WHERE role = 'barbeiro'
                ORDER BY nome ASC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar barbeiros para filtro:', error);
            throw error;
        }
    }
}

module.exports = new AdminAgendamentoService();