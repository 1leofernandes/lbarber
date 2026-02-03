const pool = require('./src/config/database');

async function check() {
  try {
    console.log('\n=== VERIFICAR ASSINATURAS_USUARIOS ===');
    const result = await pool.query(`
      SELECT * FROM assinaturas_usuarios 
      WHERE usuario_id = 12 
      AND status = 'ativa'
    `);
    console.log(result.rows);
    
    console.log('\n=== TODOS OS REGISTROS ===');
    const all = await pool.query('SELECT * FROM assinaturas_usuarios');
    console.log(all.rows);
    
    pool.end();
  } catch (error) {
    console.error('Erro:', error.message);
    pool.end();
  }
}

check();
