// src/controllers/servicoController.js
const servicoService = require('../services/servicoService');

class ServicoController {
    // Buscar todos os serviços
    async getAll(req, res) {
        try {
            // ⚠️ OTIMIZAÇÃO: Cachear listagem de serviços por 2h
            const cache = require('../utils/cache');
            const cacheKey = 'servicos:list:all';
            
            // Verificar cache
            let servicos = await cache.get(cacheKey);
            if (servicos) {
                return res.json(servicos);
            }
            
            // Se não tem em cache, buscar do DB
            servicos = await servicoService.getAllServicos();
            
            // Guardar em cache por 2 horas
            await cache.set(cacheKey, servicos, 2 * 60 * 60);
            
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


    // ADICIONE ESTE MÉTODO no final da classe
    async clearCache(req, res) {
        try {
            const cache = require('../utils/cache');
            await cache.del('servicos:list:all');
            
            console.log('🗑️ Cache limpo via endpoint');
            
            res.json({
                success: true,
                message: 'Cache de serviços limpo! Recarregue a página.'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ServicoController();