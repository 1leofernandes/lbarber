const pool = require('./src/config/database');

async function fixFutureAppointments() {
  try {
    console.log('\n=== CORRIGINDO AGENDAMENTOS FUTUROS ===');
    
    // Atualizar apenas agendamentos futuros
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
        AND a.data_agendada >= CURRENT_DATE
      RETURNING a.id, a.usuario_id, a.assinatura_usuario_id
    `);
    
    console.log(`✅ ${updateResult.rows.length} agendamentos atualizados`);
    console.log(updateResult.rows);
    
    // 2. Verificar descontos
    console.log('\n=== AGENDAMENTOS COM DESCONTO (Seg/Ter/Qua) ===');
    const result = await pool.query(`
      SELECT 
        a.id,
        a.usuario_id,
        u.nome,
        a.data_agendada,
        EXTRACT(ISODOW FROM a.data_agendada)::int as dia_semana,
        (SELECT string_agg(s.nome_servico, ', ')
         FROM agendamento_servicos ags
         LEFT JOIN servicos s ON ags.servico_id = s.id
         WHERE ags.agendamento_id = a.id) as servicos,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN u.assinante = true
                AND u.assinatura_id IS NOT NULL
                AND EXISTS (SELECT 1 FROM assinatura_servico WHERE assinatura_id = u.assinatura_id AND servico_id = s2.id)
                AND EXISTS (SELECT 1 FROM assinatura_dias_semana WHERE assinatura_id = u.assinatura_id AND dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::int)
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
        ), 0) as valor_total,
        COALESCE((
          SELECT SUM(s.valor_servico)
          FROM (
            SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = a.id
            UNION ALL
            SELECT a.servico_id WHERE a.servico_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agendamento_servicos WHERE agendamento_id = a.id)
          ) rel2
          LEFT JOIN servicos s ON rel2.servico_id = s.id
        ), 0) as valor_original
      FROM agendamentos a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.data_agendada >= CURRENT_DATE
        AND u.assinante = true
        AND u.assinatura_id IS NOT NULL
        AND EXTRACT(ISODOW FROM a.data_agendada)::int IN (1, 2, 3)
      ORDER BY a.data_agendada
    `);
    
    console.log('\n');
    result.rows.forEach(r => {
      const hasDiscount = parseFloat(r.valor_total) < parseFloat(r.valor_original);
      console.log(`ID ${r.id}: ${r.nome} | ${new Date(r.data_agendada).toLocaleDateString()} (dia ${r.dia_semana}) | ${r.servicos} | R$ ${r.valor_original} -> R$ ${r.valor_total}${hasDiscount ? ' ✅ DESCONTO' : ''}`);
    });
    
    pool.end();
  } catch (error) {
    console.error('Erro:', error.message);
    pool.end();
  }
}

fixFutureAppointments();
