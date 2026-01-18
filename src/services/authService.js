// Service de autenticação com lógica de negócio
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const logger = require('../utils/logger');

const secret = process.env.JWT_SECRET || 'secreta';
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'lbarberoficial1@gmail.com',
    pass: process.env.EMAIL_PASS || 'wgpr yemc neow ursr'
  }
});

class AuthService {
  static async register(nome, email, senha, role = 'cliente') {
    // Verificar duplicata
    const existing = await User.findByEmail(email);
    if (existing) {
      throw {
        status: 400,
        message: 'Email já cadastrado'
      };
    }

    const senhaHash = bcrypt.hashSync(senha, 8);
    const roles = adminEmails.includes(email) ? 'admin' : null;

    const user = await User.create(nome, email, senhaHash, role, roles);
    logger.info('Novo usuário registrado', { userId: user.id, email });

    return { success: true, message: 'Usuário registrado com sucesso!' };
  }

  static async login(email, senha) {
    const user = await User.findByEmail(email);
    
    if (!user || !bcrypt.compareSync(senha, user.senha)) {
      logger.warn('Tentativa de login falhou', { email });
      throw {
        status: 401,
        message: 'Email ou senha inválidos'
      };
    }

    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        roles: user.roles
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRATION || '1h' }
    );

    // Determinar página de redirecionamento
    let redirectPage = 'cliente-home.html';
    if (user.roles === 'admin') {
      redirectPage = 'admin.html';
    } else if (user.role === 'barbeiro') {
      redirectPage = 'barbeiro.html';
    }

    logger.info('Login bem-sucedido', { userId: user.id, email });

    return {
      success: true,
      message: 'Login bem-sucedido!',
      token,
      role: user.role,
      roles: user.roles,
      nome: user.nome,
      id: user.id,
      redirectPage
    };
  }

  static async requestPasswordReset(email) {
    const user = await User.findByEmail(email);
    
    if (!user) {
      // Não revelar se email existe (segurança)
      logger.warn('Password reset solicitado para email inexistente', { email });
      return { success: true, message: 'Se o email existe, receberá instruções' };
    }

    const token = jwt.sign(
      { id: user.id },
      secret,
      { expiresIn: '15m' }
    );

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/resetar-senha?token=${token}`;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'lbarberoficial1@gmail.com',
        to: email,
        subject: 'Redefinição de Senha - Barbearia',
        html: `
          <h2>Redefinição de Senha</h2>
          <p>Clique no link para redefinir sua senha:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>Este link expira em 15 minutos.</p>
        `
      });
      logger.info('Email de reset enviado', { email });
    } catch (err) {
      logger.error('Erro ao enviar email', { email, error: err.message });
      throw {
        status: 500,
        message: 'Erro ao enviar email'
      };
    }

    return { success: true, message: 'Email de redefinição enviado!' };
  }

  static async resetPassword(token, novaSenha) {
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      throw {
        status: 400,
        message: 'Token inválido ou expirado'
      };
    }

    const senhaHash = bcrypt.hashSync(novaSenha, 8);
    await User.updatePassword(decoded.id, senhaHash);

    logger.info('Senha redefinida', { userId: decoded.id });

    return { success: true, message: 'Senha redefinida com sucesso!' };
  }
}

module.exports = AuthService;
