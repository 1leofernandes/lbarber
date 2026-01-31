// src/controllers/subscriptionRecurrentController.js
const subscriptionRecurrentService = require('../services/subscriptionRecurrentService');
const logger = require('../utils/logger');

class SubscriptionRecurrentController {
    // ==================== CARTÕES ====================

    static async adicionarCartao(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const { numeroCartao, mesValidade, anoValidade, codigoSeguranca, nomeTitular } = req.body;

            // Validar dados obrigatórios
            if (!numeroCartao || !mesValidade || !anoValidade || !codigoSeguranca || !nomeTitular) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados de cartão incompletos'
                });
            }

            const cartao = await subscriptionRecurrentService.saveCartaoCliente(usuarioId, {
                numeroCartao,
                mesValidade,
                anoValidade,
                codigoSeguranca,
                nomeTitular
            });

            res.status(201).json({
                success: true,
                message: 'Cartão adicionado com sucesso',
                cartao
            });
        } catch (error) {
            logger.error('Erro ao adicionar cartão:', error);
            next(error);
        }
    }

    static async listarCartoes(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const cartoes = await subscriptionRecurrentService.getCartoesPorUsuario(usuarioId);

            res.json({
                success: true,
                cartoes
            });
        } catch (error) {
            logger.error('Erro ao listar cartões:', error);
            next(error);
        }
    }

    static async deletarCartao(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const { cartaoId } = req.params;

            if (!cartaoId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do cartão obrigatório'
                });
            }

            await subscriptionRecurrentService.deleteCartao(parseInt(cartaoId), usuarioId);

            res.json({
                success: true,
                message: 'Cartão deletado com sucesso'
            });
        } catch (error) {
            logger.error('Erro ao deletar cartão:', error);
            next(error);
        }
    }

    // ==================== ASSINATURAS RECORRENTES ====================

    static async criarAssinatura(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const { assinaturaUsuarioId, planoId, cartaoId } = req.body;

            if (!assinaturaUsuarioId || !planoId || !cartaoId) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados de assinatura incompletos'
                });
            }

            // Buscar dados do usuário para Mercado Pago
            const pool = require('../config/database');
            const usuario = await pool.query(
                'SELECT email, nome FROM usuarios WHERE id = $1',
                [usuarioId]
            );

            if (usuario.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuário não encontrado'
                });
            }

            const { email, nome } = usuario.rows[0];

            const assinatura = await subscriptionRecurrentService.criarAssinaturaRecorrente(
                usuarioId,
                assinaturaUsuarioId,
                planoId,
                cartaoId,
                email,
                nome
            );

            res.status(201).json({
                success: true,
                message: 'Assinatura recorrente criada com sucesso',
                assinatura
            });
        } catch (error) {
            logger.error('Erro ao criar assinatura:', error);
            next(error);
        }
    }

    static async getMinhaAssinatura(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const assinatura = await subscriptionRecurrentService.getAssinaturaRecorrentePorUsuario(usuarioId);

            res.json({
                success: true,
                assinatura: assinatura || null
            });
        } catch (error) {
            logger.error('Erro ao buscar assinatura:', error);
            next(error);
        }
    }

    static async cancelarAssinatura(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const { assinaturaRecurrenteId } = req.params;
            const { motivo } = req.body;

            if (!assinaturaRecurrenteId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID da assinatura obrigatório'
                });
            }

            const resultado = await subscriptionRecurrentService.cancelarAssinatura(
                parseInt(assinaturaRecurrenteId),
                usuarioId,
                motivo || 'Cancelado pelo cliente'
            );

            res.json({
                success: true,
                message: 'Assinatura cancelada com sucesso',
                resultado
            });
        } catch (error) {
            logger.error('Erro ao cancelar assinatura:', error);
            next(error);
        }
    }

    // ==================== HISTÓRICO DE COBRANÇAS ====================
    static async listPlanos(req, res, next) {
        try {
            const pool = require('../config/database');
            const resultado = await pool.query(`
                SELECT id, valor, servicos, nome_plano, descricao, mercado_pago_plan_id
                FROM assinatura
                WHERE status = 'ativo'
                ORDER BY valor
            `);

            res.json({ success: true, planos: resultado.rows });
        } catch (error) {
            logger.error('Erro ao listar planos:', error);
            next(error);
        }
    }

    static async checkout(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const { planoId } = req.body;

            if (!planoId) {
                return res.status(400).json({ success: false, message: 'planoId é obrigatório' });
            }

            const pool = require('../config/database');
            const planoRes = await pool.query('SELECT id, valor, nome_plano, mercado_pago_plan_id FROM assinatura WHERE id = $1 AND status = $2', [planoId, 'ativo']);

            if (planoRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Plano não encontrado' });
            }

            const plano = planoRes.rows[0];

            // Buscar email do usuário
            const usuarioRes = await pool.query('SELECT email, nome FROM usuarios WHERE id = $1', [usuarioId]);
            if (usuarioRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
            }

            const usuario = usuarioRes.rows[0];

            // Criar preapproval no Mercado Pago usando wrapper
            const mp = require('../config/mercadoPago');
            const backUrl = (process.env.FRONTEND_URL || 'https://barbeariasilva.vercel.app') + '/minha-assinatura.html?subscription_result=success';

            const pre = await mp.createPreapproval({
                reason: plano.nome_plano || `Assinatura #${plano.id}`,
                transaction_amount: plano.valor,
                payer_email: usuario.email,
                back_url: backUrl,
                external_reference: `usuario_${usuarioId}_plano_${plano.id}`
            });

            // Retornar URL de redirecionamento ao cliente
            const redirectUrl = pre.init_point || pre.sandbox_init_point || null;

            if (!redirectUrl) {
                return res.status(500).json({ success: false, message: 'Não foi possível obter URL de redirecionamento do Mercado Pago', details: pre });
            }

            res.json({ success: true, redirectUrl, preapproval: pre });
        } catch (error) {
            logger.error('Erro no checkout de assinatura:', error);
            next(error);
        }
    }
    static async getHistoricoCobrancas(req, res, next) {
        try {
            const usuarioId = req.user.id;
            const { limit = 20, offset = 0 } = req.query;

            const historico = await subscriptionRecurrentService.getHistoricoCobrancas(
                usuarioId,
                parseInt(limit),
                parseInt(offset)
            );

            res.json({
                success: true,
                historico
            });
        } catch (error) {
            logger.error('Erro ao buscar histórico de cobranças:', error);
            next(error);
        }
    }


    // Rota para minhas assinaturas
    static async minhasAssinaturas(req, res) {
        try {
            const usuarioId = req.user.id;
            
            const pool = require('../config/database');
            const result = await pool.query(
                `SELECT au.*, a.nome_plano, a.descricao, a.valor,
                        apr.mercado_pago_subscription_id, apr.proxima_cobranca,
                        (SELECT COUNT(*) FROM agendamentos ag WHERE ag.assinatura_usuario_id = au.id) as total_agendamentos
                FROM assinaturas_usuarios au
                JOIN assinatura a ON au.plano_id = a.id
                LEFT JOIN assinaturas_pagamentos_recorrentes apr ON au.id = apr.assinatura_usuario_id
                WHERE au.usuario_id = $1
                ORDER BY au.created_at DESC`,
                [usuarioId]
            );
            
            res.json(result.rows);
        } catch (error) {
            console.error('Erro ao buscar assinaturas:', error);
            res.status(500).json({ error: 'Erro ao buscar assinaturas' });
        }
    }

    // Adicione ao subscriptionRecurrentController.js
    static async confirmarAssinatura(req, res) {
        try {
            const usuarioId = req.user.id;
            const { preapprovalId } = req.body;
            
            if (!preapprovalId) {
                return res.status(400).json({ success: false, message: 'preapprovalId é obrigatório' });
            }
            
            const mp = require('../config/mercadoPago');
            const detalhes = await mp.getSubscription(preapprovalId);
            
            // ... lógica para criar/atualizar assinatura local ...
            
            res.json({ success: true, message: 'Assinatura confirmada' });
        } catch (error) {
            logger.error('Erro ao confirmar assinatura:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    static async confirmarAssinaturaManual(req, res) {
        try {
            const { preapprovalId } = req.body;
            const usuarioId = req.user.id;
            
            if (!preapprovalId) {
                return res.status(400).json({ success: false, message: 'preapprovalId é obrigatório' });
            }
            
            // Buscar detalhes da assinatura no Mercado Pago
            const mp = require('../config/mercadoPago');
            const detalhes = await mp.getSubscription(preapprovalId);
            
            if (!detalhes) {
                return res.status(404).json({ success: false, message: 'Assinatura não encontrada no Mercado Pago' });
            }
            
            const externalReference = detalhes.external_reference;
            if (!externalReference) {
                return res.status(400).json({ success: false, message: 'Assinatura sem external_reference' });
            }
            
            const match = externalReference.match(/usuario_(\d+)_plano_(\d+)/);
            if (!match) {
                return res.status(400).json({ success: false, message: 'External reference em formato inválido' });
            }
            
            const usuarioIdRef = parseInt(match[1]);
            const planoId = parseInt(match[2]);
            
            // Verificar se o usuário é o dono da assinatura
            if (usuarioIdRef !== usuarioId) {
                return res.status(403).json({ success: false, message: 'Esta assinatura não pertence a você' });
            }
            
            // Processar assinatura manualmente
            if (detalhes.status === 'authorized' || detalhes.status === 'active') {
                // Buscar plano
                const planoRes = await pool.query(
                    'SELECT id, valor FROM assinatura WHERE id = $1',
                    [planoId]
                );
                
                if (planoRes.rows.length === 0) {
                    return res.status(404).json({ success: false, message: 'Plano não encontrado' });
                }
                
                const plano = planoRes.rows[0];
                
                await pool.query('BEGIN');
                
                // Criar assinatura do usuário
                const insertUsuarioAssinatura = await pool.query(
                    `INSERT INTO assinaturas_usuarios 
                    (usuario_id, plano_id, status, data_inicio, proxima_cobranca, created_at)
                    VALUES ($1, $2, 'ativa', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_TIMESTAMP) 
                    RETURNING *`,
                    [usuarioId, planoId]
                );
                
                const assinaturaUsuarioId = insertUsuarioAssinatura.rows[0].id;
                
                // Criar assinatura recorrente
                const insertRecorrente = await pool.query(
                    `INSERT INTO assinaturas_pagamentos_recorrentes
                    (usuario_id, assinatura_usuario_id, plano_id, mercado_pago_subscription_id, 
                    valor_mensal, proxima_cobranca, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '30 days', 'ativa', CURRENT_TIMESTAMP) 
                    RETURNING *`,
                    [usuarioId, assinaturaUsuarioId, planoId, preapprovalId, plano.valor]
                );
                
                // Atualizar usuário
                await pool.query(
                    `UPDATE usuarios 
                    SET assinante = true, 
                        assinatura_id = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2`,
                    [assinaturaUsuarioId, usuarioId]
                );
                
                await pool.query('COMMIT');
                
                logger.info('Assinatura confirmada manualmente:', { usuarioId, preapprovalId });
                
                return res.json({ 
                    success: true, 
                    message: 'Assinatura confirmada com sucesso',
                    assinatura: insertRecorrente.rows[0]
                });
            } else {
                return res.status(400).json({ 
                    success: false, 
                    message: `Assinatura com status inválido: ${detalhes.status}` 
                });
            }
            
        } catch (error) {
            logger.error('Erro ao confirmar assinatura manualmente:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = SubscriptionRecurrentController;
