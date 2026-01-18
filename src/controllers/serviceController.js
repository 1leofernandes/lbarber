// Controller de serviços
const Service = require('../models/Service');

class ServiceController {
  static async getAllServices(req, res, next) {
    try {
      const services = await Service.getAllServices();
      res.json({
        success: true,
        servicos: services
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ServiceController;
