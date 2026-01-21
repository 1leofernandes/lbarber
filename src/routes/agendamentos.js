// src/routes/agendamentos.js
const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const { authenticateToken } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// POST /agendamentos - Criar novo agendamento
router.post('/', agendamentoController.create);

// GET /agendamentos/horarios-disponiveis - Buscar horários disponíveis
router.get('/horarios-disponiveis', agendamentoController.getHorariosDisponiveis);

// GET /agendamentos/meus - Buscar agendamentos do usuário
router.get('/meus', agendamentoController.getByUsuario);

module.exports = router;