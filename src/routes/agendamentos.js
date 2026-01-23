// src/routes/agendamentos.js
const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const { authenticateToken } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// POST /agendamentos - Criar novo agendamento (COM MÚLTIPLOS SERVIÇOS)
router.post('/', agendamentoController.create);

// GET /agendamentos/horarios-disponiveis - Buscar horários disponíveis
router.get('/horarios-disponiveis', agendamentoController.getHorariosDisponiveis);

// GET /agendamentos/meus - Buscar agendamentos do usuário (COM MÚLTIPLOS SERVIÇOS)
router.get('/meus', agendamentoController.getByUsuario);

// NOVAS ROTAS ADICIONADAS:
// GET /agendamentos/:id - Buscar detalhes de um agendamento específico
router.get('/:id', agendamentoController.getById);

// PUT /agendamentos/:id/cancel - Cancelar um agendamento
router.put('/:id/cancel', agendamentoController.cancel);

module.exports = router;