// Middleware de autenticação otimizado
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const secret = process.env.JWT_SECRET || 'secreta';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    logger.warn('Tentativa de acesso sem token');
    return res.status(401).json({
      success: false,
      message: 'Token não fornecido'
    });
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      logger.warn('Token inválido:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    req.user = decoded;
    next();
  });
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Não autenticado'
      });
    }

    const userRole = req.user.role || req.user.roles;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Acesso não autorizado para role: ${userRole}`);
      return res.status(403).json({
        success: false,
        message: 'Não autorizado'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole
};
