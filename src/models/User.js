// Model de Usuário com queries otimizadas
const pool = require('../config/database');
const logger = require('../utils/logger');

class User {
  static async findByEmail(email) {
    // Normalizar email para busca (lowercase)
    const emailNormalizado = email ? email.toLowerCase().trim() : email;
    
    logger.info('Buscando usuário por email no banco', { 
      emailOriginal: email,
      emailNormalizado
    });

    // Buscar com LOWER para garantir case-insensitive
    const query = `
      SELECT id, nome, email, telefone, senha, role, roles, assinante, assinatura_id, created_at, updated_at
      FROM usuarios
      WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
      LIMIT 1
    `;
    
    let result;
    try {
      result = await pool.query(query, [emailNormalizado]);
      logger.info('Query executada com sucesso', {
        emailNormalizado,
        rowsFound: result.rows.length,
        userId: result.rows[0] ? result.rows[0].id : null
      });
    } catch (dbError) {
      logger.error('Erro ao buscar usuário no banco', {
        emailNormalizado,
        error: dbError.message,
        stack: dbError.stack,
        code: dbError.code
      });
      throw dbError;
    }

    const user = result.rows[0] || null;
    
    if (user) {
      logger.info('Usuário encontrado no banco', {
        userId: user.id,
        email: user.email,
        role: user.role,
        roles: user.roles,
        senhaExists: !!user.senha,
        senhaLength: user.senha ? user.senha.length : 0,
        senhaStartsWith: user.senha ? user.senha.substring(0, 7) : 'null'
      });
    } else {
      logger.info('Nenhum usuário encontrado para o email', { emailNormalizado });
    }

    return user;
  }

  static async findById(id) {
    const query = `
      SELECT id, nome, email, role, roles, assinante, assinatura_id, created_at, updated_at
      FROM usuarios
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByRole(role) {
    const query = 'SELECT id, nome, email, telefone, role FROM usuarios WHERE role = $1 ORDER BY nome';
    const result = await pool.query(query, [role]);
    return result.rows;
  }

  static async create(nome, email, telefone, senhaHash, role = 'cliente', roles = null) {
    const query = `
      INSERT INTO usuarios (nome, email, telefone, senha, role, roles, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, nome, email, telefone, role, roles
    `;
    const result = await pool.query(query, [nome, email, telefone, senhaHash, role, roles]);
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
