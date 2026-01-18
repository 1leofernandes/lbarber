// Controller de barbeiros
const User = require('../models/User');
const { validateRequired, validators } = require('../utils/validation');
const logger = require('../utils/logger');

class BarberController {
  static async getAllBarbeiros(req, res, next) {
    try {
      const barbeiros = await User.getAllBarbeiros();
      res.json({
        success: true,
        barbeiros
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteBarbeiro(req, res, next) {
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
      next(err);
    }
  }
}

module.exports = BarberController;
