// Model de Agendamento com queries otimizadas
const pool = require('../config/database');

class Appointment {
  static async create(usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim) {
    const query = `
      INSERT INTO agendamentos (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, created_at
    `;
    const result = await pool.query(query, [usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim]);
    return result.rows[0];
  }

  static async checkConflict(barbeiro_id, data_agendada, hora_inicio, hora_fim) {
    const query = `
      SELECT id
      FROM agendamentos
      WHERE barbeiro_id = $1
      AND data_agendada = $2
      AND hora_agendada = $3
      AND status != 'cancelado'
      LIMIT 1
    `;
    const result = await pool.query(query, [barbeiro_id, data_agendada, hora_inicio, hora_fim]);
    return result.rows.length > 0;
  }

  static async getAppointmentsByBarber(barbeiro_id, startDate) {
    // Query otimizada com SELECT específico e índices
    const query = `
      SELECT 
        a.id,
        a.data_agendada,
        a.hora_agendada,
        c.nome AS nome_cliente,
        b.nome AS nome_barbeiro,
        s.servico AS nome_servico,
        a.status
      FROM agendamentos a
      INNER JOIN usuarios c ON a.usuario_id = c.id
      INNER JOIN usuarios b ON a.barbeiro_id = b.id
      INNER JOIN servicos s ON a.servico_id = s.id
      WHERE a.barbeiro_id = $1
      AND a.data_agendada >= $2
      AND a.status != 'cancelado'
      ORDER BY a.data_agendada ASC, a.hora_agendada ASC
    `;
    const result = await pool.query(query, [barbeiro_id, startDate]);
    return result.rows;
  }

  static async getUnavailableHours(barbeiro_id, data_agendada) {
    const query = `
      (
        SELECT hora_agendada as hora
        FROM agendamentos
        WHERE barbeiro_id = $1
        AND data_agendada = $2
        AND status != 'cancelado'
      )
      UNION
      (
        SELECT hora
        FROM bloqueios
        WHERE barbeiro_id = $1
        AND data = $2
      )
      ORDER BY hora ASC
    `;
    const result = await pool.query(query, [barbeiro_id, data_agendada]);
    return result.rows.map(r => r.hora);
  }
}

module.exports = Appointment;
