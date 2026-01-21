const usuarioService = require('../services/usuarioService');

class UsuarioController {
    // Obter dados do usuário logado
    async getMe(req, res) {
        try {
            const userId = req.userId;
            const usuario = await usuarioService.getUsuarioById(userId);
            
            if (!usuario) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            
            // Não retornar senha
            const { senha, ...usuarioSemSenha } = usuario;
            res.json(usuarioSemSenha);
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    
    // Atualizar dados do usuário
    async updateMe(req, res) {
        try {
            const userId = req.userId;
            const { nome, email, telefone } = req.body;
            
            // Validação básica
            if (!nome || !email) {
                return res.status(400).json({ 
                    error: 'Nome e email são obrigatórios' 
                });
            }
            
            // Verificar se email já está em uso por outro usuário
            const emailEmUso = await usuarioService.verificarEmailEmUso(email, userId);
            if (emailEmUso) {
                return res.status(400).json({ 
                    error: 'Este email já está em uso por outro usuário' 
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
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    
    // Deletar conta do usuário (soft delete)
    async deleteMe(req, res) {
        try {
            const userId = req.userId;
            const { senha } = req.body; // Pedir senha para confirmação
            
            if (!senha) {
                return res.status(400).json({ 
                    error: 'Por favor, confirme sua senha para excluir a conta' 
                });
            }
            
            // Verificar senha antes de deletar
            const senhaValida = await usuarioService.verificarSenha(userId, senha);
            if (!senhaValida) {
                return res.status(401).json({ 
                    error: 'Senha incorreta. Não foi possível excluir a conta.' 
                });
            }
            
            await usuarioService.softDeleteUsuario(userId);
            
            res.json({
                success: true,
                message: 'Conta excluída com sucesso'
            });
        } catch (error) {
            console.error('Erro ao excluir conta:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new UsuarioController();