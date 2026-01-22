const adminMiddleware = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        // Verificar se é admin
        const roles = req.user.roles || [];
        if (!roles.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Requer privilégios de administrador'
            });
        }
        
        next();
    } catch (error) {
        console.error('Erro na verificação de admin:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

module.exports = adminMiddleware;