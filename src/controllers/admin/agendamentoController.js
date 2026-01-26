const AdminAgendamentoService = require('../../services/admin/agendamentoService');

class AdminAgendamentoController {
    async getAll(req, res) {
        try {
            const { limit = 100, offset = 0, ...filters } = req.query;
            const agendamentos = await AdminAgendamentoService.getAllAgendamentos(
                filters, 
                parseInt(limit), 
                parseInt(offset)
            );
            
            res.json({
                success: true,
                data: agendamentos
            });
        } catch (error) {
            console.error('Erro ao buscar agendamentos:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar agendamentos'
            });
        }
    }

    async getById(req, res) {
        try {
            const { id } = req.params;
            const agendamento = await AdminAgendamentoService.getAgendamentoById(id);
            
            res.json({
                success: true,
                data: agendamento
            });
        } catch (error) {
            console.error('Erro ao buscar agendamento:', error);
            if (error.message === 'Agendamento não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar agendamento'
            });
        }
    }

    async create(req, res) {
        try {
            // Extrair dados do corpo da requisição
            const { servicos_ids, servico_id, ...agendamentoData } = req.body;
            
            // Determinar quais serviços usar (preferência para o novo formato com array)
            const servicosParaAgendar = servicos_ids || (servico_id ? [servico_id] : []);
            
            // Verificar se há serviços selecionados
            if (!servicosParaAgendar || servicosParaAgendar.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Pelo menos um serviço deve ser selecionado'
                });
            }
            
            // Adicionar os serviços aos dados do agendamento
            const dadosComServicos = {
                ...agendamentoData,
                servicos_ids: servicosParaAgendar
            };
            
            const agendamento = await AdminAgendamentoService.createAgendamento(dadosComServicos);
            
            res.status(201).json({
                success: true,
                data: agendamento,
                message: 'Agendamento criado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao criar agendamento:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao criar agendamento'
            });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            
            // Extrair dados do corpo da requisição
            const { servicos_ids, servico_id, ...agendamentoData } = req.body;
            
            // Determinar quais serviços usar
            let servicosParaAtualizar = null;
            
            if (servicos_ids !== undefined) {
                // Se servicos_ids foi enviado explicitamente (pode ser array vazio)
                servicosParaAtualizar = servicos_ids;
            } else if (servico_id !== undefined) {
                // Se servico_id foi enviado (backward compatibility)
                servicosParaAtualizar = servico_id ? [servico_id] : [];
            }
            
            // Preparar dados para atualização
            const dadosAtualizacao = { ...agendamentoData };
            if (servicosParaAtualizar !== null) {
                dadosAtualizacao.servicos_ids = servicosParaAtualizar;
            }
            
            const agendamento = await AdminAgendamentoService.updateAgendamento(id, dadosAtualizacao);
            
            res.json({
                success: true,
                data: agendamento,
                message: 'Agendamento atualizado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao atualizar agendamento:', error);
            if (error.message === 'Agendamento não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao atualizar agendamento'
            });
        }
    }

    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            const agendamento = await AdminAgendamentoService.updateStatus(id, status);
            
            res.json({
                success: true,
                data: agendamento,
                message: 'Status do agendamento atualizado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao atualizar status do agendamento:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao atualizar status do agendamento'
            });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            await AdminAgendamentoService.deleteAgendamento(id);
            
            res.json({
                success: true,
                message: 'Agendamento excluído com sucesso'
            });
        } catch (error) {
            console.error('Erro ao excluir agendamento:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao excluir agendamento'
            });
        }
    }

    async getHorariosDisponiveis(req, res) {
        try {
            const { barbeiro_id, data, servicos_ids, servico_id } = req.query;
            
            if (!barbeiro_id || !data) {
                return res.status(400).json({
                    success: false,
                    message: 'Barbeiro ID e data são obrigatórios'
                });
            }
            
            // Determinar quais serviços usar para calcular duração
            let servicosParaConsulta = [];
            if (servicos_ids) {
                servicosParaConsulta = Array.isArray(servicos_ids) ? servicos_ids : [servicos_ids];
            } else if (servico_id) {
                servicosParaConsulta = [servico_id];
            }
            
            const horarios = await AdminAgendamentoService.getHorariosDisponiveis(
                barbeiro_id, 
                data,
                servicosParaConsulta
            );
            
            res.json({
                success: true,
                data: horarios
            });
        } catch (error) {
            console.error('Erro ao buscar horários disponíveis:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar horários disponíveis'
            });
        }
    }

    async getResumo(req, res) {
        try {
            const { data_inicio, data_fim } = req.query;
            
            if (!data_inicio || !data_fim) {
                return res.status(400).json({
                    success: false,
                    message: 'Data início e data fim são obrigatórios'
                });
            }
            
            const resumo = await AdminAgendamentoService.getResumoAgendamentos(data_inicio, data_fim);
            
            res.json({
                success: true,
                data: resumo
            });
        } catch (error) {
            console.error('Erro ao buscar resumo de agendamentos:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar resumo de agendamentos'
            });
        }
    }

    // NOVO: Método para buscar barbeiros
    async getBarbeiros(req, res) {
        try {
            const barbeiros = await AdminAgendamentoService.getBarbeirosParaFiltro();
            
            res.json({
                success: true,
                data: barbeiros
            });
        } catch (error) {
            console.error('Erro ao buscar barbeiros:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar barbeiros'
            });
        }
    }

    // NO controllers/admin/agendamentoController.js - ADICIONE ESTE MÉTODO
    async getFiltrosDebug(req, res) {
        try {
            console.log('Query params recebidos:', req.query);
            console.log('Headers recebidos:', req.headers);
            
            const { limit = 100, offset = 0, ...filters } = req.query;
            
            // Log detalhado dos filtros
            Object.keys(filters).forEach(key => {
                console.log(`Filtro ${key}:`, filters[key], 'Tipo:', typeof filters[key]);
            });
            
            const agendamentos = await AdminAgendamentoService.getAllAgendamentos(
                filters, 
                parseInt(limit), 
                parseInt(offset)
            );
            
            res.json({
                success: true,
                data: {
                    filtros_recebidos: filters,
                    total_agendamentos: agendamentos.length,
                    agendamentos: agendamentos
                }
            });
        } catch (error) {
            console.error('Erro no debug de filtros:', error);
            res.status(500).json({
                success: false,
                message: 'Erro no debug de filtros',
                error: error.message
            });
        }
    }
}

module.exports = new AdminAgendamentoController();