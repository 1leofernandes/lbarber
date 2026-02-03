const pool = require('./src/config/database');

async function fixAllAppointments() {
  try {
    console.log('\n=== CORRIGINDO TODOS OS AGENDAMENTOS ===');
    
    // 1. Atualizar assinatura_usuario_id para agendamentos que se qualificam
    const updateResult = await pool.query(`
      UPDATE agendamentos a
      SET assinatura_usuario_id = (
        SELECT au.id
        FROM assinaturas_usuarios au
        WHERE au.usuario_id = a.usuario_id
          AND au.status = 'ativa'
          AND au.data_inicio <= a.data_agendada
          AND (au.data_fim IS NULL OR au.data_fim >= a.data_agendada)
        ORDER BY au.data_inicio DESC
        LIMIT 1
      )
      WHERE a.usuario_id IN (SELECT id FROM usuarios WHERE assinante = true AND assinatura_id IS NOT NULL)
        AND a.assinatura_usuario_id IS NULL
      RETURNING a.id, a.usuario_id, a.assinatura_usuario_id
    `);
    
    console.log(`✅ ${updateResult.rows.length} agendamentos atualizados`);
    
    // 2. Verificar descontos para segunda-feira (ISODOW = 1)
    console.log('\n=== AGENDAMENTOS DE SEGUNDA-FEIRA (COM DESCONTO) ===');
    const mondayResult = await pool.query(`
      SELECT 
        a.id,
        a.usuario_id,
        u.nome,
        a.data_agendada,
        EXTRACT(ISODOW FROM a.data_agendada)::int as dia_semana,
        s.nome_servico,
        s.valor_servico,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN u_check.assinante = true
                AND u_check.assinatura_id IS NOT NULL
                AND EXISTS (SELECT 1 FROM assinatura_servico WHERE assinatura_id = u_check.assinatura_id AND servico_id = s2.id)
                AND EXISTS (SELECT 1 FROM assinatura_dias_semana WHERE assinatura_id = u_check.assinatura_id AND dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::int)
              THEN 0
              ELSE COALESCE(s2.valor_servico, 0)
            END
          )
          FROM (
            SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = a.id
            UNION ALL
            SELECT a.servico_id WHERE a.servico_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agendamento_servicos WHERE agendamento_id = a.id)
          ) rel2
          LEFT JOIN servicos s2 ON rel2.servico_id = s2.id
          LEFT JOIN usuarios u_check ON u_check.id = a.usuario_id
        ), 0) as valor_total
      FROM agendamentos a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN servicos s ON a.servico_id = s.id
      WHERE EXTRACT(ISODOW FROM a.data_agendada)::int IN (1, 2, 3)
        AND u.assinante = true
        AND u.assinatura_id IS NOT NULL
      ORDER BY a.data_agendada
      LIMIT 10
    `);
    
    console.log(mondayResult.rows.map(r => ({
      id: r.id,
      usuario: r.nome,
      data: r.data_agendada,
      servico: r.nome_servico,
      valor_original: r.valor_servico,
      valor_total: r.valor_total
    })));
    
    pool.end();
  } catch (error) {
    console.error('Erro:', error.message);
    pool.end();
  }
}

fixAllAppointments();
