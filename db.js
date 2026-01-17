require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Teste de conexão
(async () => {
  try {
    const client = await pool.connect();
    console.log("Conexão com o PostgreSQL (Neon) estabelecida com sucesso! 🚀");
    client.release();
  } catch (err) {
    console.error("Erro ao conectar ao PostgreSQL (Neon):", err);
  }
})();

module.exports = pool;
