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
}

module.exports = SubscriptionRecurrentController;
