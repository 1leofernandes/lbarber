const pool = require('./src/config/database');

async function updateAppointments() {
  try {
    console.log('\n=== ATUALIZANDO ASSINATURA_USUARIO_ID DOS AGENDAMENTOS ===');
    
    // Para cada agendamento do usuário 12, vincular a assinatura_usuario_id correto
    const result = await pool.query(`
      UPDATE agendamentos a
      SET assinatura_usuario_id = au.id
      FROM assinaturas_usuarios au
      WHERE a.usuario_id = 12
        AND au.usuario_id = a.usuario_id
        AND au.status = 'ativa'
        AND au.data_inicio <= a.data_agendada
        AND (au.data_fim IS NULL OR au.data_fim >= a.data_agendada)
        AND a.assinatura_usuario_id IS NULL
      RETURNING a.id, a.data_agendada, a.assinatura_usuario_id
    `);
    console.log('Agendamentos atualizados:', result.rows);
    
    // Testar cálculo de valor_total
    console.log('\n=== TESTANDO CÁLCULO DE VALOR_TOTAL ===');
    
    const testQuery = await pool.query(`
      SELECT 
        a.id,
        a.usuario_id,
        a.data_agendada,
        EXTRACT(ISODOW FROM a.data_agendada)::int as dia_semana,
        a.assinatura_usuario_id,
        u.assinante,
        u.assinatura_id,
        (
          SELECT json_agg(json_build_object(
            'servico_id', rel.servico_id,
            'nome', s.nome_servico,
            'valor', s.valor_servico
          ))
          FROM (
            SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = a.id
            UNION ALL
            SELECT a.servico_id WHERE a.servico_id IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM agendamento_servicos WHERE agendamento_id = a.id)
          ) rel
          LEFT JOIN servicos s ON rel.servico_id = s.id
        ) as servicos,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN u.assinante = true
                AND u.assinatura_id IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM assinatura_servico 
                  WHERE assinatura_id = u.assinatura_id 
                  AND servico_id = s2.id
                )
                AND EXISTS (
                  SELECT 1 FROM assinatura_dias_semana 
                  WHERE assinatura_id = u.assinatura_id 
                  AND dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::int
                )
              THEN 0
              ELSE COALESCE(s2.valor_servico, 0)
            END
          )
          FROM (
            SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = a.id
            UNION ALL
            SELECT a.servico_id WHERE a.servico_id IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM agendamento_servicos WHERE agendamento_id = a.id)
          ) rel2
          LEFT JOIN servicos s2 ON rel2.servico_id = s2.id
        ), 0) as valor_total
      FROM agendamentos a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.usuario_id = 12
      ORDER BY a.id DESC
      LIMIT 5
    `);
    
    console.log(JSON.stringify(testQuery.rows, null, 2));
    
    pool.end();
  } catch (error) {
    console.error('Erro:', error.message);
    pool.end();
  }
}

updateAppointments();
