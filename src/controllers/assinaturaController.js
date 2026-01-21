// src/controllers/assinaturaController.js
const assinaturaService = require('../services/assinaturaService');

class AssinaturaController {
    // Buscar assinatura por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            const assinatura = await assinaturaService.getAssinaturaById(id);
            
            if (!assinatura) {
                return res.status(404).json({
                    success: false,
                    message: 'Assinatura não encontrada'
                });
            }
            
            res.json({
                success: true,
                assinatura
            });
        } catch (error) {
            console.error('Erro ao buscar assinatura:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Buscar todas as assinaturas
    async getAll(req, res) {
        try {
            const assinaturas = await assinaturaService.getAllAssinaturas();
            
            res.json({
                success: true,
                assinaturas
            });
        } catch (error) {
            console.error('Erro ao buscar assinaturas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new AssinaturaController();