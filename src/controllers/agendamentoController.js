// src/controllers/agendamentoController.js
const agendamentoService = require('../services/agendamentoService');
const servicoService = require('../services/servicoService');

class AgendamentoController {
    // Criar novo agendamento
    async create(req, res) {
        try {
            const userId = req.user.id;
            const { barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes } = req.body;
            
            // Validações
            if (!servico_id || !data_agendada || !hora_inicio || !hora_fim) {
                return res.status(400).json({
                    success: false,
                    message: 'Serviço, data e horário são obrigatórios'
                });
            }
            
            // Verificar se o serviço existe
            const servico = await servicoService.getServicoById(servico_id);
            if (!servico) {
                return res.status(404).json({
                    success: false,
                    message: 'Serviço não encontrado'
                });
            }
            
            // Se barbeiro_id for fornecido, verificar se existe
            if (barbeiro_id) {
                // Verificar se o barbeiro existe (você pode adicionar esta verificação)
                // Para simplificar, vamos assumir que o ID é válido
            }
            
            // Criar agendamento
            const agendamentoData = {
                usuario_id: userId,
                barbeiro_id: barbeiro_id || null, // null = sem preferência
                servico_id,
                data_agendada,
                hora_inicio,
                hora_fim,
                observacoes
            };
            
            const novoAgendamento = await agendamentoService.createAgendamento(agendamentoData);
            
            res.status(201).json({
                success: true,
                message: 'Agendamento realizado com sucesso',
                agendamento: novoAgendamento
            });
        } catch (error) {
            console.error('Erro ao criar agendamento:', error);
            
            // Verificar se é erro de horário conflitante
            if (error.message && error.message.includes('conflito') || error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    message: 'Este horário já está ocupado. Por favor, escolha outro horário.'
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Buscar horários disponíveis
    async getHorariosDisponiveis(req, res) {
        try {
            const { data, duracao, barbeiro_id } = req.query;
            
            if (!data || !duracao) {
                return res.status(400).json({
                    success: false,
                    message: 'Data e duração são obrigatórios'
                });
            }
            
            const horarios = await agendamentoService.getHorariosDisponiveis(data, duracao, barbeiro_id);
            
            res.json(horarios);
        } catch (error) {
            console.error('Erro ao buscar horários disponíveis:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Buscar agendamentos do usuário
    async getByUsuario(req, res) {
        try {
            const userId = req.user.id;
            const agendamentos = await agendamentoService.getAgendamentosByUsuario(userId);
            
            res.json({
                success: true,
                agendamentos
            });
        } catch (error) {
            console.error('Erro ao buscar agendamentos:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new AgendamentoController();