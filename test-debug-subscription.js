const pool = require('./src/config/database');

async function debugSubscription() {
  try {
    // 1. Verificar estrutura da tabela usuarios
    console.log('\n=== ESTRUTURA DA TABELA USUARIOS ===');
    const usuariosStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `);
    console.table(usuariosStructure.rows);

    // 2. Verificar dados do usuário assinante
    console.log('\n=== DADOS DO USUÁRIO ID 1 ===');
    const usuario = await pool.query(`
      SELECT * FROM usuarios WHERE id = 1
    `);
    console.log(usuario.rows[0]);

    // 3. Verificar assinatura do usuário
    if (usuario.rows[0]) {
      console.log('\n=== ASSINATURA DO USUÁRIO ===');
      const assinatura = await pool.query(`
        SELECT * FROM assinatura WHERE id = $1
      `, [usuario.rows[0].assinatura_id]);
      console.log(assinatura.rows);

      // 4. Verificar serviços da assinatura
      console.log('\n=== SERVIÇOS DA ASSINATURA ===');
      const servicos = await pool.query(`
        SELECT s.* FROM servicos s
        INNER JOIN assinatura_servico ass ON s.id = ass.servico_id
        WHERE ass.assinatura_id = $1
      `, [usuario.rows[0].assinatura_id]);
      console.log(servicos.rows);

      // 5. Verificar dias da assinatura
      console.log('\n=== DIAS DA ASSINATURA ===');
      const dias = await pool.query(`
        SELECT * FROM assinatura_dias_semana WHERE assinatura_id = $1
      `, [usuario.rows[0].assinatura_id]);
      console.log(dias.rows);

      // 6. Verificar assinaturas ativas do usuário
      console.log('\n=== ASSINATURAS ATIVAS DO USUÁRIO ===');
      const ativasQuery = `
        SELECT au.*, a.nome as plano_nome
        FROM assinaturas_usuarios au
        LEFT JOIN assinatura a ON au.plano_id = a.id
        WHERE au.usuario_id = $1
        AND au.status = 'ativa'
      `;
      const ativas = await pool.query(ativasQuery, [usuario.rows[0].id]);
      console.log(ativas.rows);

      // 7. Se houver agendamentos, verificar o último
      console.log('\n=== ÚLTIMO AGENDAMENTO DO USUÁRIO ===');
      const agendamentos = await pool.query(`
        SELECT a.*, 
          json_agg(json_build_object('id', s.id, 'nome', s.nome_servico, 'valor', s.valor_servico)) as servicos
        FROM agendamentos a
        LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
        LEFT JOIN servicos s ON ags.servico_id = s.id
        WHERE a.usuario_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC
        LIMIT 1
      `, [usuario.rows[0].id]);
      
      if (agendamentos.rows[0]) {
        console.log(agendamentos.rows[0]);
        
        // 8. Testar a query de valor_total para este agendamento
        console.log('\n=== TESTE DE CÁLCULO DE VALOR_TOTAL ===');
        const idAgendamento = agendamentos.rows[0].id;
        const testQuery = `
          SELECT 
            a.id,
            a.usuario_id,
            a.data_agendada,
            a.assinatura_usuario_id,
            EXTRACT(ISODOW FROM a.data_agendada)::integer as dia_semana_isodow,
            u2.assinante,
            u2.assinatura_id,
            json_agg(json_build_object(
              'servico_id', rel.servico_id,
              'nome', s2.nome_servico,
              'valor', s2.valor_servico,
              'servico_na_assinatura', EXISTS (
                SELECT 1 FROM assinatura_servico ass 
                WHERE ass.assinatura_id = u2.assinatura_id 
                AND ass.servico_id = s2.id
              ),
              'dia_coberto', EXISTS (
                SELECT 1 FROM assinatura_dias_semana ads 
                WHERE ads.assinatura_id = u2.assinatura_id 
                AND ads.dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::integer
              ),
              'valor_calculado', CASE
                WHEN u2.assinante = true
                  AND u2.assinatura_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1 FROM assinatura_servico ass WHERE ass.assinatura_id = u2.assinatura_id AND ass.servico_id = s2.id
                  )
                  AND EXISTS (
                    SELECT 1 FROM assinatura_dias_semana ads WHERE ads.assinatura_id = u2.assinatura_id AND ads.dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::integer
                  )
                THEN 0
                ELSE COALESCE(s2.valor_servico, 0)
              END
            )) as servicos_detalhados,
            COALESCE((
              SELECT COALESCE(SUM(
                CASE
                  WHEN u2.assinante = true
                    AND u2.assinatura_id IS NOT NULL
                    AND EXISTS (
                      SELECT 1 FROM assinatura_servico ass WHERE ass.assinatura_id = u2.assinatura_id AND ass.servico_id = s2.id
                    )
                    AND EXISTS (
                      SELECT 1 FROM assinatura_dias_semana ads WHERE ads.assinatura_id = u2.assinatura_id AND ads.dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::integer
                    )
                  THEN 0
                  ELSE COALESCE(s2.valor_servico, 0)
                END
              ), 0)
              FROM (
                SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = a.id
                UNION ALL
                SELECT a.servico_id WHERE a.servico_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agendamento_servicos ags3 WHERE ags3.agendamento_id = a.id)
              ) rel
              LEFT JOIN servicos s2 ON rel.servico_id = s2.id
              LEFT JOIN usuarios u2 ON u2.id = a.usuario_id
            ), 0) as valor_total_calculado
          FROM agendamentos a
          LEFT JOIN (
            SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = $1
            UNION ALL
            SELECT a.servico_id WHERE a.servico_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agendamento_servicos ags3 WHERE ags3.agendamento_id = $1)
          ) rel ON true
          LEFT JOIN servicos s2 ON rel.servico_id = s2.id
          LEFT JOIN usuarios u2 ON u2.id = a.usuario_id
          WHERE a.id = $1
          GROUP BY a.id, u2.assinante, u2.assinatura_id, a.usuario_id, a.data_agendada, a.assinatura_usuario_id
        `;
        
        const testResult = await pool.query(testQuery, [idAgendamento]);
        console.log(JSON.stringify(testResult.rows[0], null, 2));
      }
    }

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    pool.end();
  }
}

debugSubscription();
