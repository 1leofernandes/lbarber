// src/services/admin/agendamentoService.js
const Appointment = require('../../models/Appointment');
const User = require('../../models/User');
const Service = require('../../models/Service');
const Barber = require('../../models/Barber');
const Block = require('../../models/Block');

class AdminAgendamentoService {
    async getAllAgendamentos(filters = {}, limit = 100, offset = 0) {
        try {
            return await Appointment.findAll(filters, limit, offset);
        } catch (error) {
            console.error('Erro ao buscar agendamentos:', error);
            throw error;
        }
    }

    async getAgendamentoById(id) {
        try {
            const agendamento = await Appointment.findByIdWithServices(id);
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
            // Horários padrão da barbearia
            const horariosDisponiveis = [];
            const inicioExpediente = 8; // 8:00
            const fimExpediente = 19; // 19:00
            const intervalo = 30; // 30 minutos
            
            // Buscar agendamentos existentes
            const agendamentos = await Appointment.getUnavailableHours(barbeiro_id, data);
            const horariosOcupados = agendamentos;
            
            // Buscar bloqueios
            const bloqueios = await Block.findAll({
                id_barbeiro: barbeiro_id,
                data: data
            });
            
            // Gerar todos os horários possíveis
            for (let hora = inicioExpediente; hora < fimExpediente; hora++) {
                for (let minuto = 0; minuto < 60; minuto += intervalo) {
                    const horaFormatada = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
                    
                    // Verificar se não está ocupado
                    if (!horariosOcupados.includes(horaFormatada)) {
                        // Verificar se não está em um bloqueio
                        const estaBloqueado = bloqueios.some(bloqueio => {
                            if (bloqueio.tipo === 'dia') return true;
                            
                            const horaBloqueioInicio = parseInt(bloqueio.hora_inicio?.split(':')[0] || 0);
                            const minutoBloqueioInicio = parseInt(bloqueio.hora_inicio?.split(':')[1] || 0);
                            const horaBloqueioFim = parseInt(bloqueio.hora_fim?.split(':')[0] || 23);
                            const minutoBloqueioFim = parseInt(bloqueio.hora_fim?.split(':')[1] || 59);
                            
                            const horaAtual = hora * 60 + minuto;
                            const inicioBloqueio = horaBloqueioInicio * 60 + minutoBloqueioInicio;
                            const fimBloqueio = horaBloqueioFim * 60 + minutoBloqueioFim;
                            
                            return horaAtual >= inicioBloqueio && horaAtual < fimBloqueio;
                        });
                        
                        if (!estaBloqueado) {
                            horariosDisponiveis.push(horaFormatada);
                        }
                    }
                }
            }
            
            return horariosDisponiveis;
        } catch (error) {
            console.error('Erro ao buscar horários disponíveis:', error);
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
                            COALESCE(
                                (SELECT SUM(s.valor_servico) 
                                 FROM agendamento_servicos ags 
                                 JOIN servicos s ON ags.servico_id = s.id 
                                 WHERE ags.agendamento_id = a.id),
                                s.valor_servico
                            )
                        ), 
                    0) as receita
                FROM agendamentos a
                LEFT JOIN servicos s ON a.servico_id = s.id
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

    // NOVO: Método para buscar barbeiros para filtro
    async getBarbeirosParaFiltro() {
        try {
            const query = `
                SELECT id, nome 
                FROM usuarios 
                WHERE role = 'barbeiro' OR 'barbeiro' = ANY(roles)
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