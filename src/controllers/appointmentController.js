// Controller de agendamentos
const AppointmentService = require('../services/appointmentService');
const Appointment = require('../models/Appointment');
const pool = require('../config/database');
const { validateRequired, validators } = require('../utils/validation');
const logger = require('../utils/logger');

class AppointmentController {
  static async createAppointment(req, res, next) {
    try {
      const { barbeiro_id, servico_id, data_agendada, hora_agendada } = req.body;
      const usuario_id = req.user.id;

      // Validar
      const errors = validateRequired(['barbeiro_id', 'servico_id', 'data_agendada', 'hora_agendada'], req.body);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validação falhou',
          errors
        });
      }

      if (!validators.data(data_agendada) || !validators.hora(hora_agendada)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de data/hora inválido'
        });
      }

      const appointment = await AppointmentService.createAppointment(
        usuario_id,
        barbeiro_id,
        servico_id,
        data_agendada,
        hora_agendada
      );

      res.status(201).json({
        success: true,
        message: 'Agendamento realizado com sucesso',
        appointment
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAvailableHours(req, res, next) {
    try {
      const { barbeiro_id, data } = req.query;

      if (!validators.id(barbeiro_id) || !validators.data(data)) {
        return res.status(400).json({
          success: false,
          message: 'Parâmetros inválidos'
        });
      }

      const hours = await AppointmentService.getAvailableHours(barbeiro_id, data);
      res.json({
        success: true,
        horariosDisponiveis: hours
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBarberAppointments(req, res, next) {
    try {
      const barbeiro_id = req.user.id;
      const appointments = await AppointmentService.getBarberAppointments(barbeiro_id);

      res.json({
        success: true,
        agendamentos: appointments
      });
    } catch (err) {
      next(err);
    }
  }

  static async blockTime(req, res, next) {
    try {
      const { data, hora } = req.body;
      const barbeiro_id = req.user.id;

      if (!data || !hora) {
        return res.status(400).json({
          success: false,
          message: 'Data e hora obrigatórias'
        });
      }

      const query = `
        INSERT INTO bloqueios (barbeiro_id, data, hora, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
      `;
      await pool.query(query, [barbeiro_id, data, hora]);

      logger.info('Horário bloqueado', { barbeiro_id, data, hora });

      res.status(201).json({
        success: true,
        message: 'Horário bloqueado com sucesso'
      });
    } catch (err) {
      next(err);
    }
  }

  static async blockFullDay(req, res, next) {
    try {
      const { data } = req.body;
      const barbeiro_id = req.user.id;

      if (!data) {
        return res.status(400).json({
          success: false,
          message: 'Data obrigatória'
        });
      }

      const horarios = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
      
      const query = `
        INSERT INTO bloqueios (barbeiro_id, data, hora, created_at)
        VALUES ${horarios.map((_, i) => `($1, $2, $${i + 3}, NOW())`).join(',')}
      `;
      
      await pool.query(query, [barbeiro_id, data, ...horarios]);

      logger.info('Dia completo bloqueado', { barbeiro_id, data });

      res.status(201).json({
        success: true,
        message: 'Dia bloqueado com sucesso'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AppointmentController;
