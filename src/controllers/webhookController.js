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

            // Validar webhook
            if (!WebhookController.validarWebhookMercadoPago(req)) {
                logger.warn('Webhook Mercado Pago com assinatura inválida');
                return res.status(400).json({ success: false, message: 'Assinatura inválida' });
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
                case 'preapproval':
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
            // IMPORTANTE: Retornar 200 para evitar reprocessamento
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

            // Buscar cobrança relacionada
            const cobranca = await pool.query(
                `SELECT * FROM assinaturas_historico_cobrancas 
                 WHERE mercado_pago_payment_id = $1`,
                [paymentId]
            );

            if (cobranca.rows.length === 0) {
                logger.warn('Cobrança não encontrada para pagamento:', paymentId);
                return;
            }

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

            // Se aprovado, atualizar próxima cobrança
            if (novoStatus === 'aprovada') {
                const assinatura = await pool.query(
                    `SELECT id FROM assinaturas_pagamentos_recorrentes WHERE id = $1`,
                    [cobrancaData.assinatura_pagamento_id]
                );

                if (assinatura.rows.length > 0) {
                    await pool.query(
                        `UPDATE assinaturas_pagamentos_recorrentes 
                         SET proxima_cobranca = CURRENT_DATE + INTERVAL '30 days',
                             ultima_cobranca = CURRENT_DATE,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1`,
                        [assinatura.rows[0].id]
                    );

                    logger.info('Próxima cobrança agendada');
                }
            }
        } catch (error) {
            logger.error('Erro ao processar evento de pagamento:', error);
            throw error;
        }
    }

    static async processarEventoSubscriptionAuthorizedPayment(data) {
        try {
            logger.info('Processando evento subscription_authorized_payment:', data);
            
            // Este evento indica que um pagamento autorizado foi criado
            // Pode ser usado para criar a cobrança no histórico
            const paymentId = data.id;
            
            // Buscar detalhes do pagamento
            const mp = require('../config/mercadoPago');
            const paymentDetails = await mp.getPayment(paymentId);
            
            if (!paymentDetails) return;
            
            // Verificar se há uma assinatura relacionada
            if (paymentDetails.external_reference) {
                const externalRef = paymentDetails.external_reference;
                const match = externalRef.match(/usuario_(\d+)_plano_(\d+)/);
                
                if (match) {
                    const usuarioId = match[1];
                    const planoId = match[2];
                    
                    // Buscar assinatura recorrente do usuário
                    const assinaturaRes = await pool.query(
                        `SELECT apr.id 
                         FROM assinaturas_pagamentos_recorrentes apr
                         JOIN assinaturas_usuarios au ON apr.assinatura_usuario_id = au.id
                         WHERE apr.usuario_id = $1 AND au.plano_id = $2
                         ORDER BY apr.created_at DESC LIMIT 1`,
                        [usuarioId, planoId]
                    );
                    
                    if (assinaturaRes.rows.length > 0) {
                        const assinaturaId = assinaturaRes.rows[0].id;
                        
                        // Criar registro de cobrança
                        await RecurringSubscription.createCobranca({
                            assinaturaPagamentoId: assinaturaId,
                            usuarioId: usuarioId,
                            valor: paymentDetails.transaction_amount,
                            dataCobranca: new Date()
                        });
                        
                        logger.info('Cobrança criada para pagamento autorizado:', { paymentId, assinaturaId });
                    }
                }
            }
        } catch (error) {
            logger.error('Erro ao processar evento de pagamento autorizado:', error);
        }
    }

    static async processarEventoPlano(data) {
        try {
            logger.info('Processando evento de plano:', { planId: data.id });
            // Pode sincronizar dados do plano com a tabela `assinatura` se necessário
        } catch (error) {
            logger.error('Erro ao processar evento de plano:', error);
            throw error;
        }
    }

    static async processarEventoSubscription(data, eventType) {
        try {
            const subscriptionId = data.id || data.preapproval_id;
            logger.info('Processando evento de assinatura:', { subscriptionId, eventType, data });

            // Obter detalhes da assinatura no Mercado Pago
            const mp = require('../config/mercadoPago');
            let detalhes;
            try {
                detalhes = await mp.getSubscription(subscriptionId);
                logger.info('Detalhes da assinatura do Mercado Pago:', detalhes);
            } catch (error) {
                logger.warn('Não foi possível buscar detalhes da assinatura:', error.message);
                detalhes = data;
            }

            // Extrair informações importantes
            const status = detalhes.status || data.status;
            const payerEmail = (detalhes.payer && detalhes.payer.email) || 
                              detalhes.payer_email || 
                              (data.payer && data.payer.email) || 
                              data.payer_email;
            const externalReference = detalhes.external_reference || data.external_reference;
            const nextDate = (detalhes.auto_recurring && detalhes.auto_recurring.next_payment_date) || 
                           data.next_payment_date;
            const transactionAmount = (detalhes.auto_recurring && detalhes.auto_recurring.transaction_amount) || 
                                    data.transaction_amount;

            logger.info('Informações extraídas:', { 
                status, 
                payerEmail, 
                externalReference, 
                nextDate,
                transactionAmount 
            });

            // Tentar encontrar pelo external_reference primeiro
            let usuarioId = null;
            let planoId = null;
            
            if (externalReference) {
                const match = externalReference.match(/usuario_(\d+)_plano_(\d+)/);
                if (match) {
                    usuarioId = parseInt(match[1]);
                    planoId = parseInt(match[2]);
                    logger.info('Encontrado pelo external_reference:', { usuarioId, planoId });
                }
            }

            // Se não encontrou pelo external_reference, tentar pelo email
            if (!usuarioId && payerEmail) {
                const usuarioRes = await pool.query(
                    'SELECT id FROM usuarios WHERE email = $1', 
                    [payerEmail]
                );
                if (usuarioRes.rows.length > 0) {
                    usuarioId = usuarioRes.rows[0].id;
                    logger.info('Encontrado pelo email:', { usuarioId, payerEmail });
                }
            }

            if (!usuarioId) {
                logger.warn('Usuário não encontrado para assinatura:', { 
                    subscriptionId, 
                    externalReference, 
                    payerEmail 
                });
                return;
            }

            // Encontrar plano
            if (!planoId) {
                // Tentar encontrar pelo valor da transação
                if (transactionAmount) {
                    const planoRes = await pool.query(
                        'SELECT id FROM assinatura WHERE valor = $1 LIMIT 1', 
                        [transactionAmount]
                    );
                    if (planoRes.rows.length > 0) {
                        planoId = planoRes.rows[0].id;
                        logger.info('Encontrado plano pelo valor:', { planoId, transactionAmount });
                    }
                }
            }

            // Se ainda não tem planoId, usar o primeiro plano ativo
            if (!planoId) {
                const planoRes = await pool.query(
                    'SELECT id FROM assinatura WHERE status = $1 ORDER BY id LIMIT 1', 
                    ['ativo']
                );
                if (planoRes.rows.length > 0) {
                    planoId = planoRes.rows[0].id;
                    logger.info('Usando primeiro plano ativo:', { planoId });
                }
            }

            // Verificar se já existe uma assinatura com esse ID
            const existing = await pool.query(
                `SELECT apr.*, au.id as assinatura_usuario_id 
                 FROM assinaturas_pagamentos_recorrentes apr
                 LEFT JOIN assinaturas_usuarios au ON apr.assinatura_usuario_id = au.id
                 WHERE apr.mercado_pago_subscription_id = $1 OR apr.id::text = $1
                 LIMIT 1`,
                [subscriptionId]
            );

            if (existing.rows.length > 0) {
                // Atualizar assinatura existente
                const assinatura = existing.rows[0];
                logger.info('Atualizando assinatura existente:', { assinaturaId: assinatura.id });

                // Determinar status local
                let statusLocal = 'ativa';
                if (status === 'cancelled' || status === 'paused') {
                    statusLocal = 'cancelada';
                } else if (status === 'pending') {
                    statusLocal = 'pendente';
                }

                // Atualizar assinatura recorrente
                await pool.query(
                    `UPDATE assinaturas_pagamentos_recorrentes 
                     SET status = $1, 
                         proxima_cobranca = $2, 
                         valor_mensal = $3,
                         updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $4`,
                    [statusLocal, nextDate || null, transactionAmount || null, assinatura.id]
                );

                // Atualizar assinatura do usuário
                if (assinatura.assinatura_usuario_id) {
                    await pool.query(
                        `UPDATE assinaturas_usuarios 
                         SET status = $1, 
                             proxima_cobranca = $2,
                             data_fim = CASE WHEN $1 = 'cancelada' THEN CURRENT_DATE ELSE NULL END
                         WHERE id = $3`,
                        [statusLocal, nextDate || null, assinatura.assinatura_usuario_id]
                    );
                }

                // Atualizar usuário
                if (statusLocal === 'ativa') {
                    await pool.query(
                        `UPDATE usuarios 
                         SET assinante = true, 
                             assinatura_id = $1 
                         WHERE id = $2`,
                        [assinatura.assinatura_usuario_id, usuarioId]
                    );
                } else if (statusLocal === 'cancelada') {
                    await pool.query(
                        `UPDATE usuarios 
                         SET assinante = false,
                             assinatura_id = NULL 
                         WHERE id = $1`,
                        [usuarioId]
                    );
                }

                logger.info('Assinatura existente atualizada', { 
                    subscriptionId, 
                    statusLocal,
                    usuarioId 
                });
                return;
            }

            // Criar nova assinatura
            logger.info('Criando nova assinatura localmente');
            
            try {
                await pool.query('BEGIN');

                // Criar assinatura do usuário
                const insertUsuarioAssinatura = await pool.query(
                    `INSERT INTO assinaturas_usuarios 
                     (usuario_id, plano_id, status, data_inicio, data_fim, proxima_cobranca, created_at)
                     VALUES ($1, $2, $3, CURRENT_DATE, NULL, $4, CURRENT_TIMESTAMP) 
                     RETURNING *`,
                    [
                        usuarioId, 
                        planoId, 
                        status === 'cancelled' ? 'cancelada' : 'ativa', 
                        nextDate || null
                    ]
                );

                const assinaturaUsuarioId = insertUsuarioAssinatura.rows[0].id;

                // Criar assinatura recorrente
                const insertRecorrente = await pool.query(
                    `INSERT INTO assinaturas_pagamentos_recorrentes
                     (usuario_id, assinatura_usuario_id, plano_id, cartao_id, 
                      mercado_pago_subscription_id, valor_mensal, proxima_cobranca, status, created_at)
                     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
                     RETURNING *`,
                    [
                        usuarioId, 
                        assinaturaUsuarioId, 
                        planoId, 
                        subscriptionId,
                        transactionAmount || null, 
                        nextDate || null, 
                        status === 'cancelled' ? 'cancelada' : 'ativa'
                    ]
                );

                // Atualizar usuário
                if (status !== 'cancelled') {
                    await pool.query(
                        `UPDATE usuarios 
                         SET assinante = true, 
                             assinatura_id = $1 
                         WHERE id = $2`,
                        [assinaturaUsuarioId, usuarioId]
                    );
                }

                await pool.query('COMMIT');

                logger.info('Assinatura criada localmente com sucesso', { 
                    subscriptionId, 
                    usuarioId, 
                    assinaturaUsuarioId,
                    planoId 
                });

            } catch (err) {
                await pool.query('ROLLBACK');
                logger.error('Erro ao criar registros de assinatura:', err);
                throw err;
            }

        } catch (error) {
            logger.error('Erro ao processar evento de assinatura:', error);
            throw error;
        }
    }

    static validarWebhookMercadoPago(req) {
        try {
            // Obter header de assinatura
            const signatureHeader = req.headers['x-signature'] || 
                                  req.headers['x-hub-signature'] || 
                                  req.headers['x-mercadopago-signature'];

            // Em desenvolvimento, pode pular validação
            if (process.env.NODE_ENV === 'development') {
                logger.info('Em ambiente de desenvolvimento - validação de webhook ignorada');
                return true;
            }

            if (!signatureHeader) {
                logger.warn('Headers de validação webhook ausentes');
                return false;
            }

            const secret = process.env.WEBHOOK_SECRET;
            if (!secret) {
                logger.warn('WEBHOOK_SECRET não configurado; aceitando webhook sem validação HMAC');
                return true;
            }

            // Obter corpo da requisição
            const raw = req.rawBody || JSON.stringify(req.body);
            const sig = signatureHeader.replace(/^sha256=/i, '').trim();
            
            // Calcular HMAC
            const crypto = require('crypto');
            const expected = crypto.createHmac('sha256', secret)
                                  .update(raw)
                                  .digest('hex');

            const valid = sig === expected;
            if (!valid) {
                logger.warn('Assinatura HMAC inválida para webhook');
                logger.warn(`Recebido: ${sig}`);
                logger.warn(`Esperado: ${expected}`);
            }
            
            return valid;
        } catch (error) {
            logger.error('Erro ao validar webhook:', error);
            return false;
        }
    }
}

module.exports = WebhookController;