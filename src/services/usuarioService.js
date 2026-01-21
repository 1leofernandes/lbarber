const pool = require('../config/database');

class UsuarioService {
    // Buscar usuário por ID
    async getUsuarioById(id) {
        const query = 'SELECT id, nome, email, telefone, ativo FROM usuarios WHERE id = $1';
        const values = [id];
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }
    
    // Verificar se email já está em uso
    async verificarEmailEmUso(email, usuarioId) {
        const query = 'SELECT id FROM usuarios WHERE email = $1 AND id != $2 AND ativo = true';
        const values = [email, usuarioId];
        
        const result = await pool.query(query, values);
        return result.rows.length > 0;
    }
    
    // Atualizar dados do usuário
    async updateUsuario(id, dados) {
        const { nome, email, telefone } = dados;
        const query = `
            UPDATE usuarios 
            SET nome = $1, email = $2, telefone = $3, updated_at = NOW()
            WHERE id = $4 
            RETURNING id, nome, email, telefone
        `;
        const values = [nome, email, telefone, id];
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }
    
    // Verificar senha do usuário
    async verificarSenha(userId, senha) {
        const query = 'SELECT senha FROM usuarios WHERE id = $1';
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) return false;
        
        const usuario = result.rows[0];
        // Aqui você usaria bcrypt.compare em produção
        // Para simplificar, vamos assumir que já temos hash no banco
        const bcrypt = require('bcrypt');
        return await bcrypt.compare(senha, usuario.senha);
    }
    
    // Soft delete (marcar como inativo)
    async softDeleteUsuario(id) {
        const query = `
            UPDATE usuarios 
            SET ativo = false, deleted_at = NOW(), email = CONCAT(email, '_deleted_', EXTRACT(EPOCH FROM NOW()))
            WHERE id = $1
        `;
        await pool.query(query, [id]);
    }
    
    // Buscar dados completos do usuário (para JWT)
    async getUsuarioCompleto(email) {
        const query = 'SELECT id, nome, email, telefone, role, ativo FROM usuarios WHERE email = $1 AND ativo = true';
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }
}

module.exports = new UsuarioService();