// Service de autenticação com lógica de negócio

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * ENV OBRIGATÓRIAS
 */
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET não definido no .env');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '360d';

/**
 * Emails que terão permissão de admin
 */
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

/**
 * Transporter de email
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

class AuthService {

  /**
   * Registro de usuário
   */
  static async register(nome, email, telefone, senha) {
    if (!nome || !email || !senha) {
      throw {
        status: 400,
        message: 'Nome, email e senha são obrigatórios'
      };
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      throw {
        status: 400,
        message: 'Email já cadastrado'
      };
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    /**
     * roles = permissão especial (admin)
     * role  = perfil do sistema (cliente, barbeiro)
     */
    const role = 'cliente';
    const roles = adminEmails.includes(email) ? 'admin' : null;

    console.log({
      role,
      roleLength: role?.length,
      roles,
      rolesLength: roles?.length
    });
    const user = await User.create(
      nome,
      email,
      telefone || null,
      senhaHash,
      role,
      roles
    );

    logger.info('Novo usuário registrado', {
      userId: user.id,
      email,
      telefone,
      role,
      roles
    });

    return {
      success: true,
      message: 'Usuário registrado com sucesso!'
    };
  }

  static generateToken(user) {
    if (!user || !user.id) {
      throw new Error('Usuário inválido para geração de token');
    }

    return jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
        role: user.role,
        roles: user.roles
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRATION
      }
    );
  }

  /**
   * Login
   */
  static async login(email, senha) {
    if (!email || !senha) {
      throw {
        status: 400,
        message: 'Email e senha são obrigatórios'
      };
    }

    const user = await User.findByEmail(email);

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      logger.warn('Tentativa de login inválida', { email });
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
        telefone: user.telefone,
        role: user.role,
        roles: user.roles
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    /**
     * Redirecionamento por prioridade
     */
    let redirectPage = 'cliente-home.html';

    if (user.roles === 'admin') {
      redirectPage = 'admin.html';
    } else if (user.role === 'barbeiro') {
      redirectPage = 'barbeiro.html';
    }

    logger.info('Login bem-sucedido', {
      userId: user.id,
      email
    });

    return {
      success: true,
      message: 'Login realizado com sucesso!',
      token,
      id: user.id,
      nome: user.nome,
      role: user.role,
      roles: user.roles,
      redirectPage
    };
  }

  /**
   * Solicitação de redefinição de senha
   */
  static async requestPasswordReset(email) {
    if (!email) {
      throw {
        status: 400,
        message: 'Email é obrigatório'
      };
    }

    const user = await User.findByEmail(email);

    /**
     * Segurança: nunca revelar se o email existe
     */
    if (!user) {
      logger.warn('Reset solicitado para email inexistente', { email });
      return {
        success: true,
        message: 'Se o email existir, você receberá instruções'
      };
    }

    const token = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: '25m' }
    );

    const resetLink = `${process.env.FRONTEND_URL}/resetar-senha?token=${token}`;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Redefinição de Senha - Barbearia',
        html: `
          <h2>Redefinição de Senha</h2>
          <p>Clique no link abaixo para redefinir sua senha:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Este link expira em <strong>15 minutos</strong>.</p>
        `
      });

      logger.info('Email de redefinição enviado', { email });

    } catch (error) {
      logger.error('Erro ao enviar email de reset', {
        email,
        error: error.message
      });

      throw {
        status: 500,
        message: 'Erro ao enviar email de redefinição'
      };
    }

    return {
      success: true,
      message: 'Email de redefinição enviado!'
    };
  }

  /**
   * Reset de senha
   */
  static async resetPassword(token, novaSenha) {
    if (!token || !novaSenha) {
      throw {
        status: 400,
        message: 'Token e nova senha são obrigatórios'
      };
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      throw {
        status: 400,
        message: 'Token inválido ou expirado'
      };
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await User.updatePassword(decoded.id, senhaHash);

    logger.info('Senha redefinida com sucesso', {
      userId: decoded.id
    });

    return {
      success: true,
      message: 'Senha redefinida com sucesso!'
    };
  }
}

module.exports = AuthService;
