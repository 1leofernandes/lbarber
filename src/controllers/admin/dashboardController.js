const dashboardService = require('../../services/admin/dashboardService');

class DashboardController {
    async getResumoFinanceiro(req, res) {
        try {
            const { mes, ano } = req.query;
            const mesAtual = mes ? parseInt(mes) : new Date().getMonth() + 1;
            const anoAtual = ano ? parseInt(ano) : new Date().getFullYear();
            
            const resumo = await dashboardService.getResumoFinanceiro(mesAtual, anoAtual);
            
            res.json({
                success: true,
                data: resumo
            });
        } catch (error) {
            console.error('Erro ao buscar resumo financeiro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar resumo financeiro'
            });
        }
    }

    async getGraficoReceita(req, res) {
        try {
            const { periodo = '6meses' } = req.query;
            const dados = await dashboardService.getGraficoReceita(periodo);
            
            res.json({
                success: true,
                data: dados
            });
        } catch (error) {
            console.error('Erro ao buscar gráfico de receita:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar gráfico de receita'
            });
        }
    }

    async getTopServicos(req, res) {
        try {
            const { limit = 5 } = req.query;
            const servicos = await dashboardService.getTopServicos(parseInt(limit));
            
            res.json({
                success: true,
                data: servicos
            });
        } catch (error) {
            console.error('Erro ao buscar top serviços:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar top serviços'
            });
        }
    }

    async getMetricasBarbeiros(req, res) {
        try {
            const metricas = await dashboardService.getMetricasBarbeiros();
            
            res.json({
                success: true,
                data: metricas
            });
        } catch (error) {
            console.error('Erro ao buscar métricas dos barbeiros:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao buscar métricas dos barbeiros'
            });
        }
    }
}

module.exports = new DashboardController();