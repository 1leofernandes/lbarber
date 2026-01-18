require('dotenv').config();
const { Pool } = require('pg');

// Pool de conexões otimizado para Render free tier
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Otimizações para free tier
  max: 15, // Reduzido para economizar conexões
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Event listeners para monitoramento
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexões:', err);
});

pool.on('connect', () => {
  // Pool estabelecido
});

// Teste de conexão ao iniciar
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexão com PostgreSQL estabelecida com sucesso!');
    client.release();
  } catch (err) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;
