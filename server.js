const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./auth');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000; // Alterado para usar variável de ambiente
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Lista de e-mails autorizados para administradores
const adminEmails = ['leobarbeiro@gmail.com', 'leonardoff24@gmail.com'];

// Middleware
app.use(cors()); // Permite CORS
app.use(bodyParser.json()); // Analisa o corpo das requisições como JSON
app.use('/auth', authRoutes); // Usa as rotas de autenticação definidas no arquivo auth.js
app.use(express.static('public')); // Serve os arquivos estáticos (HTML, CSS, JS)

// Conexão ao banco de dados (MySQL)
const db = require('./db'); // Certifique-se de que 'db.js' está configurado corretamente

const secret = 'secreta'; // Defina sua chave secreta

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token não encontrado' });

    jwt.verify(token, secret, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        req.user = user;
        next();
    });
}

// Middleware para verificar se o usuário é administrador
async function updateAdminRoles() {
    try {
        // Método 1: Usando ANY (recomendado para PostgreSQL)
        const query = `
            UPDATE usuarios 
            SET roles = 'admin' 
            WHERE email = ANY($1::text[])
        `;
        await db.query(query, [adminEmails]);
        
        console.log('Admin roles updated successfully!');
    } catch (error) {
        console.error('Error updating admin roles:', error);
    }
}

// Execute a função ao iniciar o servidor
updateAdminRoles();



// Rota para adicionar usuário e verificar roles
app.post('/registrar', async (req, res) => {
    const { nome, email, senha } = req.body;

    // Validação dos campos obrigatórios
    if (!nome || !email || !senha) {
        return res.status(400).json({ 
            success: false,
            message: 'Nome, email e senha são obrigatórios' 
        });
    }

    try {
        // Verifica se o usuário já existe
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (rows.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Email já cadastrado' 
            });
        }

        // Criptografa a senha
        const hashedPassword = await bcrypt.hash(senha.toString(), 10);

        // Define roles conforme a constraint da tabela
        let roles = ['cliente']; // Valor padrão
        if (adminEmails.includes(email)) {
            roles = ['admin']; // Se for admin, substitui o array
        }

        // Insere o usuário no banco de dados
        await db.query(
            `INSERT INTO usuarios (nome, email, senha, role, roles) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
                nome, 
                email, 
                hashedPassword,
                'cliente', // Coluna role sempre como 'cliente'
                JSON.stringify(roles) // Garante o formato correto para a constraint
            ]
        );

        res.status(201).json({ 
            success: true,
            message: 'Usuário registrado com sucesso',
            isAdmin: roles.includes('admin')
        });

    } catch (error) {
        console.error('Erro detalhado:', error);
        
        if (error.code === '23514') { // Código de erro para violation of check constraint
            return res.status(400).json({
                success: false,
                message: 'Formato de roles inválido',
                hint: 'O valor deve ser um array JSON válido contendo apenas roles permitidas'
            });
        }

        res.status(500).json({ 
            success: false,
            message: 'Erro interno no servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota para registro de barbeiros
app.post('/registrar-barbeiro', async (req, res) => {
    const { nome, email, senha } = req.body;
    console.log('Recebido POST para registrar barbeiro:', req.body);

    try {
        // Verifica se o email já existe
        const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        
        if (rows.length > 0) {
            console.log('Email já registrado');
            return res.status(400).send({ mensagem: 'Email já registrado' });
        }

        // Gera o hash da senha
        const senhaHash = await bcrypt.hash(senha, 8);
        console.log('Hash da senha gerado:', senhaHash);

        // Insere o barbeiro (deixe o ID ser gerado automaticamente)
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4)',
            [nome, email, senhaHash, 'barbeiro']
        );

        console.log('Barbeiro registrado com sucesso');
        res.status(201).send({ mensagem: 'Barbeiro registrado com sucesso!' });
    } catch (error) {
        console.error('Erro no servidor:', error);
        
        if (error.code === '23505') { // Erro de violação de chave única
            return res.status(400).send({ 
                mensagem: 'Erro ao registrar - ID ou email já existente',
                detalhes: error.detail
            });
        }
        
        res.status(500).send({ erro: 'Erro ao registrar barbeiro' });
    }
});


// Rota para registro (se não estiver usando o arquivo auth.js para isso)
app.post('/registrar', (req, res) => {
    const { nome, email, senha } = req.body;

    // Verifica se o email já existe no banco de dados
    db.query('SELECT * FROM usuarios WHERE email = $1', [email], (err, result) => {
        if (err) return res.status(500).send({ erro: err });
        if (result.rows.length > 0) {
            return res.status(400).send({ mensagem: 'Email já registrado' });
        }

        // Gera o hash da senha
        const senhaHash = bcrypt.hashSync(senha, 8); // 8 é o custo de processamento do bcrypt

        // Define roles com base na lista de e-mails autorizados
        const roles = adminEmails.includes(email) ? JSON.stringify(['admin']) : JSON.stringify([]);

        // Insere novo usuário com a senha criptografada e roles
        db.query(
            'INSERT INTO usuarios (nome, email, senha, roles) VALUES ($1, $2, $3, $4)',
            [nome, email, senhaHash, roles],
            (err) => {
                if (err) return res.status(500).send({ erro: err });
                res.status(201).send({ mensagem: 'Usuário registrado com sucesso!' });
            }
        );
    });
});


app.post('/auth/resetar-senha', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Verifica o token
        const decoded = jwt.verify(token, secret);
        
        // Encripta a nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Atualiza a senha no banco de dados
        await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hashedPassword, decoded.id]);

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        console.error('Erro ao redefinir a senha:', error);
        res.status(400).json({ message: 'Token inválido ou expirado.' });
    }
});
// Remova a rota duplicada de login no server.js, já que ela está no auth.js

// Rota para obter o ID do barbeiro autenticado
app.get('/user-info', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; // Captura o token de 'Bearer <token>'
    
    if (!token) {
        return res.status(401).send({ mensagem: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, secret); // Decodifica o token usando a chave secreta
        
        // Consulta adicional para buscar informações atualizadas do usuário
        db.query('SELECT id, role FROM usuarios WHERE id = $1', [decoded.id], (err, result) => {
            if (err) return res.status(500).send({ mensagem: 'Erro ao buscar informações do usuário' });
            if (result.rows.length === 0) return res.status(404).send({ mensagem: 'Usuário não encontrado' });
            
            const user = result.rows[0];
            res.send({ id: user.id, role: user.role });
        });
    } catch (err) {
        res.status(401).send({ mensagem: 'Token inválido' });
    }
});


// Rota para obter a lista de barbeiros
app.get('/barbeiros', async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM usuarios WHERE role = 'barbeiro'"); // Filtra apenas os barbeiros
        res.status(200).json(rows);
    } catch (error) {
        console.error('Erro ao carregar barbeiros:', error);
        res.status(500).json({ message: 'Erro ao carregar barbeiros' });
    }
});


app.post('/agendar', async (req, res) => {
    const { usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada } = req.body;
    
    console.log('Dados recebidos para agendamento:', { usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada });

    // Combine a data e a hora para criar um objeto Date completo
    const agendamentoDataHora = new Date(`${data_agendada}T${hora_agendada}`);
    const agora = new Date();

    console.log('Data e hora do agendamento:', agendamentoDataHora);
    console.log('Data e hora atuais:', agora);

    // Verifica se a data e hora são no passado
    if (agendamentoDataHora <= agora) {
        return res.status(400).json({ message: 'Não é possível agendar para datas ou horários no passado' });
    }

    try {
        // Consulta para verificar se já existe um agendamento para o barbeiro e horário
        const { rows } = await db.query(`
            SELECT * FROM agendamentos 
            WHERE barbeiro_id = $1 
            AND data_agendada = $2 
            AND hora_agendada = $3
        `, [barbeiro_id, data_agendada, hora_agendada]);

        console.log('Resultado da verificação de horário:', rows);

        if (rows.length > 0) {
            return res.status(400).json({ message: 'Horário já agendado para este barbeiro' });
        }

        // Caso não exista conflito, procede com o agendamento
        await db.query(`
            INSERT INTO agendamentos (usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada) 
            VALUES ($1, $2, $3, $4, $5)
        `, [usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada]);

        console.log('Agendamento salvo com sucesso');
        res.status(201).json({ message: 'Agendamento realizado com sucesso' });

    } catch (error) {
        console.error('Erro ao processar o agendamento:', error);
        res.status(500).json({ message: 'Erro ao realizar o agendamento' });
    }
});


app.get('/agendamentos/barbeiro/:id', async (req, res) => {
    const { id } = req.params; // ID do barbeiro
    const { data_agendada } = req.query; // Data enviada como query string

    console.log(`Carregando horários disponíveis para barbeiro: ${id} na data: ${data_agendada}`);

    try {
        // 1. Obter os horários já agendados
        const { rows: agendamentos } = await db.query(`
            SELECT hora_agendada 
            FROM agendamentos 
            WHERE barbeiro_id = $1 AND data_agendada = $2
        `, [id, data_agendada]);

        console.log('Horários agendados encontrados:', agendamentos);

        // 2. Obter os horários bloqueados
        const { rows: bloqueios } = await db.query(`
            SELECT hora 
            FROM bloqueios 
            WHERE barbeiro_id = $1 AND data = $2
        `, [id, data_agendada]);

        console.log('Horários bloqueados encontrados:', bloqueios);

        // 3. Listar os horários disponíveis
        const horariosDia = [
            '08:00', '09:00', '10:00', '11:00', '12:00',
            '13:00', '14:00', '15:00', '16:00', '17:00'
        ]; // Horários de trabalho padrão

        // Combine horários agendados e bloqueados
        const horariosIndisponiveis = [
            ...agendamentos.map(a => a.hora_agendada),
            ...bloqueios.map(b => b.hora)
        ];

        console.log('Horários indisponíveis:', horariosIndisponiveis);

        // Filtrar os horários disponíveis
        const horariosDisponiveis = horariosDia.filter(
            hora => !horariosIndisponiveis.includes(hora)
        );

        res.json({ horariosDisponiveis });
    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        res.status(500).json({ message: 'Erro ao carregar horários' });
    }
});



app.get('/servicos', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM servicos');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        res.status(500).send('Erro ao buscar serviços');
    }
});
  
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }

    jwt.verify(token, secret, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        req.user = user;
        next();
    });
}


// Rota para obter apenas os agendamentos do barbeiro autenticado
// Rota para obter todos os agendamentos
app.get('/agendamentos', authenticateToken, async (req, res) => {
    const usuarioId = req.user.id;
    const hoje = new Date().toISOString().split('T')[0];

    try {
        const { rows: [usuario] } = await db.query(`SELECT role FROM usuarios WHERE id = $1`, [usuarioId]);

        if (!usuario || usuario.role !== 'barbeiro') {
            return res.status(403).json({ message: 'Acesso restrito a barbeiros' });
        }

        const { rows: agendamentos } = await db.query(
            `SELECT 
                agendamentos.id,
                agendamentos.data_agendada,
                agendamentos.hora_agendada,
                clientes.nome AS nome_cliente,
                barbeiros.nome AS nome_barbeiro,
                servicos.servico AS nome_servico
            FROM agendamentos
            JOIN usuarios AS clientes ON agendamentos.usuario_id = clientes.id
            JOIN usuarios AS barbeiros ON agendamentos.barbeiro_id = barbeiros.id
            JOIN servicos ON agendamentos.servico_id = servicos.id
            WHERE agendamentos.barbeiro_id = $1
            AND (agendamentos.data_agendada > $2 OR 
                (agendamentos.data_agendada = $2 AND agendamentos.hora_agendada >= TIME(NOW())))
            ORDER BY agendamentos.data_agendada ASC, agendamentos.hora_agendada ASC`, 
            [usuarioId, hoje]
        );

        res.json({ agendamentos: agendamentos || [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar agendamentos' });
    }
});

app.post('/bloqueios', async (req, res) => {
    const { data, hora } = req.body;
    const barbeiro_id = req.user.id;

    try {
        await db.query(`
            INSERT INTO bloqueios (barbeiro_id, data, hora) 
            VALUES ($1, $2, $3)
        `, [barbeiro_id, data, hora]);

        res.status(201).json({ message: 'Bloqueio adicionado com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar bloqueio:', error);
        res.status(500).json({ message: 'Erro ao adicionar bloqueio' });
    }
});

app.get('/bloqueios', authenticateToken, async (req, res) => {
    const usuarioId = req.user.id;

    try {
        const { rows: [usuario] } = await db.query(`SELECT role FROM usuarios WHERE id = $1`, [usuarioId]);

        if (usuario.role !== 'barbeiro') {
            return res.status(403).json({ message: 'Acesso restrito a barbeiros' });
        }

        const { rows: bloqueios } = await db.query(
            'SELECT * FROM bloqueios WHERE barbeiro_id = $1',
            [usuarioId]
        );

        res.json(bloqueios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar bloqueios do barbeiro' });
    }
});

app.delete('/bloqueios/:id', async (req, res) => {
    const { id } = req.params;
    const barbeiro_id = req.user.id;

    try {
        await db.query(`
            DELETE FROM bloqueios 
            WHERE id = $1 AND barbeiro_id = $2`, 
        [id, barbeiro_id]);

        res.status(200).json({ message: 'Bloqueio removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover bloqueio:', error);
        res.status(500).json({ message: 'Erro ao remover bloqueio' });
    }
});

app.post('/bloqueios/dia', authenticateToken, async (req, res) => {
    const { data } = req.body;
    const usuarioId = req.user.id;

    try {
        const { rows: [usuario] } = await db.query(`SELECT role FROM usuarios WHERE id = $1`, [usuarioId]);
        if (usuario.role !== 'barbeiro') {
            return res.status(403).json({ message: 'Acesso restrito a barbeiros' });
        }

        const horas = [];
        for (let hora = 8; hora < 20; hora++) {
            horas.push(`${String(hora).padStart(2, '0')}:00:00`);
            horas.push(`${String(hora).padStart(2, '0')}:30:00`);
        }

        const { rows: bloqueiosExistentes } = await db.query(`
            SELECT hora FROM bloqueios WHERE barbeiro_id = $1 AND data = $2
        `, [usuarioId, data]);

        const horasBloqueadas = bloqueiosExistentes.map(b => b.hora);
        const horasParaBloquear = horas.filter(hora => !horasBloqueadas.includes(hora));

        if (horasParaBloquear.length === 0) {
            return res.status(400).json({ message: 'O dia já está completamente bloqueado.' });
        }

        for (const hora of horasParaBloquear) {
            await db.query(`
                INSERT INTO bloqueios (barbeiro_id, data, hora) VALUES ($1, $2, $3)
            `, [usuarioId, data, hora]);
        }

        res.status(201).json({
            message: `Dia ${data} bloqueado com sucesso.`,
            horasBloqueadas: horasParaBloquear
        });
    } catch (error) {
        console.error('Erro ao bloquear dia inteiro:', error);
        res.status(500).json({ message: 'Erro ao bloquear dia inteiro' });
    }
});

app.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
    }

    try {
        const { rows } = await db.query('SELECT id, nome, email, senha, role, created_at, roles FROM usuarios WHERE email = $1', [email]);
        const user = rows[0];
        
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        if (!user.roles || !user.roles.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado: O campo "roles" não é "admin".' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.senha);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Senha inválida." });
        }

        res.status(200).json({ isAdmin: true });
    } catch (error) {
        console.error("Erro ao tentar fazer login de admin:", error);
        res.status(500).json({ message: "Erro no servidor." });
    }
});

app.get('/admin', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
        const decoded = jwt.verify(token, secret);
        if (adminEmails.includes(decoded.email)) {
            res.sendFile(path.join(__dirname, 'public', 'admin.html'));
        } else {
            res.status(403).json({ message: 'Acesso negado' });
        }
    } catch (error) {
        console.error('Erro ao verificar token:', error);
        res.status(403).json({ message: 'Token inválido' });
    }
});

app.post('/admin/barbeiros', authenticateToken, async (req, res) => {
    const { nome, email, senha } = req.body;

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        await db.query(
            `INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, 'barbeiro')`,
            [nome, email, senha]
        );

        res.status(201).json({ message: 'Barbeiro registrado com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao registrar barbeiro' });
    }
});

app.get('/admin/barbeiros', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        const { rows: barbeiros } = await db.query(`SELECT id, nome, email FROM usuarios WHERE role = 'barbeiro'`);
        res.json(barbeiros);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar barbeiros' });
    }
});

app.delete('/admin/barbeiros/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        await db.query(`DELETE FROM usuarios WHERE id = $1 AND role = 'barbeiro'`, [id]);
        res.json({ message: 'Barbeiro excluído com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao excluir barbeiro' });
    }
});


// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});