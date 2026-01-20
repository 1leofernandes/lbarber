// Controller de autenticação
const AuthService = require('../services/authService');
const { validators, validateRequired } = require('../utils/validation');
const logger = require('../utils/logger');

class AuthController {
  static async register(req, res, next) {
    try {
      const { nome, email, telefone, senha, role } = req.body;

      const errors = validateRequired(['nome', 'email', 'telefone', 'senha'], req.body);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validação falhou',
          errors
        });
      }

      if (!validators.email(email)) {
        return res.status(400).json({ success: false, message: 'Email inválido' });
      }

      if (!validators.password(senha)) {
        return res.status(400).json({
          success: false,
          message: 'Senha muito curta (mínimo 6 caracteres)'
        });
      }

      if (!validators.nome(nome)) {
        return res.status(400).json({
          success: false,
          message: 'Nome inválido (mínimo 3 caracteres)'
        });
      }

      const result = await AuthService.register(
        nome,
        email,
        telefone,
        senha,
        role || 'cliente'
      );

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async registerBarber(req, res, next) {
    try {
      const { nome, email, telefone, senha } = req.body;

      const errors = validateRequired(['nome', 'email', 'telefone', 'senha'], req.body);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validação falhou',
          errors
        });
      }

      if (!validators.email(email) || !validators.password(senha)) {
        return res.status(400).json({
          success: false,
          message: 'Email ou senha inválido'
        });
      }

      const result = await AuthService.register(
        nome,
        email,
        telefone,
        senha,
        'barbeiro'
      );

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, senha } = req.body;

      const errors = validateRequired(['email', 'senha'], req.body);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email e senha obrigatórios',
          errors
        });
      }

      const result = await AuthService.login(email, senha);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;

      if (!email || !validators.email(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email inválido'
        });
      }

      const result = await AuthService.requestPasswordReset(email);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const { token } = req.params;
      const { senha } = req.body;

      if (!token || !senha) {
        return res.status(400).json({
          success: false,
          message: 'Token e senha obrigatórios'
        });
      }

      if (!validators.password(senha)) {
        return res.status(400).json({
          success: false,
          message: 'Senha inválida'
        });
      }

      const result = await AuthService.resetPassword(token, senha);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // ==================== GOOGLE CALLBACK ====================

  static async googleCallback(req, res, next) {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/login.html?error=google_auth_failed`
        );
      }

      // 🔐 Gerar JWT
      const token = AuthService.generateToken(user);

      // 🎯 Definir destino por role
      let redirectPage = 'login.html';

      if (user.roles === 'admin') {
        redirectPage = 'admin.html';
      } else if (user.role === 'barbeiro') {
        redirectPage = 'barbeiro.html';
      } else if (user.role === 'cliente') {
        redirectPage = 'cliente-home.html';
      }

      const frontendUrl = process.env.FRONTEND_URL || 'barbeariasilva.vercel.app';
      const redirectUrl = `${frontendUrl}/${redirectPage}`;

      logger.info('Google OAuth callback com sucesso', {
        userId: user.id,
        name: user.nome,
        email: user.email,
        role: user.role,
        roles: user.roles,
        redirectPage
      });

      return res.redirect(redirectUrl);
    } catch (err) {
      logger.error('Erro no callback do Google:', err);
      next(err);
    }
  }
}

module.exports = AuthController;
