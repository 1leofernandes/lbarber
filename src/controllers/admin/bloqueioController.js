const BloqueioService = require('../../services/admin/bloqueioService');

class BloqueioController {
    // Listar todos os bloqueios
    async getAll(req, res) {
        try {
            const { barbeiro_id, ativo, tipo, data_inicio, data_fim } = req.query;
            const filters = {};
            
            if (barbeiro_id) filters.barbeiro_id = barbeiro_id;
            if (ativo !== undefined) filters.ativo = ativo === 'true';
            if (tipo) filters.tipo = tipo;
            if (data_inicio) filters.data_inicio = data_inicio;
            if (data_fim) filters.data_fim = data_fim;
            
            const bloqueios = await BloqueioService.getAllBloqueios(filters);
            
            res.json({
                success: true,
                data: bloqueios
            });
        } catch (error) {
            console.error('Erro ao buscar bloqueios:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar bloqueios'
            });
        }
    }

    // Buscar bloqueio por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            const bloqueio = await BloqueioService.getBloqueioById(id);
            
            res.json({
                success: true,
                data: bloqueio
            });
        } catch (error) {
            console.error('Erro ao buscar bloqueio:', error);
            res.status(404).json({
                success: false,
                message: error.message || 'Bloqueio não encontrado'
            });
        }
    }

    // Criar novo bloqueio
    async create(req, res) {
        try {
            const bloqueioData = req.body;
            
            // Adicionar ativo por padrão
            if (bloqueioData.ativo === undefined) {
                bloqueioData.ativo = true;
            }
            
            const bloqueio = await BloqueioService.createBloqueio(bloqueioData);
            
            res.status(201).json({
                success: true,
                data: bloqueio,
                message: 'Bloqueio criado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao criar bloqueio:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao criar bloqueio'
            });
        }
    }

    // Atualizar bloqueio
    async update(req, res) {
        try {
            const { id } = req.params;
            const bloqueioData = req.body;
            
            const bloqueio = await BloqueioService.updateBloqueio(id, bloqueioData);
            
            res.json({
                success: true,
                data: bloqueio,
                message: 'Bloqueio atualizado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao atualizar bloqueio:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao atualizar bloqueio'
            });
        }
    }

    // Excluir bloqueio
    async delete(req, res) {
        try {
            const { id } = req.params;
            await BloqueioService.deleteBloqueio(id);
            
            res.json({
                success: true,
                message: 'Bloqueio excluído com sucesso'
            });
        } catch (error) {
            console.error('Erro ao excluir bloqueio:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao excluir bloqueio'
            });
        }
    }

    // Desativar/ativar bloqueio
    async toggleStatus(req, res) {
        try {
            const { id } = req.params;
            const { ativo } = req.body;
            
            const bloqueio = await BloqueioService.updateBloqueio(id, { ativo });
            
            res.json({
                success: true,
                data: bloqueio,
                message: `Bloqueio ${ativo ? 'ativado' : 'desativado'} com sucesso`
            });
        } catch (error) {
            console.error('Erro ao alterar status do bloqueio:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao alterar status do bloqueio'
            });
        }
    }

    // Verificar disponibilidade (para agendamentos)
    async verificarDisponibilidade(req, res) {
        try {
            const { barbeiro_id, data, hora_inicio, hora_fim } = req.query;
            
            if (!barbeiro_id || !data) {
                return res.status(400).json({
                    success: false,
                    message: 'Barbeiro ID e data são obrigatórios'
                });
            }
            
            const disponivel = await BloqueioService.verificarDisponibilidade(
                barbeiro_id,
                data,
                hora_inicio,
                hora_fim
            );
            
            res.json({
                success: true,
                data: { disponivel }
            });
        } catch (error) {
            console.error('Erro ao verificar disponibilidade:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao verificar disponibilidade'
            });
        }
    }
}

module.exports = new BloqueioController();