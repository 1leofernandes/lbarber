// Service de agendamentos com lógica otimizada
const Appointment = require('../models/Appointment');
const logger = require('../utils/logger');

const HORARIOS_TRABALHO = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

class AppointmentService {
  static async createAppointment(usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada) {
    // Validar data/hora no futuro
    const appointmentDateTime = new Date(`${data_agendada}T${hora_agendada}`);
    if (appointmentDateTime <= new Date()) {
      throw {
        status: 400,
        message: 'Não é possível agendar para datas ou horários no passado'
      };
    }

    // Verificar conflito
    const hasConflict = await Appointment.checkConflict(barbeiro_id, data_agendada, hora_agendada);
    if (hasConflict) {
      throw {
        status: 409,
        message: 'Horário indisponível para este barbeiro'
      };
    }

    const appointment = await Appointment.create(
      usuario_id,
      barbeiro_id,
      servico_id,
      data_agendada,
      hora_agendada
    );

    logger.info('Agendamento criado', {
      appointmentId: appointment.id,
      usuarioId: usuario_id,
      barbeiroId: barbeiro_id
    });

    return appointment;
  }

  static async getAvailableHours(barbeiro_id, data_agendada) {
    // Usar query otimizada que une agendamentos e bloqueios
    const unavailableHours = await Appointment.getUnavailableHours(barbeiro_id, data_agendada);
    
    const availableHours = HORARIOS_TRABALHO.filter(
      hora => !unavailableHours.includes(hora)
    );

    return availableHours;
  }

  static async getBarberAppointments(barbeiro_id) {
    const hoje = new Date().toISOString().split('T')[0];
    const appointments = await Appointment.getAppointmentsByBarber(barbeiro_id, hoje);
    return appointments;
  }
}

module.exports = AppointmentService;
