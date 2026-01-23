const express = require('express');
const router = express.Router();
const AdminAgendamentoController = require('../../controllers/admin/agendamentoController');

// GET /admin/agendamentos - Listar todos os agendamentos
router.get('/', AdminAgendamentoController.getAll);

// GET /admin/agendamentos/:id - Buscar agendamento por ID
router.get('/:id', AdminAgendamentoController.getById);

// POST /admin/agendamentos - Criar novo agendamento
router.post('/', AdminAgendamentoController.create);

// PUT /admin/agendamentos/:id - Atualizar agendamento
router.put('/:id', AdminAgendamentoController.update);
// PUT /admin/agendamentos/:id/status - Atualizar status do agendamento
router.put('/:id/status', AdminAgendamentoController.updateStatus);

// DELETE /admin/agendamentos/:id - Excluir agendamento
router.delete('/:id', AdminAgendamentoController.delete);

// GET /admin/agendamentos/horarios-disponiveis - Buscar horários disponíveis
router.get('/horarios-disponiveis', AdminAgendamentoController.getHorariosDisponiveis);

// GET /admin/agendamentos/resumo - Resumo de agendamentos
router.get('/resumo', AdminAgendamentoController.getResumo);

module.exports = router;