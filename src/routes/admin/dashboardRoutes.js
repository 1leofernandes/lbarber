const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboardController');

// GET /admin/dashboard/resumo-geral - Resumo geral para a dashboard
router.get('/resumo-geral', dashboardController.getResumoGeral);

// GET /admin/dashboard/resumo-hoje - Resumo do dia atual
router.get('/resumo-hoje', dashboardController.getResumoHoje);

// GET /admin/dashboard/resumo - Resumo financeiro (mantido para compatibilidade)
router.get('/resumo', dashboardController.getResumoFinanceiro);

// GET /admin/dashboard/grafico-receita - Gráfico de receita
router.get('/grafico-receita', dashboardController.getGraficoReceita);

// GET /admin/dashboard/top-servicos - Top serviços
router.get('/top-servicos', dashboardController.getTopServicos);

// GET /admin/dashboard/metricas-barbeiros - Métricas dos barbeiros
router.get('/metricas-barbeiros', dashboardController.getMetricasBarbeiros);

module.exports = router;