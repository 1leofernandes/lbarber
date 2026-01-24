const BarbeiroService = require('../../services/admin/barbeiroService');

class AdminBarbeiroController {
    async getAll(req, res) {
        try {
            const { ativos_only = 'true' } = req.query;
            const ativosOnly = ativos_only === 'true';
            
            const barbeiros = await BarbeiroService.getAllBarbeiros(ativosOnly);
            
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

    async getById(req, res) {
        try {
            const { id } = req.params;
            const barbeiro = await BarbeiroService.getBarbeiroById(id);
            
            res.json({
                success: true,
                data: barbeiro
            });
        } catch (error) {
            console.error('Erro ao buscar barbeiro:', error);
            if (error.message === 'Barbeiro não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar barbeiro'
            });
        }
    }

    async create(req, res) {
        try {
            const barbeiroData = req.body;
            
            // Validações básicas
            if (!barbeiroData.nome || !barbeiroData.email || !barbeiroData.senha) {
                return res.status(400).json({
                    success: false,
                    message: 'Nome, email e senha são obrigatórios'
                });
            }
            
            const barbeiro = await BarbeiroService.createBarbeiro(barbeiroData);
            
            // Não retornar a senha
            delete barbeiro.senha;
            
            res.status(201).json({
                success: true,
                data: barbeiro,
                message: 'Barbeiro criado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao criar barbeiro:', error);
            
            // Tratar erros específicos
            if (error.message.includes('Email já cadastrado')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            if (error.message.includes('deve ter pelo menos') || 
                error.message.includes('inválido') ||
                error.message.includes('Formato')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao criar barbeiro'
            });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const barbeiroData = req.body;
            
            // Não permitir alteração do ID
            if (barbeiroData.id && barbeiroData.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Não é possível alterar o ID do barbeiro'
                });
            }
            
            const barbeiro = await BarbeiroService.updateBarbeiro(id, barbeiroData);
            
            // Não retornar a senha
            delete barbeiro.senha;
            
            res.json({
                success: true,
                data: barbeiro,
                message: 'Barbeiro atualizado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao atualizar barbeiro:', error);
            
            if (error.message === 'Barbeiro não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            
            if (error.message.includes('Email já cadastrado') ||
                error.message.includes('inválido') ||
                error.message.includes('Formato') ||
                error.message.includes('deve ter pelo menos')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao atualizar barbeiro'
            });
        }
    }

    async promoverUsuario(req, res) {
        try {
            const { usuario_id } = req.body;
            const { especialidades } = req.body;
            
            if (!usuario_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do usuário é obrigatório'
                });
            }
            
            const barbeiro = await BarbeiroService.promoverParaBarbeiro(usuario_id, especialidades);
            
            res.json({
                success: true,
                data: barbeiro,
                message: 'Usuário promovido a barbeiro com sucesso'
            });
        } catch (error) {
            console.error('Erro ao promover usuário para barbeiro:', error);
            
            if (error.message === 'Usuário não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            
            if (error.message === 'Usuário já é barbeiro') {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao promover usuário para barbeiro'
            });
        }
    }

    async rebaixarBarbeiro(req, res) {
        try {
            const { id } = req.params;
            
            const resultado = await BarbeiroService.rebaixarParaCliente(id);
            
            res.json({
                success: true,
                data: resultado,
                message: 'Barbeiro rebaixado a cliente com sucesso'
            });
        } catch (error) {
            console.error('Erro ao rebaixar barbeiro para cliente:', error);
            
            if (error.message === 'Barbeiro não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            
            if (error.message.includes('Não é possível rebaixar barbeiro com agendamentos futuros')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao rebaixar barbeiro para cliente'
            });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            
            await BarbeiroService.deleteBarbeiro(id);
            
            res.json({
                success: true,
                message: 'Barbeiro excluído com sucesso'
            });
        } catch (error) {
            console.error('Erro ao excluir barbeiro:', error);
            
            if (error.message === 'Barbeiro não encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            
            if (error.message.includes('Não é possível excluir barbeiro com agendamentos futuros')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(400).json({
                success: false,
                message: error.message || 'Erro ao excluir barbeiro'
            });
        }
    }

    async getClientesParaPromover(req, res) {
        try {
            const clientes = await BarbeiroService.getClientesParaPromover();
            
            res.json({
                success: true,
                data: clientes
            });
        } catch (error) {
            console.error('Erro ao buscar clientes para promover:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar clientes para promover'
            });
        }
    }

    async getEstatisticas(req, res) {
        try {
            const { id } = req.params;
            
            const estatisticas = await BarbeiroService.getEstatisticasBarbeiro(id);
            
            res.json({
                success: true,
                data: estatisticas
            });
        } catch (error) {
            console.error('Erro ao buscar estatísticas do barbeiro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar estatísticas do barbeiro'
            });
        }
    }
}

module.exports = new AdminBarbeiroController();