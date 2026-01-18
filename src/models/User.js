// Model de Usuário com queries otimizadas
const pool = require('../config/database');

class User {
  static async findByEmail(email) {
    const query = `
      SELECT id, nome, email, senha, role, roles, created_at, updated_at
      FROM usuarios
      WHERE email = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findById(id) {
    const query = `
      SELECT id, nome, email, role, roles, created_at, updated_at
      FROM usuarios
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async create(nome, email, senhaHash, role = 'cliente', roles = null) {
    const query = `
      INSERT INTO usuarios (nome, email, senha, role, roles, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, nome, email, role, roles
    `;
    const result = await pool.query(query, [nome, email, senhaHash, role, roles]);
    return result.rows[0];
  }

  static async updatePassword(id, senhaHash) {
    const query = `
      UPDATE usuarios
      SET senha = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [senhaHash, id]);
    return result.rows[0];
  }

  static async getAllBarbeiros() {
    const query = `
      SELECT id, nome, email, created_at
      FROM usuarios
      WHERE role = 'barbeiro'
      ORDER BY nome ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  static async deleteBarbeiro(id) {
    const query = `
      DELETE FROM usuarios
      WHERE id = $1 AND role = 'barbeiro'
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = User;
