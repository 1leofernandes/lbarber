const agendamentoService = require('../../services/admin/agendamentoService');

class AgendamentoController {
    async getAll(req, res) {
        try {
            const { limit = 100, offset = 0, ...filters } = req.query;
            const agendamentos = await agendamentoService.getAllAgendamentos(
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
            const agendamento = await agendamentoService.getAgendamentoById(id);
            
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
            const agendamento = await agendamentoService.createAgendamento(req.body);
            
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
            const agendamento = await agendamentoService.updateAgendamento(id, req.body);
            
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
            
            const agendamento = await agendamentoService.updateStatus(id, status);
            
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
            await agendamentoService.deleteAgendamento(id);
            
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
            const { barbeiro_id, data } = req.query;
            
            if (!barbeiro_id || !data) {
                return res.status(400).json({
                    success: false,
                    message: 'Barbeiro ID e data são obrigatórios'
                });
            }
            
            const horarios = await agendamentoService.getHorariosDisponiveis(barbeiro_id, data);
            
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
            
            const resumo = await agendamentoService.getResumoAgendamentos(data_inicio, data_fim);
            
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
}

module.exports = new AgendamentoController();