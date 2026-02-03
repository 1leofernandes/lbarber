const pool = require('./src/config/database');

async function fixSubscription() {
  try {
    console.log('\n=== CORRIGINDO DADOS DE ASSINATURA ===');
    
    // Encontrar assinatura_usuarios com plano_id incorreto
    const current = await pool.query(`
      SELECT * FROM assinaturas_usuarios WHERE usuario_id = 12
    `);
    console.log('Registro atual:', current.rows[0]);
    
    // Atualizar para o plano_id correto (2, não 1)
    const update = await pool.query(`
      UPDATE assinaturas_usuarios 
      SET plano_id = 2
      WHERE usuario_id = 12
      RETURNING *
    `);
    console.log('\n✅ Atualizado para:', update.rows[0]);
    
    // Verificar agendamentos
    console.log('\n=== VERIFICANDO AGENDAMENTOS ===');
    const appointments = await pool.query(`
      SELECT id, usuario_id, data_agendada, assinatura_usuario_id 
      FROM agendamentos 
      WHERE usuario_id = 12 
      ORDER BY id DESC 
      LIMIT 3
    `);
    console.log(appointments.rows);
    
    pool.end();
  } catch (error) {
    console.error('Erro:', error.message);
    pool.end();
  }
}

fixSubscription();
