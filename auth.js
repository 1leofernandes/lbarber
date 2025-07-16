require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('./db');

const router = express.Router();
const secret = process.env.JWT_SECRET || 'secreta';

// Registro
router.post('/registrar', async (req, res) => {
    const { nome, email, senha, role } = req.body;
    const senhaHash = bcrypt.hashSync(senha, 8);

    try {
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        
        if (rows.length > 0) {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }

        await db.query(
            'INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4)', 
            [nome, email, senhaHash, role || 'cliente']
        );
        res.json({ message: 'Usuário registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar usuário:', err);
        res.status(500).json({ message: 'Erro interno ao registrar usuário' });
    }
});

// Rota de registro de barbeiros
router.post('/registrar-barbeiro', async (req, res) => {
    const { nome, email, senha } = req.body;

    try {
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        
        if (rows.length > 0) {
            return res.status(400).send({ mensagem: 'Email já registrado' });
        }

        const senhaHash = bcrypt.hashSync(senha, 8);
        
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4)',
            [nome, email, senhaHash, 'barbeiro']
        );
        
        res.status(201).send({ mensagem: 'Barbeiro registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar barbeiro:', err);
        res.status(500).send({ erro: err });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        const usuario = rows[0];
        const senhaValida = bcrypt.compareSync(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, role: usuario.role },
            secret,
            { expiresIn: '1h' }
        );

        res.json({ 
            message: 'Login bem-sucedido!', 
            token, 
            role: usuario.role, 
            nome: usuario.nome,
            id: usuario.id
        });
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).json({ message: 'Erro interno ao fazer login' });
    }
});

// Esqueci minha senha (enviar e-mail com o token)
router.post('/esqueci-senha', async (req, res) => {
    const { email } = req.body;

    try {
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Email não cadastrado' });
        }

        const token = jwt.sign({ id: rows[0].id }, secret, { expiresIn: '15m' });
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'lbarberoficial1@gmail.com',
                pass: process.env.EMAIL_PASS || 'wgpr yemc neow ursr'
            }
        });

        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/resetar-senha?token=${token}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'lbarberoficial1@gmail.com',
            to: email,
            subject: 'Redefinição de Senha',
            html: `<p>Clique no link para redefinir sua senha: <a href="${resetLink}">${resetLink}</a></p>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'E-mail de redefinição enviado!' });
    } catch (err) {
        console.error('Erro ao enviar o email de redefinição de senha:', err);
        res.status(500).json({ message: 'Erro ao enviar o email' });
    }
});

// Redefinir senha (valida o token e atualiza a senha)
router.post('/resetar-senha/:token', async (req, res) => {
    const { token } = req.params;
    const { senha } = req.body;

    if (!senha) {
        return res.status(400).json({ message: 'Senha é obrigatória' });
    }

    try {
        const decoded = jwt.verify(token, secret);
        const senhaHash = bcrypt.hashSync(senha, 8);

        await db.query(
            'UPDATE usuarios SET senha = $1 WHERE id = $2', 
            [senhaHash, decoded.id]
        );

        res.json({ message: 'Senha redefinida com sucesso!' });
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(400).json({ message: 'Token inválido ou expirado' });
        }
        console.error('Erro ao atualizar senha:', err);
        res.status(500).json({ message: 'Erro ao redefinir senha' });
    }
});

// Rota para obter lista de barbeiros
router.get('/barbeiros', async (req, res) => {
    try {
        const { rows: barbeiros } = await db.query(
            'SELECT id, nome FROM usuarios WHERE role = $1', 
            ['barbeiro']
        );
        res.json(barbeiros);
    } catch (err) {
        console.error('Erro ao buscar barbeiros:', err);
        res.status(500).json({ message: 'Erro ao buscar barbeiros' });
    }
});

router.get('/servicos', async (req, res) => {
    try {
        const { rows: servicos } = await db.query('SELECT * FROM servicos');
        res.json(servicos);
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        res.status(500).json({ message: 'Erro ao buscar serviços' });
    }
});

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = decoded;
        next();
    });
}

module.exports = router;