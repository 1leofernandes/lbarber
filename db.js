const { Pool } = require('pg');

// Configuração para PostgreSQL (Render)
const pool = new Pool({
  user: process.env.DB_USER, // || 'postgres', // Padrão para desenvolvimento local
  host: process.env.DB_HOST, // || 'localhost',
  database: process.env.DB_NAME, // || 'barbearia',
  password: process.env.DB_PASSWORD, // || 'leonardo1234', // Altere para sua senha local
  port: process.env.DB_PORT, // || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false // Necessário para o Render
  } : false
});

// Teste de conexão
(async () => {
  try {
    const client = await pool.connect();
    console.log("Conexão com o PostgreSQL estabelecida com sucesso!");
    client.release();
  } catch (err) {
    console.error("Erro ao conectar ao PostgreSQL:", err);
  }
})();

// Exporta o pool para uso em outros arquivos
module.exports = pool;