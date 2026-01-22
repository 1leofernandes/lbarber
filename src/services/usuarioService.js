// src/services/usuarioService.js
const pool = require('../config/database');
const bcrypt = require('bcrypt');

class UsuarioService {
    // Buscar usuário por ID
    async getUsuarioById(id) {
        try {
            const query = `
                SELECT id, nome, email, telefone, role, assinatura_id created_at, updated_at
                FROM usuarios 
                WHERE id = $1
            `;
            const values = [id];
            
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no getUsuarioById:', error);
            throw error;
        }
    }
    
    // Verificar se email já está em uso
    async verificarEmailEmUso(email, usuarioId) {
        try {
            const query = `
                SELECT id FROM usuarios 
                WHERE email = $1 AND id != $2
            `;
            const values = [email, usuarioId];
            
            const result = await pool.query(query, values);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Erro no verificarEmailEmUso:', error);
            throw error;
        }
    }
    
    // Atualizar dados do usuário
    async updateUsuario(id, dados) {
        try {
            const { nome, email, telefone } = dados;
            const query = `
                UPDATE usuarios 
                SET nome = $1, email = $2, telefone = $3, updated_at = NOW()
                WHERE id = $4 
                RETURNING id, nome, email, telefone, role
            `;
            const values = [nome, email, telefone, id];
            
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Erro no updateUsuario:', error);
            throw error;
        }
    }
    
    // Soft delete (marcar como inativo)
    async deleteUsuario(id) {
        try {
            // Iniciar transação
            await pool.query('BEGIN');
            
            // 1. Primeiro deletar agendamentos do usuário
            const deleteAgendamentosQuery = `
                DELETE FROM agendamentos 
                WHERE usuario_id = $1
            `;
            await pool.query(deleteAgendamentosQuery, [id]);
            
            // 2. Deletar o usuário
            const deleteUsuarioQuery = `
                DELETE FROM usuarios 
                WHERE id = $1
                RETURNING id
            `;
            const result = await pool.query(deleteUsuarioQuery, [id]);
            
            // 3. Commit da transação
            await pool.query('COMMIT');
            
            return result.rows[0];
        } catch (error) {
            // Rollback em caso de erro
            await pool.query('ROLLBACK');
            console.error('Erro no deleteUsuario:', error);
            throw error;
        }
    }
}

module.exports = new UsuarioService();