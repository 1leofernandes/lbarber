const express = require('express');
const router = express.Router();
const agendamentoController = require('../../controllers/admin/agendamentoController');

// GET /admin/agendamentos - Listar todos os agendamentos
router.get('/', agendamentoController.getAll);

// GET /admin/agendamentos/:id - Buscar agendamento por ID
router.get('/:id', agendamentoController.getById);

// POST /admin/agendamentos - Criar novo agendamento
router.post('/', agendamentoController.create);

// PUT /admin/agendamentos/:id - Atualizar agendamento
router.put('/:id', agendamentoController.update);

// PUT /admin/agendamentos/:id/status - Atualizar status do agendamento
router.put('/:id/status', agendamentoController.updateStatus);

// DELETE /admin/agendamentos/:id - Excluir agendamento
router.delete('/:id', agendamentoController.delete);

// GET /admin/agendamentos/horarios-disponiveis - Buscar horários disponíveis
router.get('/horarios-disponiveis', agendamentoController.getHorariosDisponiveis);

// GET /admin/agendamentos/resumo - Resumo de agendamentos
router.get('/resumo', agendamentoController.getResumo);

module.exports = router;