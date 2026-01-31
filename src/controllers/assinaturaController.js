// // src/controllers/assinaturaController.js
// const assinaturaService = require('../services/assinaturaService');
// import { MercadoPagoConfig, PreapprovalPlan, Preapproval } from 'mercadopago';
// import pool from '../db.js';
// import dotenv from 'dotenv';

// dotenv.config();

// // Configurar Mercado Pago
// const client = new MercadoPagoConfig({
// accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
// });

// class AssinaturaController {

//     // ADMIN: Criar plano no Mercado Pago
//     async criarPlanoMercadoPago (req, res) => {
//     try {
//         const { nome, descricao, valor, servicos } = req.body;
//         const adminId = req.usuario.id;

//         // Verificar se é admin
//         const adminCheck = await pool.query(
//         'SELECT role FROM usuarios WHERE id = $1 AND role = $2',
//         [adminId, 'admin']
//         );

//         if (adminCheck.rows.length === 0) {
//         return res.status(403).json({ error: 'Apenas administradores podem criar planos' });
//         }

//         // Criar plano no Mercado Pago
//         const preapprovalPlan = new PreapprovalPlan(client);
//         const planData = {
//         reason: nome,
//         auto_recurring: {
//             frequency: 1,
//             frequency_type: 'months',
//             repetitions: null, // Ilimitado
//             billing_day: 10,
//             billing_day_proportional: true,
//             transaction_amount: parseFloat(valor),
//             currency_id: 'BRL'
//         },
//         back_url: `${process.env.FRONTEND_URL}/assinatura/sucesso`,
//         status: 'active'
//         };

//         const mercadoPagoPlan = await preapprovalPlan.create({ body: planData });

//         // Salvar no banco
//         const result = await pool.query(
//         `INSERT INTO assinatura (nome_plano, descricao, valor, servicos, mercado_pago_plan_id, status)
//         VALUES ($1, $2, $3, $4, $5, 'ativo')
//         RETURNING *`,
//         [nome, descricao, valor, JSON.stringify(servicos), mercadoPagoPlan.id]
//         );

//         res.status(201).json({
//         message: 'Plano criado com sucesso',
//         plano: result.rows[0],
//         mercadoPagoPlan
//         });
//     } catch (error) {
//         console.error('Erro ao criar plano:', error);
//         res.status(500).json({ error: 'Erro ao criar plano' });
//     }
//     };

//     // Listar planos disponíveis
//     export const listarPlanos = async (req, res) => {
//     try {
//         const result = await pool.query(
//         `SELECT a.*, 
//                 COUNT(au.id) as total_assinantes,
//                 ARRAY_AGG(DISTINCT s.nome_servico) as servicos_inclusos
//         FROM assinatura a
//         LEFT JOIN assinatura_servico asv ON a.id = asv.assinatura_id
//         LEFT JOIN servicos s ON asv.servico_id = s.id
//         LEFT JOIN assinaturas_usuarios au ON a.id = au.plano_id AND au.status = 'ativa'
//         WHERE a.status = 'ativo'
//         GROUP BY a.id
//         ORDER BY a.valor`
//         );

//         res.json(result.rows);
//     } catch (error) {
//         console.error('Erro ao listar planos:', error);
//         res.status(500).json({ error: 'Erro ao listar planos' });
//     }
//     };

//     // Usuário assina um plano
//     export const criarAssinatura = async (req, res) => {
//     try {
//         const { planoId } = req.params;
//         const usuarioId = req.usuario.id;
//         const { tokenCartao, email } = req.body;

//         // Buscar plano
//         const planoResult = await pool.query(
//         'SELECT * FROM assinatura WHERE id = $1 AND status = $2',
//         [planoId, 'ativo']
//         );

//         if (planoResult.rows.length === 0) {
//         return res.status(404).json({ error: 'Plano não encontrado' });
//         }

//         const plano = planoResult.rows[0];

//         // Criar pré-aprovação no Mercado Pago
//         const preapproval = new Preapproval(client);
        
//         const assinaturaData = {
//         preapproval_plan_id: plano.mercado_pago_plan_id,
//         payer_email: email || req.usuario.email,
//         card_token_id: tokenCartao,
//         status: 'authorized',
//         reason: plano.nome_plano,
//         external_reference: `usuario_${usuarioId}_plano_${planoId}`
//         };

//         const mercadoPagoSubscription = await preapproval.create({ body: assinaturaData });

//         // Iniciar transação no banco
//         const clientDB = await pool.connect();
        
//         try {
//         await clientDB.query('BEGIN');

//         // Criar assinatura do usuário
//         const dataInicio = new Date();
//         const proximaCobranca = new Date(dataInicio);
//         proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);

//         const assinaturaUsuario = await clientDB.query(
//             `INSERT INTO assinaturas_usuarios 
//             (usuario_id, plano_id, status, data_inicio, proxima_cobranca, mercado_pago_subscription_id)
//             VALUES ($1, $2, $3, $4, $5, $6)
//             RETURNING *`,
//             [usuarioId, planoId, 'ativa', dataInicio, proximaCobranca, mercadoPagoSubscription.id]
//         );

//         // Atualizar usuário para assinante
//         await clientDB.query(
//             'UPDATE usuarios SET assinante = true, assinatura_id = $1 WHERE id = $2',
//             [assinaturaUsuario.rows[0].id, usuarioId]
//         );

//         // Criar registro de pagamento recorrente
//         await clientDB.query(
//             `INSERT INTO assinaturas_pagamentos_recorrentes
//             (usuario_id, assinatura_usuario_id, plano_id, mercado_pago_subscription_id, valor_mensal, proxima_cobranca, status)
//             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
//             [
//             usuarioId,
//             assinaturaUsuario.rows[0].id,
//             planoId,
//             mercadoPagoSubscription.id,
//             plano.valor,
//             proximaCobranca,
//             'ativa'
//             ]
//         );

//         await clientDB.query('COMMIT');

//         res.status(201).json({
//             message: 'Assinatura criada com sucesso',
//             assinatura: assinaturaUsuario.rows[0],
//             redirectUrl: mercadoPagoSubscription.init_point || null
//         });

//         } catch (error) {
//         await clientDB.query('ROLLBACK');
//         throw error;
//         } finally {
//         clientDB.release();
//         }

//     } catch (error) {
//         console.error('Erro ao criar assinatura:', error);
        
//         // Tentar cancelar no Mercado Pago se falhou
//         if (req.body.tokenCartao) {
//         try {
//             const preapproval = new Preapproval(client);
//             await preapproval.cancel({ id: error.subscriptionId });
//         } catch (cancelError) {
//             console.error('Erro ao cancelar assinatura no Mercado Pago:', cancelError);
//         }
//         }
        
//         res.status(500).json({ 
//         error: 'Erro ao criar assinatura',
//         details: error.message 
//         });
//     }
//     };

//     // Cancelar assinatura
//     export const cancelarAssinatura = async (req, res) => {
//     try {
//         const { assinaturaId } = req.params;
//         const usuarioId = req.usuario.id;

//         // Buscar assinatura
//         const assinaturaResult = await pool.query(
//         `SELECT au.*, a.mercado_pago_plan_id, apr.mercado_pago_subscription_id
//         FROM assinaturas_usuarios au
//         JOIN assinatura a ON au.plano_id = a.id
//         LEFT JOIN assinaturas_pagamentos_recorrentes apr ON au.id = apr.assinatura_usuario_id
//         WHERE au.id = $1 AND au.usuario_id = $2 AND au.status = 'ativa'`,
//         [assinaturaId, usuarioId]
//         );

//         if (assinaturaResult.rows.length === 0) {
//         return res.status(404).json({ error: 'Assinatura não encontrada' });
//         }

//         const assinatura = assinaturaResult.rows[0];

//         // Cancelar no Mercado Pago
//         if (assinatura.mercado_pago_subscription_id) {
//         const preapproval = new Preapproval(client);
//         await preapproval.update({
//             id: assinatura.mercado_pago_subscription_id,
//             body: { status: 'cancelled' }
//         });
//         }

//         // Atualizar no banco
//         await pool.query(
//         `UPDATE assinaturas_usuarios 
//         SET status = 'cancelado', data_fim = CURRENT_DATE
//         WHERE id = $1`,
//         [assinaturaId]
//         );

//         await pool.query(
//         `UPDATE assinaturas_pagamentos_recorrentes
//         SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP
//         WHERE assinatura_usuario_id = $1`,
//         [assinaturaId]
//         );

//         await pool.query(
//         'UPDATE usuarios SET assinante = false WHERE id = $1',
//         [usuarioId]
//         );

//         res.json({ message: 'Assinatura cancelada com sucesso' });
//     } catch (error) {
//         console.error('Erro ao cancelar assinatura:', error);
//         res.status(500).json({ error: 'Erro ao cancelar assinatura' });
//     }
//     };

//     // Reativar assinatura
//     export const reativarAssinatura = async (req, res) => {
//     try {
//         const { assinaturaId } = req.params;
//         const usuarioId = req.usuario.id;

//         // Buscar assinatura cancelada
//         const assinaturaResult = await pool.query(
//         `SELECT au.*, a.mercado_pago_plan_id, apr.mercado_pago_subscription_id
//         FROM assinaturas_usuarios au
//         JOIN assinatura a ON au.plano_id = a.id
//         LEFT JOIN assinaturas_pagamentos_recorrentes apr ON au.id = apr.assinatura_usuario_id
//         WHERE au.id = $1 AND au.usuario_id = $2 AND au.status = 'cancelado'`,
//         [assinaturaId, usuarioId]
//         );

//         if (assinaturaResult.rows.length === 0) {
//         return res.status(404).json({ error: 'Assinatura cancelada não encontrada' });
//         }

//         const assinatura = assinaturaResult.rows[0];

//         // Reativar no Mercado Pago
//         if (assinatura.mercado_pago_subscription_id) {
//         const preapproval = new Preapproval(client);
//         await preapproval.update({
//             id: assinatura.mercado_pago_subscription_id,
//             body: { status: 'authorized' }
//         });
//         }

//         // Calcular próxima cobrança
//         const proximaCobranca = new Date();
//         proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);

//         // Atualizar no banco
//         await pool.query(
//         `UPDATE assinaturas_usuarios 
//         SET status = 'ativa', data_fim = NULL, proxima_cobranca = $1
//         WHERE id = $2`,
//         [proximaCobranca, assinaturaId]
//         );

//         await pool.query(
//         `UPDATE assinaturas_pagamentos_recorrentes
//         SET status = 'ativa', cancelado_em = NULL, proxima_cobranca = $1
//         WHERE assinatura_usuario_id = $2`,
//         [proximaCobranca, assinaturaId]
//         );

//         await pool.query(
//         'UPDATE usuarios SET assinante = true WHERE id = $1',
//         [usuarioId]
//         );

//         res.json({ message: 'Assinatura reativada com sucesso' });
//     } catch (error) {
//         console.error('Erro ao reativar assinatura:', error);
//         res.status(500).json({ error: 'Erro ao reativar assinatura' });
//     }
//     };

//     // Minhas assinaturas
//     export const minhasAssinaturas = async (req, res) => {
//     try {
//         const usuarioId = req.usuario.id;

//         const result = await pool.query(
//         `SELECT au.*, a.nome_plano, a.descricao, a.valor,
//                 apr.mercado_pago_subscription_id, apr.proxima_cobranca as proxima_cobranca_pagamento,
//                 (SELECT COUNT(*) FROM agendamentos ag WHERE ag.assinatura_usuario_id = au.id) as total_agendamentos
//         FROM assinaturas_usuarios au
//         JOIN assinatura a ON au.plano_id = a.id
//         LEFT JOIN assinaturas_pagamentos_recorrentes apr ON au.id = apr.assinatura_usuario_id
//         WHERE au.usuario_id = $1
//         ORDER BY au.created_at DESC`,
//         [usuarioId]
//         );

//         res.json(result.rows);
//     } catch (error) {
//         console.error('Erro ao buscar assinaturas:', error);
//         res.status(500).json({ error: 'Erro ao buscar assinaturas' });
//     }
//     };

//     // Detalhes da assinatura
//     export const obterDetalhesAssinatura = async (req, res) => {
//     try {
//         const { assinaturaId } = req.params;
//         const usuarioId = req.usuario.id;

//         const result = await pool.query(
//         `SELECT au.*, a.nome_plano, a.descricao, a.valor, a.servicos,
//                 apr.mercado_pago_subscription_id, apr.valor_mensal, apr.proxima_cobranca,
//                 apr.ultima_cobranca, apr.cancelado_em,
//                 (SELECT json_agg(json_build_object(
//                     'nome', s.nome_servico,
//                     'descricao', s.descricao,
//                     'valor', s.valor_servico
//                 )) FROM assinatura_servico asv
//                     JOIN servicos s ON asv.servico_id = s.id
//                     WHERE asv.assinatura_id = a.id) as servicos_detalhados
//         FROM assinaturas_usuarios au
//         JOIN assinatura a ON au.plano_id = a.id
//         LEFT JOIN assinaturas_pagamentos_recorrentes apr ON au.id = apr.assinatura_usuario_id
//         WHERE au.id = $1 AND au.usuario_id = $2`,
//         [assinaturaId, usuarioId]
//         );

//         if (result.rows.length === 0) {
//         return res.status(404).json({ error: 'Assinatura não encontrada' });
//         }

//         res.json(result.rows[0]);
//     } catch (error) {
//         console.error('Erro ao buscar detalhes:', error);
//         res.status(500).json({ error: 'Erro ao buscar detalhes da assinatura' });
//     }
//     };

//     // Listar cobranças
//     export const listarCobrancas = async (req, res) => {
//     try {
//         const { assinaturaId } = req.params;
//         const usuarioId = req.usuario.id;

//         // Verificar se a assinatura pertence ao usuário
//         const verificar = await pool.query(
//         'SELECT id FROM assinaturas_usuarios WHERE id = $1 AND usuario_id = $2',
//         [assinaturaId, usuarioId]
//         );

//         if (verificar.rows.length === 0) {
//         return res.status(403).json({ error: 'Acesso negado' });
//         }

//         const result = await pool.query(
//         `SELECT ahc.*, apr.mercado_pago_subscription_id
//         FROM assinaturas_historico_cobrancas ahc
//         JOIN assinaturas_pagamentos_recorrentes apr ON ahc.assinatura_pagamento_id = apr.id
//         WHERE apr.assinatura_usuario_id = $1
//         ORDER BY ahc.data_cobranca DESC
//         LIMIT 20`,
//         [assinaturaId]
//         );

//         res.json(result.rows);
//     } catch (error) {
//         console.error('Erro ao listar cobranças:', error);
//         res.status(500).json({ error: 'Erro ao listar cobranças' });
//     }
//     };

//     // Atualizar método de pagamento
//     export const atualizarMetodoPagamento = async (req, res) => {
//     try {
//         const { assinaturaId } = req.params;
//         const usuarioId = req.usuario.id;
//         const { tokenCartao } = req.body;

//         // Buscar assinatura
//         const assinaturaResult = await pool.query(
//         `SELECT au.*, apr.mercado_pago_subscription_id
//         FROM assinaturas_usuarios au
//         LEFT JOIN assinaturas_pagamentos_recorrentes apr ON au.id = apr.assinatura_usuario_id
//         WHERE au.id = $1 AND au.usuario_id = $2 AND au.status = 'ativa'`,
//         [assinaturaId, usuarioId]
//         );

//         if (assinaturaResult.rows.length === 0) {
//         return res.status(404).json({ error: 'Assinatura não encontrada' });
//         }

//         const assinatura = assinaturaResult.rows[0];

//         // Atualizar cartão no Mercado Pago
//         if (assinatura.mercado_pago_subscription_id) {
//         const preapproval = new Preapproval(client);
//         await preapproval.update({
//             id: assinatura.mercado_pago_subscription_id,
//             body: { card_token_id: tokenCartao }
//         });
//         }

//         // Salvar token do cartão no banco
//         if (tokenCartao) {
//         await pool.query(
//             `INSERT INTO cliente_cartoes (usuario_id, token_cartao, status)
//             VALUES ($1, $2, 'ativo')
//             ON CONFLICT (usuario_id) 
//             DO UPDATE SET token_cartao = $2, atualizado_em = CURRENT_TIMESTAMP`,
//             [usuarioId, tokenCartao]
//         );
//         }

//         res.json({ message: 'Método de pagamento atualizado com sucesso' });
//     } catch (error) {
//         console.error('Erro ao atualizar pagamento:', error);
//         res.status(500).json({ error: 'Erro ao atualizar método de pagamento' });
//     }
//     };

//     // Webhook Mercado Pago
//     export const webhookMercadoPago = async (req, res) => {
//     try {
//         const { type, data } = req.body;

//         // Verificar assinatura
//         if (type === 'subscription_authorized_payment') {
//         const { id } = data;

//         // Buscar detalhes do pagamento no Mercado Pago
//         const preapproval = new Preapproval(client);
//         const subscription = await preapproval.get({ id });

//         // Atualizar status no banco
//         if (subscription.status === 'authorized') {
//             await pool.query(
//             `UPDATE assinaturas_pagamentos_recorrentes 
//             SET status = 'ativa', ultima_cobranca = CURRENT_DATE,
//                 proxima_cobranca = CURRENT_DATE + INTERVAL '1 month'
//             WHERE mercado_pago_subscription_id = $1`,
//             [id]
//             );

//             // Registrar cobrança
//             await pool.query(
//             `INSERT INTO assinaturas_historico_cobrancas
//             (assinatura_pagamento_id, usuario_id, valor, status, 
//                 mercado_pago_payment_id, data_cobranca, data_processamento)
//             SELECT id, usuario_id, valor_mensal, 'pago', $2, CURRENT_DATE, CURRENT_TIMESTAMP
//             FROM assinaturas_pagamentos_recorrentes
//             WHERE mercado_pago_subscription_id = $1`,
//             [id, data.payment_id]
//             );
//         }
//         } else if (type === 'subscription_preapproval') {
//         // Atualizar status da assinatura
//         const { id, status } = data;

//         let statusBanco = 'ativa';
//         if (status === 'cancelled') statusBanco = 'cancelado';
//         if (status === 'pending') statusBanco = 'pendente';
//         if (status === 'paused') statusBanco = 'suspenso';

//         await pool.query(
//             `UPDATE assinaturas_pagamentos_recorrentes 
//             SET status = $1
//             WHERE mercado_pago_subscription_id = $2`,
//             [statusBanco, id]
//         );

//         // Atualizar status do usuário
//         if (status === 'cancelled') {
//             await pool.query(
//             `UPDATE usuarios u
//             SET assinante = false
//             FROM assinaturas_pagamentos_recorrentes apr
//             WHERE apr.mercado_pago_subscription_id = $1 
//             AND apr.usuario_id = u.id`,
//             [id]
//             );
//         }
//         }

//         res.sendStatus(200);
//     } catch (error) {
//         console.error('Erro no webhook:', error);
//         res.sendStatus(500);
//     }
//     }
// }

// module.exports = new AssinaturaController();