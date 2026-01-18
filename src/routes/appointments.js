// Rotas de agendamentos
const express = require('express');
const router = express.Router();
const AppointmentController = require('../controllers/appointmentController');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

// GET /agendamentos/disponveis - Horários disponíveis
router.get('/disponiveis', AppointmentController.getAvailableHours);

// POST /agendamentos - Criar agendamento
router.post('/', authenticateToken, AppointmentController.createAppointment);

// GET /agendamentos - Listar agendamentos do barbeiro
router.get('/', authenticateToken, authorizeRole('barbeiro'), AppointmentController.getBarberAppointments);

// POST /agendamentos/bloqueio - Bloquear horário
router.post('/bloqueio', authenticateToken, authorizeRole('barbeiro'), AppointmentController.blockTime);

// POST /agendamentos/bloqueio-dia - Bloquear dia completo
router.post('/bloqueio-dia', authenticateToken, authorizeRole('barbeiro'), AppointmentController.blockFullDay);

module.exports = router;
