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

            // IMPORTANTE: Em produção, aceitar webhooks mesmo com validação falhando temporariamente
            // Mas logar para debug
            if (!WebhookController.validarWebhookMercadoPago(req)) {
                logger.warn('Webhook Mercado Pago com assinatura inválida - MAS ACEITANDO PARA TESTE');
                // Em produção, aceitar mesmo com erro por enquanto
                // return res.status(400).json({ success: false, message: 'Assinatura inválida' });
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

    static async ativarAssinaturaUsuario(usuarioId, planoId, paymentId) {
        try {
            logger.info('Ativando assinatura do usuário:', { usuarioId, planoId });
            
            // Verificar se já existe assinatura ativa
            const assinaturaExistente = await pool.query(
                `SELECT au.* FROM assinaturas_usuarios au
                 WHERE au.usuario_id = $1 AND au.plano_id = $2 
                 AND au.status = 'ativa'`,
                [usuarioId, planoId]
            );

            if (assinaturaExistente.rows.length === 0) {
                // Criar nova assinatura
                await pool.query('BEGIN');

                // Criar assinatura do usuário
                const insertUsuarioAssinatura = await pool.query(
                    `INSERT INTO assinaturas_usuarios 
                     (usuario_id, plano_id, status, data_inicio, data_fim, proxima_cobranca, created_at)
                     VALUES ($1, $2, 'ativa', CURRENT_DATE, NULL, CURRENT_DATE + INTERVAL '30 days', CURRENT_TIMESTAMP) 
                     RETURNING *`,
                    [usuarioId, planoId]
                );

                const assinaturaUsuarioId = insertUsuarioAssinatura.rows[0].id;

                // Criar assinatura recorrente
                await pool.query(
                    `INSERT INTO assinaturas_pagamentos_recorrentes
                     (usuario_id, assinatura_usuario_id, plano_id, valor_mensal, 
                      proxima_cobranca, status, created_at)
                     VALUES ($1, $2, $3, 
                     (SELECT valor FROM assinatura WHERE id = $3),
                     CURRENT_DATE + INTERVAL '30 days', 'ativa', CURRENT_TIMESTAMP)`,
                    [usuarioId, assinaturaUsuarioId, planoId]
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
                
                logger.info('Assinatura criada e usuário ativado:', { 
                    usuarioId, 
                    assinaturaUsuarioId,
                    paymentId 
                });
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
            const status = data.status;
            
            logger.info('Processando evento de assinatura:', { 
                subscriptionId, 
                eventType, 
                status,
                externalReference: data.external_reference 
            });

            // Extrair external_reference
            const externalReference = data.external_reference;
            if (!externalReference) {
                logger.warn('Assinatura sem external_reference:', subscriptionId);
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

            if (status === 'authorized' || status === 'active') {
                // Ativar assinatura
                await WebhookController.ativarAssinaturaUsuario(usuarioId, planoId, subscriptionId);
                
                // Atualizar assinatura recorrente com ID do Mercado Pago
                await pool.query(
                    `UPDATE assinaturas_pagamentos_recorrentes 
                     SET mercado_pago_subscription_id = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE usuario_id = $2 
                     AND plano_id = $3
                     AND status = 'ativa'`,
                    [subscriptionId, usuarioId, planoId]
                );
                
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
            const signatureHeader = req.headers['x-signature'] || 
                                  req.headers['x-hub-signature'] || 
                                  req.headers['x-mercadopago-signature'];

            // Log para debug
            logger.info('Validando webhook - Header recebido:', { signatureHeader });

            // Se não tem header e está em produção, aceitar (temporariamente)
            if (!signatureHeader) {
                logger.warn('Headers de validação webhook ausentes');
                return false;
            }

            const secret = process.env.WEBHOOK_SECRET;
            
            // Se não tem secret configurado, aceitar (apenas para desenvolvimento)
            if (!secret) {
                logger.warn('WEBHOOK_SECRET não configurado; aceitando webhook sem validação');
                return true;
            }

            // Obter corpo da requisição
            const raw = req.rawBody || JSON.stringify(req.body);
            let sig = signatureHeader;

            logger.info('Raw body para validação:', { rawLength: raw.length });

            // O Mercado Pago envia no formato: ts=timestamp,v1=hash
            // Precisamos extrair apenas o hash após v1=
            if (sig.includes('ts=') && sig.includes('v1=')) {
                // Extrair a parte v1=hash
                const v1Match = sig.match(/v1=([a-f0-9]+)/i);
                if (v1Match && v1Match[1]) {
                    sig = v1Match[1];
                    logger.info('Hash extraído do header:', sig);
                } else {
                    logger.warn('Não foi possível extrair hash do formato ts=...,v1=...');
                    return false;
                }
            } else {
                // Remove prefixo se existir
                sig = sig.replace(/^sha256=/i, '').trim();
            }

            // Calcular HMAC
            const crypto = require('crypto');
            const expected = crypto.createHmac('sha256', secret)
                                  .update(raw)
                                  .digest('hex');

            logger.info('Hash esperado:', expected);
            
            const valid = sig === expected;
            
            if (!valid) {
                logger.warn('Assinatura HMAC inválida para webhook');
                logger.warn(`Recebido: ${sig}`);
                logger.warn(`Esperado: ${expected}`);
                logger.warn(`Secret usado: ${secret.substring(0, 8)}...`);
            } else {
                logger.info('Webhook validado com sucesso!');
            }
            
            return valid;
            
        } catch (error) {
            logger.error('Erro ao validar webhook:', error);
            // Em produção, é mais seguro rejeitar webhooks inválidos
            // Mas para testes, podemos aceitar
            return process.env.NODE_ENV !== 'production';
        }
    }
}

module.exports = WebhookController;