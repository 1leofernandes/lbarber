(async () => {
  const pool = require('../src/config/database');
  const agendamentoService = require('../src/services/agendamentoService');
  const bcrypt = require('bcryptjs');

  // next occurrence helpers (DB uses 1..7 where 1=segunda)
  function nextDateForDbDay(dbDay) {
    const now = new Date();
    const target = dbDay % 7; // JS: 0=Sun,1=Mon
    const diff = (target - now.getDay() + 7) % 7;
    const daysToAdd = diff === 0 ? 7 : diff; // ensure future date
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd);
    return d.toISOString().slice(0,10);
  }
  const MONDAY = nextDateForDbDay(1); // next Monday
  const THURSDAY = nextDateForDbDay(4); // next Thursday

  function sleep(ms){return new Promise(r=>setTimeout(r, ms));}

  try {
    console.log('Iniciando testes de assinaturas (modo direto JS, sem HTTP)...');

    // 1) Criar plano de assinatura test
    const planoRes = await pool.query(
      `INSERT INTO assinatura (valor, nome_plano, descricao) VALUES ($1,$2,$3) RETURNING *`,
      [49.9, 'Corte Ilimitado Test', 'Plano de teste']
    );
    const plano = planoRes.rows[0];
    console.log('Plano criado:', plano.id);

    // 2) Inserir dias de semana (1,2,3)
    await pool.query(`INSERT INTO assinatura_dias_semana (assinatura_id, dia_semana) VALUES ($1,1),($1,2),($1,3) ON CONFLICT DO NOTHING`, [plano.id]);
    console.log('Dias da semana configurados (1,2,3)');

    // 3) Criar dois serviços (corte incluso, barba não incluso)
    const s1 = await pool.query(`INSERT INTO servicos (nome_servico, duracao_servico, valor_servico, descricao, assinatura_ids) VALUES ($1,$2,$3,$4,$5) RETURNING *`, ['Corte Test', 30, 35.00, 'Corte de teste', [plano.id]]);
    const corte = s1.rows[0];
    const s2 = await pool.query(`INSERT INTO servicos (nome_servico, duracao_servico, valor_servico, descricao) VALUES ($1,$2,$3,$4) RETURNING *`, ['Barba Test', 30, 20.00, 'Barba de teste']);
    const barba = s2.rows[0];
    console.log('Serviços criados:', corte.id, barba.id);

    // 4) Encontrar (ou criar) um barbeiro
    let barbeiroRes = await pool.query(`SELECT id FROM usuarios WHERE role = 'barbeiro' LIMIT 1`);
    let barbeiroId;
    if (barbeiroRes.rows.length === 0) {
      const senhaHash = await bcrypt.hash('123456', 10);
      const b = await pool.query(`INSERT INTO usuarios (nome,email,telefone,senha,role,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`, ['Barbeiro Test','barbeiro-test@example.com','0000',senhaHash,'barbeiro']);
      barbeiroId = b.rows[0].id;
    } else barbeiroId = barbeiroRes.rows[0].id;
    console.log('Barbeiro ID:', barbeiroId);

    // 5) Criar usuários assinante e não assinante diretamente no DB
    const userEmailSub = `test-subscriber+${Date.now()}@example.com`;
    const userEmailNo = `test-user+${Date.now()}@example.com`;

    const senhaHash = await bcrypt.hash('123456', 10);
    const u1 = await pool.query(`INSERT INTO usuarios (nome,email,telefone,senha,role,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`, ['Sub User', userEmailSub, '000', senhaHash, 'cliente']);
    const u2 = await pool.query(`INSERT INTO usuarios (nome,email,telefone,senha,role,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`, ['No Sub User', userEmailNo, '000', senhaHash, 'cliente']);
    const userIdSub = u1.rows[0].id;
    const userIdNo = u2.rows[0].id;
    console.log('Usuários criados diretamente no DB:', userIdSub, userIdNo);

    // 6) Criar assinaturas_usuarios para assinante e atualizar usuarios.assinante e assinatura_id
    const au = await pool.query(`INSERT INTO assinaturas_usuarios (usuario_id, plano_id, status, data_inicio, proxima_cobranca) VALUES ($1,$2,'ativa',CURRENT_DATE,CURRENT_DATE + INTERVAL '30 days') RETURNING *`, [userIdSub, plano.id]);
    const assinUsuario = au.rows[0];
    await pool.query(`UPDATE usuarios SET assinante = true, assinatura_id = $1 WHERE id = $2`, [assinUsuario.id, userIdSub]);
    console.log('Assinatura de usuário criada:', assinUsuario.id);

    // 7) Testes de agendamento usando service diretamente
    async function findAvailableStart(barbeiro_id, dateStr, durationMinutes) {
      const candidates = [10,11,12,13,14,15,16];
      for (const hour of candidates) {
        const start = `${String(hour).padStart(2,'0')}:00:00`;
        const endDate = new Date(`${dateStr}T${String(hour).padStart(2,'0')}:00`);
        const end = new Date(endDate.getTime() + durationMinutes * 60000);
        const endStr = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}:00`;

        const q = `SELECT count(*) FROM agendamentos WHERE barbeiro_id = $1 AND data_agendada = $2 AND NOT (hora_fim <= $3 OR hora_inicio >= $4)`;
        const r = await pool.query(q, [barbeiro_id, dateStr, start, endStr]);
        const count = parseInt(r.rows[0].count, 10);
        if (count === 0) return start.slice(0,5); // HH:MM
      }
      throw new Error('Nenhum horário livre encontrado para o barbeiro neste dia');
    }

    async function criarAgendamentoDirect(usuario_id, servicos, dateStr, horaInicio = null) {
      // calcular duracao
      const servicosInfo = await pool.query('SELECT id, duracao_servico, valor_servico FROM servicos WHERE id = ANY($1::int[])', [servicos]);
      const dur = servicosInfo.rows.reduce((t, s) => t + (s.duracao_servico || 30), 0);
      if (!horaInicio) {
        horaInicio = await findAvailableStart(barbeiroId, dateStr, dur);
      }
      const inicioDate = new Date(`${dateStr}T${horaInicio}:00`);
      const fimDate = new Date(inicioDate.getTime() + dur * 60000);
      const horaFim = `${String(fimDate.getHours()).padStart(2,'0')}:${String(fimDate.getMinutes()).padStart(2,'0')}`;

      const dados = {
        usuario_id,
        barbeiro_id: barbeiroId,
        servicos_ids: servicos,
        data_agendada: dateStr,
        hora_inicio: horaInicio,
        hora_fim: horaFim
      };

      const res = await agendamentoService.createAgendamentoComServicos(dados);
      return res;
    }

    // a) Assinante agendando apenas Corte (segunda) -> total esperado 0
    const a1 = await criarAgendamentoDirect(userIdSub, [corte.id], MONDAY);
    console.log('Teste 1 (assinante - corte segunda):', JSON.stringify(a1, null, 2));

    // b) Assinante agendando Corte + Barba (segunda) -> total esperado apenas da Barba
    const a2 = await criarAgendamentoDirect(userIdSub, [corte.id, barba.id], MONDAY);
    console.log('Teste 2 (assinante - corte+barba segunda):', JSON.stringify(a2, null, 2));

    // c) Assinante agendando Corte (quinta) -> total esperado preço do corte (não coberto)
    const a3 = await criarAgendamentoDirect(userIdSub, [corte.id], THURSDAY);
    console.log('Teste 3 (assinante - corte quinta):', JSON.stringify(a3, null, 2));

    // d) Não assinante agendando Corte (segunda) -> total esperado preço do corte
    const a4 = await criarAgendamentoDirect(userIdNo, [corte.id], MONDAY);
    console.log('Teste 4 (não assinante - corte segunda):', JSON.stringify(a4, null, 2));

    console.log('\nTestes concluídos.');
    process.exit(0);
  } catch (err) {
    console.error('Erro durante testes:', err);
    process.exit(1);
  }
})();