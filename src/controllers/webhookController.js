// src/controllers/webhookController.js
const pool = require('../config/database');
const RecurringSubscription = require('../models/RecurringSubscription');
const logger = require('../utils/logger');

class WebhookController {
    // ==================== WEBHOOK MERCADO PAGO ====================

    static async mercadoPagoWebhook(req, res, next) {
        try {
            const { type, data, action } = req.body;

            logger.info('Webhook Mercado Pago recebido:', { type, action });

            // Validação HMAC é OPCIONAL - apenas logar se falhar
            // Desabilitada por padrão (configure WEBHOOK_HMAC_ENABLED=true para ativar)
            if (process.env.WEBHOOK_HMAC_ENABLED === 'true') {
                if (!WebhookController.validarWebhookMercadoPago(req)) {
                    logger.warn('Webhook Mercado Pago com HMAC inválido - REJEITANDO');
                    return res.status(400).json({ success: false, message: 'Assinatura HMAC inválida' });
                }
            } else {
                logger.info('Validação HMAC desabilitada - webhook aceito sem verificação');
            }

            // Processar conforme tipo de evento
            switch (type) {
                case 'payment':
                    await WebhookController.processarEventoPagamento(data);
                    break;
                case 'plan':
                    await WebhookController.processarEventoPlano(data);
                    break;
                case 'subscription':
                case 'subscription_preapproval':
                    await WebhookController.processarEventoSubscription(data, type);
                    break;
                case 'subscription_authorized_payment':
                    await WebhookController.processarEventoSubscriptionAuthorizedPayment(data);
                    break;
                default:
                    logger.info('Tipo de evento não reconhecido:', type);
            }

            res.json({ success: true });
        } catch (error) {
            logger.error('Erro ao processar webhook Mercado Pago:', error);
            // IMPORTANTE: Sempre retornar 200 para o Mercado Pago
            res.status(200).json({ success: true, error: error.message });
        }
    }

    static async processarEventoPagamento(data) {
        try {
            const paymentId = data.id;
            logger.info('Processando evento de pagamento:', { paymentId });

            // Buscar dados do pagamento
            let paymentDetails = data;
            try {
                const mp = require('../config/mercadoPago');
                const detalhe = await mp.getPayment(paymentId);
                if (detalhe && detalhe.status) paymentDetails = detalhe;
            } catch (err) {
                logger.warn('Não foi possível buscar detalhes do pagamento:', err.message);
            }

            const status = paymentDetails.status;
            const statusDetail = paymentDetails.status_detail;
            
            logger.info('Status do pagamento:', { paymentId, status, statusDetail });

            // Buscar assinatura pelo external_reference
            if (paymentDetails.external_reference) {
                const externalRef = paymentDetails.external_reference;
                const match = externalRef.match(/usuario_(\d+)_plano_(\d+)/);
                
                if (match) {
                    const usuarioId = match[1];
                    const planoId = match[2];
                    
                    logger.info('Encontrado external_reference:', { usuarioId, planoId });
                    
                    // Se pagamento aprovado, ativar assinatura
                    if (status === 'approved') {
                        await WebhookController.ativarAssinaturaUsuario(usuarioId, planoId, paymentId);
                    }
                }
            }

            // Buscar cobrança relacionada
            const cobranca = await pool.query(
                `SELECT * FROM assinaturas_historico_cobrancas 
                 WHERE mercado_pago_payment_id = $1`,
                [paymentId]
            );

            if (cobranca.rows.length > 0) {
                const cobrancaData = cobranca.rows[0];

                // Atualizar status da cobrança
                let novoStatus = 'pendente';
                if (status === 'approved' || status === 'authorized') {
                    novoStatus = 'aprovada';
                } else if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
                    novoStatus = 'falha';
                } else if (status === 'pending' || status === 'in_process') {
                    novoStatus = 'pendente';
                }

                await RecurringSubscription.updateCobranca(cobrancaData.id, {
                    status: novoStatus,
                    dataProcessamento: new Date(),
                    mercadoPagoPaymentId: paymentId
                });

                logger.info('Cobrança atualizada:', { cobrancaId: cobrancaData.id, novoStatus });
            }

        } catch (error) {
            logger.error('Erro ao processar evento de pagamento:', error);
            throw error;
        }
    }

    static async ativarAssinaturaUsuario(usuarioId, planoId, subscriptionMPId) {
        try {
            logger.info('Ativando assinatura do usuário:', { usuarioId, planoId, subscriptionMPId });
            
            // Converter para int se necessário
            const uid = parseInt(usuarioId);
            const pid = parseInt(planoId);
            
            // Verificar se já existe assinatura ativa
            const assinaturaExistente = await pool.query(
                `SELECT au.* FROM assinaturas_usuarios au
                 WHERE au.usuario_id = $1 AND au.plano_id = $2 
                 AND au.status = 'ativa'`,
                [uid, pid]
            );

            if (assinaturaExistente.rows.length === 0) {
                // Criar nova assinatura
                await pool.query('BEGIN');

                try {
                    // Criar assinatura do usuário
                    const insertUsuarioAssinatura = await pool.query(
                        `INSERT INTO assinaturas_usuarios 
                         (usuario_id, plano_id, status, data_inicio, proxima_cobranca, created_at)
                         VALUES ($1, $2, 'ativa', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_TIMESTAMP) 
                         RETURNING *`,
                        [uid, pid]
                    );

                    const assinaturaUsuarioId = insertUsuarioAssinatura.rows[0].id;

                    // Buscar valor do plano
                    const planoRes = await pool.query('SELECT valor FROM assinatura WHERE id = $1', [pid]);
                    const valor = planoRes.rows[0]?.valor || 0;

                    // Criar assinatura recorrente
                    await pool.query(
                        `INSERT INTO assinaturas_pagamentos_recorrentes
                         (usuario_id, assinatura_usuario_id, plano_id, valor_mensal, 
                          proxima_cobranca, status, mercado_pago_subscription_id, created_at)
                         VALUES ($1, $2, $3, $4, 
                         CURRENT_DATE + INTERVAL '30 days', 'ativa', $5, CURRENT_TIMESTAMP)`,
                        [uid, assinaturaUsuarioId, pid, valor, subscriptionMPId]
                    );

                    // Atualizar usuário
                    await pool.query(
                        `UPDATE usuarios 
                         SET assinante = true, 
                             assinatura_id = $1,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2`,
                        [assinaturaUsuarioId, uid]
                    );

                    await pool.query('COMMIT');
                    
                    logger.info('✅ Assinatura criada e usuário ativado:', { 
                        usuarioId: uid, 
                        assinaturaUsuarioId,
                        mercado_pago_subscription_id: subscriptionMPId
                    });
                } catch (innerErr) {
                    await pool.query('ROLLBACK');
                    throw innerErr;
                }
            } else {
                // Já existe assinatura ativa, apenas atualizar usuário
                const assinaturaId = assinaturaExistente.rows[0].id;
                
                await pool.query(
                    `UPDATE usuarios 
                     SET assinante = true, 
                         assinatura_id = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [assinaturaId, usuarioId]
                );
                
                logger.info('Usuário atualizado para assinante:', { usuarioId, assinaturaId });
            }

        } catch (error) {
            logger.error('Erro ao ativar assinatura do usuário:', error);
            throw error;
        }
    }

    static async processarEventoSubscriptionAuthorizedPayment(data) {
        try {
            logger.info('Processando evento subscription_authorized_payment:', data);
            
            const paymentId = data.id;
            
            // Buscar detalhes do pagamento
            const mp = require('../config/mercadoPago');
            const paymentDetails = await mp.getPayment(paymentId);
            
            if (!paymentDetails) return;
            
            // Se pagamento aprovado e tem external_reference
            if (paymentDetails.status === 'approved' && paymentDetails.external_reference) {
                const externalRef = paymentDetails.external_reference;
                const match = externalRef.match(/usuario_(\d+)_plano_(\d+)/);
                
                if (match) {
                    const usuarioId = match[1];
                    const planoId = match[2];
                    
                    // Ativar assinatura do usuário
                    await WebhookController.ativarAssinaturaUsuario(usuarioId, planoId, paymentId);
                }
            }
        } catch (error) {
            logger.error('Erro ao processar evento de pagamento autorizado:', error);
        }
    }

    static async processarEventoPlano(data) {
        try {
            logger.info('Processando evento de plano:', { planId: data.id });
        } catch (error) {
            logger.error('Erro ao processar evento de plano:', error);
        }
    }

    static async processarEventoSubscription(data, eventType) {
        try {
            const subscriptionId = data.id || data.preapproval_id;
            
            logger.info('Processando evento de assinatura:', { 
                subscriptionId, 
                eventType,
                dataPayload: JSON.stringify(data).substring(0, 200)
            });

            // ⭐ BUSCAR DETALHES COMPLETOS DA API (webhook pode não trazer external_reference)
            let assinaturaDetalhes = data;
            try {
                const mp = require('../config/mercadoPago');
                const detalhes = await mp.getSubscription(subscriptionId);
                if (detalhes && detalhes.id) {
                    assinaturaDetalhes = detalhes;
                    logger.info('Detalhes da assinatura buscados da API MP:', { 
                        status: detalhes.status, 
                        externalRef: detalhes.external_reference 
                    });
                }
            } catch (err) {
                logger.warn('Não foi possível buscar detalhes da assinatura da API MP:', err.message);
            }

            const status = assinaturaDetalhes.status;
            const externalReference = assinaturaDetalhes.external_reference;
            
            if (!externalReference) {
                logger.warn('Assinatura sem external_reference - não será processada', { subscriptionId });
                return;
            }

            const match = externalReference.match(/usuario_(\d+)_plano_(\d+)/);
            if (!match) {
                logger.warn('External_reference em formato inválido:', externalReference);
                return;
            }

            const usuarioId = parseInt(match[1]);
            const planoId = parseInt(match[2]);

            logger.info('Processando assinatura para usuário:', { usuarioId, planoId, status });

            if (status === 'authorized' || status === 'active' || status === 'pending_authorization') {
                // Ativar assinatura
                logger.info('Status autorizado/ativo - ativando assinatura:', { status });
                await WebhookController.ativarAssinaturaUsuario(usuarioId, planoId, subscriptionId);
                
                // Atualizar assinatura recorrente com ID do Mercado Pago
                await pool.query(
                    `UPDATE assinaturas_pagamentos_recorrentes 
                     SET mercado_pago_subscription_id = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE usuario_id = $2 
                     AND plano_id = $3`,
                    [subscriptionId, usuarioId, planoId]
                );
                
                logger.info('Assinatura recorrente atualizada com mercado_pago_subscription_id:', { subscriptionId, usuarioId, planoId });
                
            } else if (status === 'cancelled' || status === 'paused') {
                // Cancelar assinatura
                await pool.query('BEGIN');
                
                // Atualizar assinaturas recorrentes
                await pool.query(
                    `UPDATE assinaturas_pagamentos_recorrentes 
                     SET status = 'cancelada',
                         motivo_cancelamento = 'Cancelado via Mercado Pago',
                         cancelado_em = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE usuario_id = $1 
                     AND plano_id = $2
                     AND status = 'ativa'`,
                    [usuarioId, planoId]
                );
                
                // Atualizar assinaturas do usuário
                await pool.query(
                    `UPDATE assinaturas_usuarios 
                     SET status = 'cancelada',
                         data_fim = CURRENT_DATE
                     WHERE usuario_id = $1 
                     AND plano_id = $2
                     AND status = 'ativa'`,
                    [usuarioId, planoId]
                );
                
                // Atualizar usuário
                await pool.query(
                    `UPDATE usuarios 
                     SET assinante = false,
                         assinatura_id = NULL,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [usuarioId]
                );
                
                await pool.query('COMMIT');
                
                logger.info('Assinatura cancelada:', { usuarioId, planoId, subscriptionId });
            }

        } catch (error) {
            logger.error('Erro ao processar evento de assinatura:', error);
            throw error;
        }
    }

    static validarWebhookMercadoPago(req) {
        try {
            // Se WEBHOOK_HMAC_ENABLED está diferente de 'true', desabilitar validação
            if (process.env.WEBHOOK_HMAC_ENABLED !== 'true') {
                logger.info('Validação HMAC desabilitada via ENV - webhook considerado válido');
                return true;
            }

            const signatureHeader = req.headers['x-signature'] || 
                                  req.headers['x-hub-signature'] || 
                                  req.headers['x-mercadopago-signature'];

            logger.info('Validando webhook HMAC - Header recebido:', { signatureHeader });

            if (!signatureHeader) {
                logger.warn('Headers de validação webhook ausentes');
                return false;
            }

            const secret = process.env.WEBHOOK_SECRET;
            if (!secret) {
                logger.warn('WEBHOOK_SECRET não configurado; aceitando webhook sem validação');
                return true;
            }

            const raw = req.rawBody || JSON.stringify(req.body);
            let sig = signatureHeader;

            logger.info('Raw body para validação:', { rawLength: raw.length });

            if (sig.includes('ts=') && sig.includes('v1=')) {
                const v1Match = sig.match(/v1=([a-f0-9]+)/i);
                if (v1Match && v1Match[1]) {
                    sig = v1Match[1];
                    logger.info('Hash extraído do header:', sig);
                } else {
                    logger.warn('Não foi possível extrair hash');
                    return false;
                }
            } else {
                sig = sig.replace(/^sha256=/i, '').trim();
            }

            const crypto = require('crypto');
            const expected = crypto.createHmac('sha256', secret)
                                  .update(raw)
                                  .digest('hex');

            logger.info('Hash esperado:', expected);
            const valid = sig === expected;
            
            if (!valid) {
                logger.warn('Assinatura HMAC inválida (webhook será rejeitado)');
                logger.warn(`Recebido: ${sig}`);
                logger.warn(`Esperado: ${expected}`);
            } else {
                logger.info('Webhook validado com sucesso!');
            }
            
            return valid;
            
        } catch (error) {
            logger.error('Erro ao validar webhook:', error);
            return false;
        }
    }
}

module.exports = WebhookController;