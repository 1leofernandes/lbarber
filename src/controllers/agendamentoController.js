// src/controllers/agendamentoController.js
const agendamentoService = require('../services/agendamentoService');
const servicoService = require('../services/servicoService');

class AgendamentoController {
    // Criar novo agendamento (AGORA COM MÚLTIPLOS SERVIÇOS)
    async create(req, res) {
        try {
            const userId = req.user.id;
            const { barbeiro_id, servicos_ids, data_agendada, hora_inicio, hora_fim, observacoes } = req.body;
            
            // Validações - agora servicos_ids deve ser um array
            if (!servicos_ids || !Array.isArray(servicos_ids) || servicos_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Pelo menos um serviço é obrigatório (servicos_ids deve ser um array)'
                });
            }
            
            if (!data_agendada || !hora_inicio || !hora_fim) {
                return res.status(400).json({
                    success: false,
                    message: 'Data e horário são obrigatórios'
                });
            }
            
            // Verificar se todos os serviços existem
            for (const servicoId of servicos_ids) {
                const servico = await servicoService.getServicoById(servicoId);
                if (!servico) {
                    return res.status(404).json({
                        success: false,
                        message: `Serviço com ID ${servicoId} não encontrado`
                    });
                }
            }
            
            // Calcular duração total baseada nos serviços
            const servicosInfo = await Promise.all(
                servicos_ids.map(id => servicoService.getServicoById(id))
            );
            
            const duracaoTotal = servicosInfo.reduce((total, servico) => {
                return total + (servico.duracao_servico || 0);
            }, 0);
            
            // Verificar se hora_fim é consistente com a duração
            const [hora, minuto] = hora_inicio.split(':').map(Number);
            const inicio = new Date();
            inicio.setHours(hora, minuto, 0, 0);
            
            const fimCalculado = new Date(inicio.getTime() + duracaoTotal * 60000);
            const horaFimCalculada = `${String(fimCalculado.getHours()).padStart(2, '0')}:${String(fimCalculado.getMinutes()).padStart(2, '0')}`;
            
            // Se hora_fim foi fornecido, validar se é consistente
            if (hora_fim && hora_fim !== horaFimCalculada) {
                console.warn(`Hora fim fornecida (${hora_fim}) difere da calculada (${horaFimCalculada})`);
            }
            
            // Criar agendamento com múltiplos serviços
            const agendamentoData = {
                usuario_id: userId,
                barbeiro_id: barbeiro_id || null,
                servicos_ids: servicos_ids, // ARRAY de IDs de serviços
                data_agendada,
                hora_inicio,
                hora_fim: hora_fim || horaFimCalculada,
                observacoes
            };
            
            const novoAgendamento = await agendamentoService.createAgendamentoComServicos(agendamentoData);
            
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
            
            if (error.message && error.message.includes('indisponível')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Buscar horários disponíveis (MANTÉM IGUAL)
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
    
    // Buscar agendamentos do usuário (AGORA COM MÚLTIPLOS SERVIÇOS)
    async getByUsuario(req, res) {
        try {
            const userId = req.user.id;
            const agendamentos = await agendamentoService.getAgendamentosComServicosByUsuario(userId);
            
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
    
    // NOVO: Buscar detalhes de um agendamento específico
    async getById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            
            const agendamento = await agendamentoService.getAgendamentoComServicosById(id, userId);
            
            if (!agendamento) {
                return res.status(404).json({
                    success: false,
                    message: 'Agendamento não encontrado'
                });
            }
            
            res.json({
                success: true,
                agendamento
            });
        } catch (error) {
            console.error('Erro ao buscar agendamento:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // NOVO: Cancelar agendamento
    async cancel(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            
            const cancelado = await agendamentoService.cancelarAgendamento(id, userId);
            
            if (!cancelado) {
                return res.status(404).json({
                    success: false,
                    message: 'Agendamento não encontrado ou já cancelado'
                });
            }
            
            res.json({
                success: true,
                message: 'Agendamento cancelado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao cancelar agendamento:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new AgendamentoController();