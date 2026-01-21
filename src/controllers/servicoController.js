// src/controllers/servicoController.js
const servicoService = require('../services/servicoService');

class ServicoController {
    // Buscar todos os serviços
    async getAll(req, res) {
        try {
            const servicos = await servicoService.getAllServicos();
            
            res.json(servicos);
        } catch (error) {
            console.error('Erro ao buscar serviços:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Buscar serviço por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            const servico = await servicoService.getServicoById(id);
            
            if (!servico) {
                return res.status(404).json({
                    success: false,
                    message: 'Serviço não encontrado'
                });
            }
            
            res.json({
                success: true,
                servico
            });
        } catch (error) {
            console.error('Erro ao buscar serviço:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new ServicoController();