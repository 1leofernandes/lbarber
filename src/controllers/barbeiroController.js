// src/controllers/barbeiroController.js
const User = require('../models/User');
const { validateRequired, validators } = require('../utils/validation');
const logger = require('../utils/logger');
const barbeiroService = require('../services/barbeiroService');

class BarbeiroController {
  async getAll(req, res) {
    try {
        const barbeiros = await barbeiroService.getAllBarbeiros();
        
        res.json(barbeiros);
    } catch (error) {
        console.error('Erro ao buscar barbeiros:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
  }

  async getById(req, res) {
    try {
        const { id } = req.params;
        const barbeiro = await barbeiroService.getBarbeiroById(id);
        
        if (!barbeiro) {
            return res.status(404).json({
                success: false,
                message: 'Barbeiro não encontrado'
            });
        }
        
        res.json({
            success: true,
            barbeiro
        });
    } catch (error) {
        console.error('Erro ao buscar barbeiro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
  }

  async deleteBarbeiro(req, res) {
    try {
      const { id } = req.params;

      if (!validators.id(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
      }

      const result = await User.deleteBarbeiro(id);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Barbeiro não encontrado'
        });
      }

      logger.info('Barbeiro deletado', { barbeiro_id: id });

      res.json({
        success: true,
        message: 'Barbeiro deletado com sucesso'
      });
    } catch (err) {
      console.error('Erro ao deletar barbeiro:', err);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

// Exporte uma INSTÂNCIA da classe, não a classe em si
module.exports = new BarbeiroController();