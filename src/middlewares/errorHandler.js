// Middleware centralizado de tratamento de erros
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Erro não tratado:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Erro de validação
  if (err.status === 400) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Erro de autenticação
  if (err.status === 401) {
    return res.status(401).json({
      success: false,
      message: 'Não autenticado'
    });
  }

  // Erro de autorização
  if (err.status === 403) {
    return res.status(403).json({
      success: false,
      message: 'Não autorizado'
    });
  }

  // Erro de banco de dados
  if (err.code && err.code.startsWith('23')) {
    return res.status(409).json({
      success: false,
      message: 'Conflito: email ou dados duplicados'
    });
  }

  // Erro genérico
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message
  });
};

module.exports = errorHandler;
