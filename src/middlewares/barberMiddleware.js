const barberMiddleware = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        // Verificar se é barbeiro
        const role = req.user.role || [];
        if (!role.includes('barbeiro')) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Requer privilégios de barbeiro'
            });
        }
        
        next();
    } catch (error) {
        console.error('Erro na verificação de barbeiro:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

module.exports = barberMiddleware;