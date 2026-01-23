// Model de Agendamento com queries otimizadas
const pool = require('../config/database');

class Appointment {
  // ATUALIZADO: findAll agora inclui múltiplos serviços
  static async findAll(filters = {}, limit = 100, offset = 0) {
    let query = `
      SELECT 
        a.id,
        a.usuario_id,
        a.barbeiro_id,
        a.servico_id,
        a.data_agendada,
        a.hora_inicio,
        a.hora_fim,
        a.status,
        a.created_at,
        a.updated_at,
        c.nome AS cliente_nome,
        b.nome AS barbeiro_nome,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'nome_servico', s.nome_servico,
              'valor_servico', s.valor_servico,
              'duracao_servico', s.duracao_servico
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) as servicos
      FROM agendamentos a
      INNER JOIN usuarios c ON a.usuario_id = c.id
      INNER JOIN usuarios b ON a.barbeiro_id = b.id
      LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
      LEFT JOIN servicos s ON ags.servico_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    // Filtros
    if (filters.barbeiro_id) {
      paramCount++;
      query += ` AND a.barbeiro_id = $${paramCount}`;
      params.push(filters.barbeiro_id);
    }

    if (filters.data_agendada) {
      paramCount++;
      query += ` AND a.data_agendada = $${paramCount}`;
      params.push(filters.data_agendada);
    }

    if (filters.data_inicio) {
      paramCount++;
      query += ` AND a.data_agendada >= $${paramCount}`;
      params.push(filters.data_inicio);
    }

    if (filters.data_fim) {
      paramCount++;
      query += ` AND a.data_agendada <= $${paramCount}`;
      params.push(filters.data_fim);
    }

    if (filters.status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(filters.status);
    }

    // Agrupamento necessário por causa do json_agg
    query += ` GROUP BY a.id, c.nome, b.nome `;
    
    // Ordenação
    query += ` ORDER BY a.data_agendada DESC, a.hora_inicio DESC`;

    // Paginação (após GROUP BY)
    if (limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(limit);
    }

    if (offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  // CORREÇÃO: Adicionar método findById que estava faltando
  static async findById(id) {
    const query = `
      SELECT 
        a.*,
        c.nome AS cliente_nome,
        b.nome AS barbeiro_nome,
        s.nome_servico AS servico_nome
      FROM agendamentos a
      INNER JOIN usuarios c ON a.usuario_id = c.id
      INNER JOIN usuarios b ON a.barbeiro_id = b.id
      LEFT JOIN servicos s ON a.servico_id = s.id
      WHERE a.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // CORREÇÃO: Adicionar método update que estava faltando
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    if (data.usuario_id !== undefined) {
      paramCount++;
      fields.push(`usuario_id = $${paramCount}`);
      values.push(data.usuario_id);
    }
    if (data.barbeiro_id !== undefined) {
      paramCount++;
      fields.push(`barbeiro_id = $${paramCount}`);
      values.push(data.barbeiro_id);
    }
    if (data.servico_id !== undefined) {
      paramCount++;
      fields.push(`servico_id = $${paramCount}`);
      values.push(data.servico_id);
    }
    if (data.data_agendada !== undefined) {
      paramCount++;
      fields.push(`data_agendada = $${paramCount}`);
      values.push(data.data_agendada);
    }
    if (data.hora_inicio !== undefined) {
      paramCount++;
      fields.push(`hora_inicio = $${paramCount}`);
      values.push(data.hora_inicio);
    }
    if (data.hora_fim !== undefined) {
      paramCount++;
      fields.push(`hora_fim = $${paramCount}`);
      values.push(data.hora_fim);
    }
    if (data.status !== undefined) {
      paramCount++;
      fields.push(`status = $${paramCount}`);
      values.push(data.status);
    }

    if (fields.length === 0) {
      throw new Error('Nenhum campo para atualizar');
    }

    paramCount++;
    values.push(id);

    const query = `
      UPDATE agendamentos
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // CORREÇÃO: Adicionar método delete que estava faltando
  static async delete(id) {
    const query = 'DELETE FROM agendamentos WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // MÉTODO ORIGINAL (mantido para compatibilidade)
  static async create(usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim) {
    const query = `
      INSERT INTO agendamentos (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, created_at
    `;
    const result = await pool.query(query, [usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim]);
    return result.rows[0];
  }

  // NOVO: createWithServices melhorado
  static async createWithServices(usuario_id, barbeiro_id, servicos_ids, data_agendada, hora_inicio, hora_fim, observacoes = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Criar o agendamento (com servico_id como NULL ou o primeiro)
      const agendamentoQuery = `
        INSERT INTO agendamentos 
        (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim, observacoes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `;
      
      const primeiroServico = servicos_ids[0] || null;
      const agendamentoResult = await client.query(agendamentoQuery, [
        usuario_id, barbeiro_id, primeiroServico, data_agendada, hora_inicio, hora_fim, observacoes
      ]);
      
      const agendamentoId = agendamentoResult.rows[0].id;
      
      // 2. Inserir todos os serviços na tabela de relação
      for (const servicoId of servicos_ids) {
        await client.query(
          'INSERT INTO agendamento_servicos (agendamento_id, servico_id) VALUES ($1, $2)',
          [agendamentoId, servicoId]
        );
      }
      
      await client.query('COMMIT');
      
      // 3. Retornar o agendamento completo com serviços
      return await this.findByIdWithServices(agendamentoId);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // NOVO: findByIdWithServices
  static async findByIdWithServices(id) {
    const query = `
      SELECT 
        a.*,
        c.nome as cliente_nome,
        b.nome as barbeiro_nome,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'nome_servico', s.nome_servico,
              'valor_servico', s.valor_servico,
              'duracao_servico', s.duracao_servico,
              'descricao', s.descricao
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) as servicos
      FROM agendamentos a
      LEFT JOIN usuarios c ON a.usuario_id = c.id
      LEFT JOIN usuarios b ON a.barbeiro_id = b.id
      LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
      LEFT JOIN servicos s ON ags.servico_id = s.id
      WHERE a.id = $1
      GROUP BY a.id, c.nome, b.nome
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // NOVO: findByUserWithServices
  static async findByUserWithServices(usuario_id) {
    const query = `
      SELECT 
        a.*,
        b.nome as barbeiro_nome,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'nome_servico', s.nome_servico,
              'valor_servico', s.valor_servico,
              'duracao_servico', s.duracao_servico
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) as servicos
      FROM agendamentos a
      LEFT JOIN usuarios b ON a.barbeiro_id = b.id
      LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
      LEFT JOIN servicos s ON ags.servico_id = s.id
      WHERE a.usuario_id = $1
      GROUP BY a.id, b.nome
      ORDER BY a.data_agendada DESC, a.hora_inicio DESC
    `;
    
    const result = await pool.query(query, [usuario_id]);
    return result.rows;
  }

  // MÉTODOS EXISTENTES (corrigidos)
  static async checkConflict(barbeiro_id, data_agendada, hora_inicio, hora_fim) {
    const query = `
      SELECT id
      FROM agendamentos
      WHERE barbeiro_id = $1
      AND data_agendada = $2
      AND hora_inicio = $3
      AND status != 'cancelado'
      LIMIT 1
    `;
    const result = await pool.query(query, [barbeiro_id, data_agendada, hora_inicio, hora_fim]);
    return result.rows.length > 0;
  }

  static async getAppointmentsByBarber(barbeiro_id, startDate) {
    const query = `
      SELECT 
        a.id,
        a.data_agendada,
        a.hora_inicio,
        a.hora_fim,
        c.nome AS nome_cliente,
        b.nome AS nome_barbeiro,
        s.nome_servico AS nome_servico,
        a.status
      FROM agendamentos a
      INNER JOIN usuarios c ON a.usuario_id = c.id
      INNER JOIN usuarios b ON a.barbeiro_id = b.id
      INNER JOIN servicos s ON a.servico_id = s.id
      WHERE a.barbeiro_id = $1
      AND a.data_agendada >= $2
      AND a.status != 'cancelado'
      ORDER BY a.data_agendada ASC, a.hora_inicio ASC
    `;
    const result = await pool.query(query, [barbeiro_id, startDate]);
    return result.rows;
  }

  static async getUnavailableHours(barbeiro_id, data_agendada) {
    const query = `
      (
        SELECT hora_inicio as hora
        FROM agendamentos
        WHERE barbeiro_id = $1
        AND data_agendada = $2
        AND status != 'cancelado'
      )
      UNION
      (
        SELECT hora_inicio as hora
        FROM bloqueios
        WHERE id_barbeiro = $1
        AND data = $2
      )
      ORDER BY hora ASC
    `;
    const result = await pool.query(query, [barbeiro_id, data_agendada]);
    return result.rows.map(r => r.hora);
  }

  // NOVO: updateStatus
  static async updateStatus(id, status) {
    const query = `
      UPDATE agendamentos
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [status, id]);
    return result.rows[0];
  }

  // NOVO: updateWithServices para admin
  static async updateWithServices(id, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Atualizar dados básicos do agendamento
      const fields = [];
      const values = [];
      let paramCount = 0;

      if (data.barbeiro_id !== undefined) {
        paramCount++;
        fields.push(`barbeiro_id = $${paramCount}`);
        values.push(data.barbeiro_id);
      }
      if (data.data_agendada !== undefined) {
        paramCount++;
        fields.push(`data_agendada = $${paramCount}`);
        values.push(data.data_agendada);
      }
      if (data.hora_inicio !== undefined) {
        paramCount++;
        fields.push(`hora_inicio = $${paramCount}`);
        values.push(data.hora_inicio);
      }
      if (data.hora_fim !== undefined) {
        paramCount++;
        fields.push(`hora_fim = $${paramCount}`);
        values.push(data.hora_fim);
      }
      if (data.status !== undefined) {
        paramCount++;
        fields.push(`status = $${paramCount}`);
        values.push(data.status);
      }
      if (data.observacoes !== undefined) {
        paramCount++;
        fields.push(`observacoes = $${paramCount}`);
        values.push(data.observacoes);
      }

      if (fields.length > 0) {
        paramCount++;
        values.push(id);
        const updateQuery = `
          UPDATE agendamentos
          SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${paramCount}
          RETURNING id
        `;
        await client.query(updateQuery, values);
      }

      // 2. Atualizar serviços se fornecido
      if (data.servicos_ids && Array.isArray(data.servicos_ids)) {
        // Remover relações antigas
        await client.query(
          'DELETE FROM agendamento_servicos WHERE agendamento_id = $1',
          [id]
        );
        
        // Inserir novas relações
        for (const servicoId of data.servicos_ids) {
          await client.query(
            'INSERT INTO agendamento_servicos (agendamento_id, servico_id) VALUES ($1, $2)',
            [id, servicoId]
          );
        }
        
        // Atualizar servico_id principal (primeiro da lista)
        await client.query(
          'UPDATE agendamentos SET servico_id = $1 WHERE id = $2',
          [data.servicos_ids[0] || null, id]
        );
      }

      await client.query('COMMIT');
      
      return await this.findByIdWithServices(id);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Appointment;