const ServicoService = require('../../services/admin/servicoService');

class ServicoController {
    // Listar todos os serviços
    async getAll(req, res) {
        try {
            const { ativos } = req.query;
            // Por padrão, mostrar apenas serviços ativos se não especificado
            const ativosOnly = ativos !== 'false';
            
            const servicos = await ServicoService.getAllServicos(ativosOnly);
            
            res.json({
                success: true,
                data: servicos
            });
        } catch (error) {
            console.error('Erro ao buscar serviços:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar serviços'
            });
        }
    }

    // Buscar serviço por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            const servico = await ServicoService.getServicoById(id);
            
            res.json({
                success: true,
                data: servico
            });
        } catch (error) {
            console.error('Erro ao buscar serviço:', error);
            if (error.message === 'Serviço não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar serviço'
            });
        }
    }

    // Criar novo serviço
    async create(req, res) {
        try {
            const servicoData = req.body;
            const servico = await ServicoService.createServico(servicoData);
            
            res.status(201).json({
                success: true,
                data: servico,
                message: 'Serviço criado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao criar serviço:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao criar serviço'
            });
        }
    }

    // Atualizar serviço
    async update(req, res) {
        try {
            const { id } = req.params;
            const servicoData = req.body;
            
            const servico = await ServicoService.updateServico(id, servicoData);
            
            res.json({
                success: true,
                data: servico,
                message: 'Serviço atualizado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao atualizar serviço:', error);
            if (error.message === 'Serviço não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao atualizar serviço'
            });
        }
    }

    // Excluir serviço
    async delete(req, res) {
        try {
            const { id } = req.params;
            await ServicoService.deleteServico(id);
            
            res.json({
                success: true,
                message: 'Serviço excluído com sucesso'
            });
        } catch (error) {
            console.error('Erro ao excluir serviço:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao excluir serviço'
            });
        }
    }

    // Atualizar status (ativo/inativo)
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { ativo } = req.body;
            
            const servico = await ServicoService.atualizarStatus(id, ativo);
            
            res.json({
                success: true,
                data: servico,
                message: `Serviço ${ativo ? 'ativado' : 'desativado'} com sucesso`
            });
        } catch (error) {
            console.error('Erro ao atualizar status do serviço:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao atualizar status do serviço'
            });
        }
    }

    // Estatísticas dos serviços
    async getEstatisticas(req, res) {
        try {
            const estatisticas = await ServicoService.getEstatisticasServicos();
            
            res.json({
                success: true,
                data: estatisticas
            });
        } catch (error) {
            console.error('Erro ao buscar estatísticas dos serviços:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar estatísticas dos serviços'
            });
        }
    }
}

module.exports = new ServicoController();