// src/routes/admin/index.js
const express = require('express');
const router = express.Router();

// Importar todas as rotas de admin
const dashboardRoutes = require('./dashboardRoutes');
const agendamentoRoutes = require('./agendamentoRoutes');
const bloqueioRoutes = require('./bloqueioRoutes');
const servicoRoutes = require('./servicoRoutes');
const barbeiroRoutes = require('./barbeiroRoutes');
const subscriptionRecurrentRoutes = require('./subscriptionRecurrentRoutes');
// const assinaturaRoutes = require('./assinaturaRoutes');
// const planoRoutes = require('./planoRoutes');
// const pagamentoRoutes = require('./pagamentoRoutes');
// const infoRoutes = require('./infoRoutes');

// Importar middlewares
const { authenticateToken } = require('../../middlewares/auth');
const adminMiddleware = require('../../middlewares/adminMiddleware');

router.use(authenticateToken);


router.use('/agendamentos', agendamentoRoutes);
router.use('/bloqueios', bloqueioRoutes);
router.use('/servicos', servicoRoutes);
router.use('/barbeiros', barbeiroRoutes);


// Aplicar middleware de autenticação e admin em TODAS as rotas admin
router.use(adminMiddleware);

// Montar rotas
router.use('/dashboard', dashboardRoutes);
router.use('/assinaturas-recorrentes', subscriptionRecurrentRoutes);
// router.use('/assinaturas', assinaturaRoutes);
// router.use('/planos', planoRoutes);
// router.use('/pagamentos', pagamentoRoutes);
// router.use('/informacoes', infoRoutes);

// Rota de teste
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Rota admin funcionando',
        user: req.user
    });
});

module.exports = router;