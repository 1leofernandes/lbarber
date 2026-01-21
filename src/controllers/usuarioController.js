// src/controllers/usuarioController.js
const usuarioService = require('../services/usuarioService');

class UsuarioController {
    // Obter dados do usuário logado
    async getMe(req, res) {
        try {
            const userId = req.user.id;
            const usuario = await usuarioService.getUsuarioById(userId);
            
            if (!usuario) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Usuário não encontrado' 
                });
            }
            
            res.json({
                success: true,
                usuario: usuario
            });
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            res.status(500).json({ 
                success: false,
                message: 'Erro interno do servidor' 
            });
        }
    }
    
    // Atualizar dados do usuário
    async updateMe(req, res) {
        try {
            const userId = req.user.id;
            const { nome, email, telefone } = req.body;
            
            // Validação básica
            if (!nome || !email) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Nome e email são obrigatórios' 
                });
            }
            
            // Validar formato do email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Formato de email inválido' 
                });
            }
            
            // Verificar se email já está em uso por outro usuário
            const emailEmUso = await usuarioService.verificarEmailEmUso(email, userId);
            if (emailEmUso) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Este email já está em uso por outro usuário' 
                });
            }
            
            const dadosAtualizados = { nome, email, telefone };
            const usuarioAtualizado = await usuarioService.updateUsuario(userId, dadosAtualizados);
            
            res.json({
                success: true,
                message: 'Dados atualizados com sucesso',
                usuario: usuarioAtualizado
            });
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            res.status(500).json({ 
                success: false,
                message: 'Erro interno do servidor' 
            });
        }
    }
    
    // Deletar conta do usuário permanentemente
    async deleteMe(req, res) {
        try {
            const userId = req.user.id;
            const { senha } = req.body;
            
            if (!senha) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Por favor, confirme sua senha para excluir a conta' 
                });
            }
            
            // 1. Verificar se o usuário existe e obter senha
            const usuario = await usuarioService.getUsuarioComSenha(userId);
            if (!usuario) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Usuário não encontrado' 
                });
            }
            
            // 2. Verificar senha
            const bcrypt = require('bcrypt');
            const senhaValida = await bcrypt.compare(senha, usuario.senha);
            if (!senhaValida) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Senha incorreta. Não foi possível excluir a conta.' 
                });
            }
            
            // 3. Deletar o usuário e todos os seus dados relacionados
            const usuarioDeletado = await usuarioService.deleteUsuario(userId);
            
            if (!usuarioDeletado) {
                return res.status(500).json({ 
                    success: false,
                    message: 'Não foi possível excluir a conta' 
                });
            }
            
            res.json({
                success: true,
                message: 'Conta e todos os dados relacionados foram excluídos permanentemente'
            });
        } catch (error) {
            console.error('Erro ao excluir conta:', error);
            res.status(500).json({ 
                success: false,
                message: 'Erro interno do servidor' 
            });
        }
    }
}

module.exports = new UsuarioController();