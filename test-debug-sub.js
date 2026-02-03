const pool = require('./src/config/database');

async function debugSubscription() {
  try {
    // 0. Encontrar usuário assinante
    console.log('\n=== PROCURANDO USUÁRIOS ASSINANTES ===');
    const assinantes = await pool.query(`
      SELECT id, nome, email, assinante, assinatura_id FROM usuarios WHERE assinante = true
    `);
    console.log(assinantes.rows);
    
    if (assinantes.rows.length === 0) {
      console.log('❌ Nenhum usuário assinante encontrado!');
      pool.end();
      return;
    }

    const usuarioAssinante = assinantes.rows[0];
    const usuarioId = usuarioAssinante.id;
    
    console.log('\n=== VERIFICANDO USUÁRIO ID ' + usuarioId + ' ===');
    const usuario = await pool.query(`
      SELECT * FROM usuarios WHERE id = $1
    `, [usuarioId]);
    console.log(usuario.rows[0]);

    if (usuario.rows[0].assinatura_id) {
      // Verificar assinatura
      console.log('\n=== ASSINATURA DO USUÁRIO ===');
      const assinatura = await pool.query(`
        SELECT * FROM assinatura WHERE id = $1
      `, [usuario.rows[0].assinatura_id]);
      console.log(assinatura.rows[0]);

      // Verificar serviços
      console.log('\n=== SERVIÇOS DA ASSINATURA ===');
      const servicos = await pool.query(`
        SELECT s.* FROM servicos s
        INNER JOIN assinatura_servico ass ON s.id = ass.servico_id
        WHERE ass.assinatura_id = $1
      `, [usuario.rows[0].assinatura_id]);
      console.log(servicos.rows);

      // Verificar dias
      console.log('\n=== DIAS DA ASSINATURA ===');
      const dias = await pool.query(`
        SELECT * FROM assinatura_dias_semana WHERE assinatura_id = $1
      `, [usuario.rows[0].assinatura_id]);
      console.log(dias.rows);
    }

    // Agendamentos
    console.log('\n=== ÚLTIMOS AGENDAMENTOS DO USUÁRIO ===');
    const agendamentos = await pool.query(`
      SELECT a.id, a.data_agendada, a.usuario_id, a.assinatura_usuario_id, a.servico_id,
        (SELECT json_agg(json_build_object('id', s.id, 'nome', s.nome_servico, 'valor', s.valor_servico))
         FROM agendamento_servicos ags
         LEFT JOIN servicos s ON ags.servico_id = s.id
         WHERE ags.agendamento_id = a.id
        ) as servicos_relacao,
        s_main.nome_servico as servico_direto_nome,
        s_main.valor_servico as servico_direto_valor
      FROM agendamentos a
      LEFT JOIN servicos s_main ON a.servico_id = s_main.id
      WHERE a.usuario_id = $1
      ORDER BY a.created_at DESC
      LIMIT 5
    `, [usuarioId]);
    
    console.log(agendamentos.rows);
    
    if (agendamentos.rows.length > 0) {
      const agendamento = agendamentos.rows[0];
      console.log(`\n=== TESTE DE DESCONTO (Agendamento ID ${agendamento.id}) ===`);
      console.log('Data:', agendamento.data_agendada);
      console.log('Dia semana (ISODOW):', new Date(agendamento.data_agendada).getDay());
      
      // Simular cálculo manual
      const testResult = await pool.query(`
        SELECT 
          a.id,
          a.usuario_id,
          a.data_agendada,
          EXTRACT(DOW FROM a.data_agendada)::int as dia_semana_DOW,
          EXTRACT(ISODOW FROM a.data_agendada)::int as dia_semana_ISODOW,
          u.assinante,
          u.assinatura_id,
          json_agg(json_build_object(
            'id', rel.servico_id,
            'nome', s.nome_servico,
            'valor', s.valor_servico,
            'na_assinatura', EXISTS(
              SELECT 1 FROM assinatura_servico 
              WHERE assinatura_id = u.assinatura_id 
              AND servico_id = rel.servico_id
            )
          )) as servicos,
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
        LEFT JOIN (
          SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = $1
          UNION ALL
          SELECT a.servico_id WHERE a.servico_id IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM agendamento_servicos WHERE agendamento_id = $1)
        ) rel ON true
        LEFT JOIN servicos s ON rel.servico_id = s.id
        WHERE a.id = $1
        GROUP BY a.id, a.usuario_id, a.data_agendada, u.assinante, u.assinatura_id
      `, [agendamento.id]);
      
      console.log(JSON.stringify(testResult.rows[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    pool.end();
  }
}

debugSubscription();
