const express = require('express'); 
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./auth'); // Arquivo que contém as rotas de autenticação
const path = require('path');
const app = express();
const port = 3000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        const placeholders = adminEmails.map(() => '?').join(', ');
        const query = `UPDATE usuarios SET roles = 'admin' WHERE email IN (${placeholders})`;
        await db.query(query, adminEmails);
        console.log('Admin roles updated successfully!');
    } catch (error) {
        console.error('Error updating admin roles:', error);
    }
}

// Execute a função ao iniciar o servidor
updateAdminRoles();



// Rota para adicionar usuário e verificar roles
app.post('/register', async (req, res) => {
    const { nome, email, password } = req.body;

    try {
        // Verifica se o usuário já existe
        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (rows.length > 0) {
            return res.status(400).json({ message: 'Usuário já registrado' });
        }

        // Criptografa a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Define roles com base no e-mail
        let roles = [];
        if (adminEmails.includes(email)) {
            roles.push('admin');
        }

        // Insere o usuário no banco de dados
        await db.query('INSERT INTO usuarios (nome, email, senha, roles) VALUES (?, ?, ?, ?)', [
            nome, email, hashedPassword, JSON.stringify(roles)
        ]);

        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
});

// Rota para registro de barbeiros
app.post('/registrar-barbeiro', async (req, res) => {
    const { nome, email, senha } = req.body;
    console.log('Recebido POST para registrar barbeiro:', req.body);

    try {
        // Verifica se o email já existe no banco de dados
        const [result] = await db.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
        
        if (result.length > 0) {
            console.log('Email já registrado');
            return res.status(400).send({ mensagem: 'Email já registrado' });
        }

        // Gera o hash da senha de forma assíncrona para evitar bloqueio de operações
        const senhaHash = await bcrypt.hash(senha, 8);
        console.log('Hash da senha gerado:', senhaHash);

        // Insere o barbeiro no banco de dados
        await db.execute(
            'INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)',
            [nome, email, senhaHash, 'barbeiro']
        );
        console.log('Barbeiro registrado com sucesso');
        res.status(201).send({ mensagem: 'Barbeiro registrado com sucesso!' });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).send({ erro: 'Erro ao registrar barbeiro' });
    }
});


// Rota para registro (se não estiver usando o arquivo auth.js para isso)
app.post('/registrar', (req, res) => {
    const { nome, email, senha } = req.body;

    // Verifica se o email já existe no banco de dados
    db.query('SELECT * FROM usuarios WHERE email = ?', [email], (err, result) => {
        if (err) return res.status(500).send({ erro: err });
        if (result.length > 0) {
            return res.status(400).send({ mensagem: 'Email já registrado' });
        }

        // Gera o hash da senha
        const senhaHash = bcrypt.hashSync(senha, 8); // 8 é o custo de processamento do bcrypt

        // Define roles com base na lista de e-mails autorizados
        const roles = adminEmails.includes(email) ? JSON.stringify(['admin']) : JSON.stringify([]);

        // Insere novo usuário com a senha criptografada e roles
        db.query(
            'INSERT INTO usuarios (nome, email, senha, roles) VALUES (?, ?, ?, ?)',
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
        await db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [hashedPassword, decoded.id]);

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
        res.send({ id: decoded.id, role: decoded.role });
    } catch (err) {
        res.status(401).send({ mensagem: 'Token inválido' });
    }
});


// Rota para obter a lista de barbeiros
app.get('/barbeiros', async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM usuarios WHERE role = 'barbeiro'"); // Filtra apenas os barbeiros
        res.status(200).json(results);
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
        const [results] = await db.execute(`
            SELECT * FROM agendamentos 
            WHERE barbeiro_id = ? 
            AND data_agendada = ? 
            AND hora_agendada = ?
        `, [barbeiro_id, data_agendada, hora_agendada]);

        console.log('Resultado da verificação de horário:', results);

        if (results.length > 0) {
            return res.status(400).json({ message: 'Horário já agendado para este barbeiro' });
        }

        // Caso não exista conflito, procede com o agendamento
        const [insertResult] = await db.execute(`
            INSERT INTO agendamentos (usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada) 
            VALUES (?, ?, ?, ?, ?)
        `, [usuario_id, barbeiro_id, servico_id, data_agendada, hora_agendada]);

        console.log('Agendamento salvo com sucesso:', insertResult);
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
        const [agendamentos] = await db.execute(`
            SELECT hora_agendada 
            FROM agendamentos 
            WHERE barbeiro_id = ? AND data_agendada = ?
        `, [id, data_agendada]);

        console.log('Horários agendados encontrados:', agendamentos);

        // 2. Obter os horários bloqueados
        const [bloqueios] = await db.execute(`
            SELECT hora 
            FROM bloqueios 
            WHERE barbeiro_id = ? AND data = ?
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
      const [rows] = await db.execute('SELECT * FROM servicos');
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
    const hoje = new Date().toISOString().split('T')[0]; // Obtém a data atual no formato YYYY-MM-DD

    try {
        // Verifica se o usuário é um barbeiro
        const [[usuario]] = await db.query(`SELECT role FROM usuarios WHERE id = ?`, [usuarioId]);

        if (!usuario || usuario.role !== 'barbeiro') {
            return res.status(403).json({ message: 'Acesso restrito a barbeiros' });
        }

        // Consulta modificada para filtrar agendamentos futuros
        const [agendamentos] = await db.query(
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
            WHERE agendamentos.barbeiro_id = ?
            AND (agendamentos.data_agendada > ? OR 
                (agendamentos.data_agendada = ? AND agendamentos.hora_agendada >= TIME(NOW())))
            ORDER BY agendamentos.data_agendada ASC, agendamentos.hora_agendada ASC`, 
            [usuarioId, hoje, hoje]
        );

        res.json({ agendamentos: agendamentos || [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar agendamentos' });
    }
});


// Rota para adicionar um bloqueio
app.post('/bloqueios', async (req, res) => {
    const { data, hora } = req.body;
    const barbeiro_id = req.user.id;

    try {
        await db.execute(`
            INSERT INTO bloqueios (barbeiro_id, data, hora) 
            VALUES (?, ?, ?)
        `, [barbeiro_id, data, hora]);

        res.status(201).json({ message: 'Bloqueio adicionado com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar bloqueio:', error);
        res.status(500).json({ message: 'Erro ao adicionar bloqueio' });
    }
});


// Rota para obter bloqueios do barbeiro autenticado
app.get('/bloqueios', authenticateToken, async (req, res) => {
    const usuarioId = req.user.id;

    try {
        // Verifica se o usuário é um barbeiro
        const [[usuario]] = await db.query(`SELECT role FROM usuarios WHERE id = ?`, [usuarioId]);

        if (usuario.role !== 'barbeiro') {
            return res.status(403).json({ message: 'Acesso restrito a barbeiros' });
        }

        // Consulta para buscar bloqueios do barbeiro autenticado
        const [bloqueios] = await db.query(
            'SELECT * FROM bloqueios WHERE barbeiro_id = ?',
            [usuarioId]
        );

        res.json(bloqueios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar bloqueios do barbeiro' });
    }
});


// Rota para remover um bloqueio
app.delete('/bloqueios/:id', async (req, res) => {
    const { id } = req.params;
    const barbeiro_id = req.user.id;

    try {
        await db.execute(`
            DELETE FROM bloqueios 
            WHERE id = ? AND barbeiro_id = ?`, 
        [id, barbeiro_id]);

        res.status(200).json({ message: 'Bloqueio removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover bloqueio:', error);
        res.status(500).json({ message: 'Erro ao remover bloqueio' });
    }
});

// Rota para bloquear um dia inteiro
app.post('/bloqueios/dia', authenticateToken, async (req, res) => {
    const { data } = req.body; // A data a ser bloqueada no formato YYYY-MM-DD
    const usuarioId = req.user.id;

    try {
        // Verifica se o usuário é um barbeiro
        const [[usuario]] = await db.query(`SELECT role FROM usuarios WHERE id = ?`, [usuarioId]);
        if (usuario.role !== 'barbeiro') {
            return res.status(403).json({ message: 'Acesso restrito a barbeiros' });
        }

        // Define o intervalo de horas para o dia (ex.: 08:00 às 20:00) com intervalos de 30 minutos
        const horas = [];
        for (let hora = 8; hora < 20; hora++) {
            horas.push(`${String(hora).padStart(2, '0')}:00:00`);
            horas.push(`${String(hora).padStart(2, '0')}:30:00`);
        }

        // Verifica se já existem bloqueios para a data e horas especificadas
        const [bloqueiosExistentes] = await db.query(`
            SELECT hora FROM bloqueios WHERE barbeiro_id = ? AND data = ?
        `, [usuarioId, data]);

        const horasBloqueadas = bloqueiosExistentes.map(b => b.hora);

        // Filtra as horas que ainda não estão bloqueadas
        const horasParaBloquear = horas.filter(hora => !horasBloqueadas.includes(hora));

        // Caso todas as horas já estejam bloqueadas
        if (horasParaBloquear.length === 0) {
            return res.status(400).json({ message: 'O dia já está completamente bloqueado.' });
        }

        // Insere os bloqueios no banco de dados
        const values = horasParaBloquear.map(hora => [usuarioId, data, hora]);
        await db.query(`
            INSERT INTO bloqueios (barbeiro_id, data, hora) VALUES ?
        `, [values]);

        res.status(201).json({
            message: `Dia ${data} bloqueado com sucesso.`,
            horasBloqueadas: horasParaBloquear
        });
    } catch (error) {
        console.error('Erro ao bloquear dia inteiro:', error);
        res.status(500).json({ message: 'Erro ao bloquear dia inteiro' });
    }
});




// Rota de login para administradores
app.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;
    console.log("Email recebido:", email);
    console.log("Senha recebida:", password);

    if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
    }

    try {
        // Obtenha o usuário com base no email fornecido
        const result = await db.query('SELECT id, nome, email, senha, role, created_at, roles FROM usuarios WHERE email = ?', [email]);

        // Verificando o retorno da consulta - o resultado é um array de arrays
        console.log("Resultado da consulta:", result);

        // Aqui, acessamos o primeiro item do array
        const user = result[0][0];  // Acessando o primeiro item do array que é o objeto do usuário
        if (!user) {
            console.log("Usuário não encontrado.");
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        console.log("Usuário encontrado:", user);

        // Verificando o campo 'roles'
        console.log("Verificando o campo 'roles':", user.roles);

        // Verificação se a role é 'admin'
        if (user && user.roles && user.roles.trim() === 'admin') {
            // O usuário tem a role admin
            console.log("Login de administrador bem-sucedido.");
            // Continue o fluxo de login para admin aqui
        } else {
            console.log("Acesso negado: O campo 'roles' não é 'admin'.");
            return res.status(403).json({ message: 'Acesso negado: O campo "roles" não é "admin".' });
        }

        // Comparar a senha com a senha armazenada
        const isPasswordValid = await bcrypt.compare(password, user.senha); // Comparar a senha
        if (!isPasswordValid) {
            console.log("Senha inválida.");
            return res.status(401).json({ message: "Senha inválida." });
        }

        // Se a senha estiver correta
        console.log("Login de administrador bem-sucedido.");
        res.status(200).json({ isAdmin: true });
    } catch (error) {
        console.error("Erro ao tentar fazer login de admin:", error);
        res.status(500).json({ message: "Erro no servidor." });
    }
});






// Protege a rota de administrador (página admin.html)
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


// Rota para registrar um novo barbeiro
app.post('/admin/barbeiros', authenticateToken, async (req, res) => {
    const { nome, email, senha } = req.body;

    try {
        // Verifica se o usuário atual é um administrador
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        // Insere o novo barbeiro no banco de dados
        await db.query(
            `INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, 'barbeiro')`,
            [nome, email, senha]
        );

        res.status(201).json({ message: 'Barbeiro registrado com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao registrar barbeiro' });
    }
});


// Rota para listar todos os barbeiros
app.get('/admin/barbeiros', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        const [barbeiros] = await db.query(`SELECT id, nome, email FROM usuarios WHERE role = 'barbeiro'`);
        res.json(barbeiros);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar barbeiros' });
    }
});


// Rota para excluir um barbeiro
app.delete('/admin/barbeiros/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        await db.query(`DELETE FROM usuarios WHERE id = ? AND role = 'barbeiro'`, [id]);
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