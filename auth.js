require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('./db'); // Certifique-se de que db.js usa o método .promise()

const router = express.Router();

// Registro
router.post('/registrar', async (req, res) => {
    const { nome, email, senha, role } = req.body;
    const senhaHash = bcrypt.hashSync(senha, 8);

    try {
        const [results] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        
        if (results.length > 0) {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }

        await db.query('INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)', 
                       [nome, email, senhaHash, role || 'cliente']);
        res.json({ message: 'Usuário registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar usuário:', err);
        res.status(500).json({ message: 'Erro interno ao registrar usuário' });
    }
});

// Rota de registro de barbeiros
router.post('/registrar-barbeiro', (req, res) => {
    const { nome, email, senha } = req.body;

    // Verifica se o email já existe no banco de dados
    db.query('SELECT * FROM usuarios WHERE email = ?', [email], (err, result) => {
        if (err) return res.status(500).send({ erro: err });
        if (result.length > 0) {
            return res.status(400).send({ mensagem: 'Email já registrado' });
        }

        // Gera o hash da senha
        const senhaHash = bcrypt.hashSync(senha, 8); // 8 é o custo de processamento do bcrypt

        // Insere o barbeiro no banco de dados com o role 'barbeiro'
        db.query(
            'INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)',
            [nome, email, senhaHash, 'barbeiro'],
            (err) => {
                if (err) return res.status(500).send({ erro: err });
                res.status(201).send({ mensagem: 'Barbeiro registrado com sucesso!' });
            }
        );
    });
});

// Login
router.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const [results] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        const usuario = results[0];
        const senhaValida = bcrypt.compareSync(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, role: usuario.role },
            'secreta',
            { expiresIn: '1h' }
        );

        res.json({ message: 'Login bem-sucedido!', token, role: usuario.role, nome: usuario.nome });
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).json({ message: 'Erro interno ao fazer login' });
    }
});

// Esqueci minha senha (enviar e-mail com o token)
router.post('/esqueci-senha', async (req, res) => {
    const { email } = req.body;

    try {
        const [results] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(400).json({ message: 'Email não cadastrado' });
        }

        const token = jwt.sign({ id: results[0].id }, 'secreta', { expiresIn: '15m' });
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'lbarberoficial1@gmail.com',
                pass: 'wgpr yemc neow ursr'
            }
        });

        const mailOptions = {
            from: 'lbarberoficial1@gmail.com',
            to: email,
            subject: 'Redefinição de Senha',
            text: 'Clique no link para redefinir sua senha: http://localhost:3000/resetar-senha.html?token=${token}'
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'E-mail de redefinição enviado!' });
    } catch (err) {
        console.error('Erro ao enviar o email de redefinição de senha:', err);
        res.status(500).json({ message: 'Erro ao enviar o email' });
    }
});

// Redefinir senha (valida o token e atualiza a senha)
router.post('/resetar-senha/:token', (req, res) => {
    const { token } = req.params;
    const { senha } = req.body;

    if (!senha) {
        return res.status(400).json({ message: 'Senha é obrigatória' });
    }

    const senhaHash = bcrypt.hashSync(senha, 8);

    jwt.verify(token, 'secreta', (err, decoded) => {
        if (err) {
            return res.status(400).json({ message: 'Token inválido ou expirado' });
        }

        const userId = decoded.id;

        db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, userId], (err) => {
            if (err) {
                console.error('Erro ao atualizar senha:', err);
                return res.status(500).json({ message: 'Erro ao redefinir senha' });
            }

            res.json({ message: 'Senha redefinida com sucesso!' });
        });
    });
});

// Rota para obter lista de barbeiros
router.get('/barbeiros', async (req, res) => {
    try {
        const [barbeiros] = await db.query('SELECT id, nome FROM usuarios WHERE role = ?', ['barbeiro']);
        res.json(barbeiros);
    } catch (err) {
        console.error('Erro ao buscar barbeiros:', err);
        res.status(500).json({ message: 'Erro ao buscar barbeiros' });
    }
});

router.get('/servicos', async (req, res) => {
    try {
        const [servicos] = await db.query('SELECT * FROM servicos');
        res.json(servicos);
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        res.status(500).json({ message: 'Erro ao buscar serviços' });
    }
});


// Rota para agendar
// No arquivo routes/agendamentos.js
router.post('/agendar', (req, res) => {
    const { usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada } = req.body;

    console.log("Dados recebidos para agendamento:", req.body);
    
    // Combine a data e hora para criar um objeto Date completo
    const agendamentoDataHora = new Date(`${data_agendada}T${hora_agendada}`);
    const agora = new Date();

    // Verifica se a data e hora são no passado
    if (agendamentoDataHora <= agora) {
        console.log("Erro: Tentativa de agendar para uma data no passado.");
        return res.status(400).json({ message: 'Não é possível agendar para datas ou horários no passado' });
    }

    // Consulta para verificar se já existe um agendamento para o barbeiro e horário
    const queryVerificarHorario = `
        SELECT * FROM agendamentos 
        WHERE barbeiro_id = ? 
        AND data_agendada = ? 
        AND hora_agendada = ?
    `;

    // Na rota /agendar
    db.query(queryVerificarHorario, [barbeiro_id, data_agendada, hora_agendada], (error, results) => {
        if (error) {
            console.error('Erro ao verificar agendamentos:', error);
            return res.status(500).json({ message: 'Erro ao verificar agendamentos' });
        }
        console.log('Resultado da consulta de agendamentos:', results);

        if (results.length > 0) {
            console.log("Horário já ocupado.");
            return res.status(400).json({ message: 'Horário já agendado para este barbeiro' });
        }

        // Caso não exista conflito, procede com o agendamento
        db.query(queryInserir, [usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada], (error, results) => {
            if (error) {
                console.error('Erro ao salvar agendamento:', error);
                return res.status(500).json({ message: 'Erro ao salvar agendamento' });
            }
            console.log("Agendamento realizado com sucesso.", results);
            res.status(201).json({ message: 'Agendamento realizado com sucesso' });
        });
    });

});

router.get('/barbeiros/:barbeiroId/agendamentos', async (req, res) => {
    const barbeiroId = req.params.barbeiroId;

    try {
        const [agendamentos] = await db.execute(
            `SELECT 
                a.id AS agendamento_id,
                u.nome AS cliente,
                b.nome AS barbeiro,
                s.servico AS servico,
                a.data_agendada,
                a.hora_agendada,
                a.status
             FROM agendamentos a
             JOIN usuarios u ON a.usuario_id = u.id
             JOIN barbeiros b ON a.barbeiro_id = b.id
             JOIN servicos s ON a.servico_id = s.id
             WHERE a.barbeiro_id = ? AND a.data_agendada >= CURDATE()
             ORDER BY a.data_agendada, a.hora_agendada`,
            [barbeiroId]
        );

        res.status(200).json(agendamentos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar agendamentos.' });
    }
});

function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // Adiciona os dados do token no req.user para uso nas rotas
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido' });
    }
}

module.exports = authenticateToken;

module.exports = router;