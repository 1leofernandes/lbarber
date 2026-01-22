const adminService = require('../../services/admin/adminService');

class AdminController {
    async getDashboardStats(req, res) {
        try {
            const stats = await adminService.getDashboardStats();
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Erro ao buscar estatísticas do dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar estatísticas do dashboard'
            });
        }
    }

    async getPainelInicial(req, res) {
        try {
            const dados = await adminService.getPainelInicial();
            
            res.json({
                success: true,
                data: dados
            });
        } catch (error) {
            console.error('Erro ao buscar dados do painel inicial:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar dados do painel inicial'
            });
        }
    }
}

module.exports = new AdminController(); const Config = require('../../models/Config');