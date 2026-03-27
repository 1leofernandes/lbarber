const pool = require('../config/database');
const RecurringSubscription = require('../models/RecurringSubscription');
const logger = require('../utils/logger');
const crypto = require('crypto');

class WebhookController {
    // ==================== WEBHOOK MERCADO PAGO ====================

    static async mercadoPagoWebhook(req, res, next) {
        try {
            // Extrair o raw body (já armazenado pelo middleware global)
            const rawBody = req.rawBody;
            if (!rawBody) {
                logger.warn('Webhook sem rawBody - pode estar faltando middleware verify');
            }

            // Validar HMAC se estiver habilitado
            if (process.env.WEBHOOK_HMAC_ENABLED === 'true') {
                const isValid = WebhookController.validarWebhookMercadoPago(req);
                if (!isValid) {
                    logger.warn('Assinatura HMAC inválida - webhook rejeitado');
                    return res.status(401).json({ success: false, message: 'Assinatura inválida' });
                }
                logger.info('Webhook validado com sucesso via HMAC');
            } else {
                logger.info('Validação HMAC desabilitada - webhook aceito sem verificação');
            }

            // Garantir que req.body seja um objeto (pode ser string se não parseado)
            let body = req.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    logger.error('Falha ao parsear body do webhook', e);
                    return res.status(400).json({ success: false, message: 'Corpo inválido' });
                }
            }

            const { type, data, action } = body;
            logger.info('Webhook Mercado Pago recebido:', { type, action, data });

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
            // Sempre retornar 200 para o Mercado Pago evitar reenvios infinitos
            res.status(200).json({ success: true, error: error.message });
        }
    }

    static validarWebhookMercadoPago(req) {
        try {
            const signatureHeader = req.headers['x-signature'];
            if (!signatureHeader) {
                logger.warn('Header x-signature ausente');
                return false;
            }

            const secret = process.env.WEBHOOK_SECRET;
            if (!secret) {
                logger.warn('WEBHOOK_SECRET não configurado, aceitando sem validação');
                return true; // Se não tem segredo, não valida
            }

            // Extrair o hash v1 (formato: ts=...;v1=...)
            let hash = null;
            const parts = signatureHeader.split(',');
            for (const part of parts) {
                const [key, value] = part.split('=');
                if (key === 'v1') hash = value;
            }

            if (!hash) {
                logger.warn('Hash v1 não encontrado no header');
                return false;
            }

            const rawBody = req.rawBody;
            if (!rawBody) {
                logger.warn('rawBody não disponível para validação');
                return false;
            }

            // Calcular HMAC com SHA256 usando o segredo e o raw body
            const expected = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex');

            const isValid = hash === expected;
            if (!isValid) {
                logger.warn(`Assinatura inválida: recebida=${hash}, esperada=${expected}`);
            }
            return isValid;
        } catch (error) {
            logger.error('Erro ao validar webhook:', error);
            return false;
        }
    }

    static async processarEventoPagamento(data) {
        try {
            const paymentId = data.id;
            logger.info('Processando evento de pagamento:', { paymentId });

            // Buscar dados do pagamento (opcional, mas útil)
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

            // Se o pagamento tem external_reference (ex.: "usuario_123_plano_456")
            if (paymentDetails.external_reference) {
                const externalRef = paymentDetails.external_reference;
                const match = externalRef.match(/usuario_(\d+)_plano_(\d+)/);
                if (match) {
                    const usuarioId = match[1];
                    const planoId = match[2];
                    logger.info('Encontrado external_reference:', { usuarioId, planoId });

                    if (status === 'approved') {
                        await WebhookController.ativarAssinaturaUsuario(usuarioId, planoId, paymentId);
                    }
                }
            }

            // Atualizar cobrança correspondente no sistema
            const cobranca = await pool.query(
                `SELECT * FROM assinaturas_historico_cobrancas 
                 WHERE mercado_pago_payment_id = $1`,
                [paymentId]
            );

            if (cobranca.rows.length > 0) {
                const cobrancaData = cobranca.rows[0];
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

    static async processarEventoSubscriptionAuthorizedPayment(data) {
        try {
            logger.info('Processando evento subscription_authorized_payment:', data);
            const paymentId = data.id;
            const mp = require('../config/mercadoPago');
            const paymentDetails = await mp.getPayment(paymentId);
            if (!paymentDetails) return;

            if (paymentDetails.status === 'approved' && paymentDetails.external_reference) {
                const externalRef = paymentDetails.external_reference;
                const match = externalRef.match(/usuario_(\d+)_plano_(\d+)/);
                if (match) {
                    const usuarioId = match[1];
                    const planoId = match[2];
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
            // Implementar se necessário
        } catch (error) {
            logger.error('Erro ao processar evento de plano:', error);
        }
    }

    static async processarEventoSubscription(data, eventType) {
        try {
            const subscriptionId = data.id || data.preapproval_id;
            logger.info('Processando evento de assinatura:', { subscriptionId, eventType });

            // Buscar detalhes completos da API (o webhook pode não ter todos os campos)
            let assinaturaDetalhes = data;
            try {
                const mp = require('../config/mercadoPago');
                const detalhes = await mp.getSubscription(subscriptionId);
                if (detalhes && detalhes.id) {
                    assinaturaDetalhes = detalhes;
                    logger.info('Detalhes da assinatura obtidos da API MP:', {
                        status: detalhes.status,
                        externalRef: detalhes.external_reference,
                        next_payment_date: detalhes.next_payment_date
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

            // Buscar ou criar assinatura recorrente no banco
            let recorrente = await pool.query(
                `SELECT id, status, proxima_cobranca FROM assinaturas_pagamentos_recorrentes
                 WHERE usuario_id = $1 AND plano_id = $2`,
                [usuarioId, planoId]
            );

            if (status === 'authorized' || status === 'active' || status === 'pending_authorization') {
                // Ativar assinatura
                await WebhookController.ativarAssinaturaUsuario(usuarioId, planoId, subscriptionId);

                // Atualizar datas de cobrança conforme o Mercado Pago
                const nextPayment = assinaturaDetalhes.next_payment_date;
                let nextDate = null;
                if (nextPayment) {
                    // Formato: 2026-04-20T14:27:03.000-04:00
                    nextDate = nextPayment.split('T')[0];
                }

                if (recorrente.rows.length === 0) {
                    // Criar novo registro se não existir
                    const valor = assinaturaDetalhes.auto_recurring?.transaction_amount || 0;
                    await pool.query(
                        `INSERT INTO assinaturas_pagamentos_recorrentes
                         (usuario_id, assinatura_usuario_id, plano_id, mercado_pago_subscription_id,
                          valor_mensal, proxima_cobranca, status, created_at)
                         SELECT $1, au.id, $2, $3, $4, $5, 'ativa', CURRENT_TIMESTAMP
                         FROM assinaturas_usuarios au
                         WHERE au.usuario_id = $1 AND au.plano_id = $2 AND au.status = 'ativa'
                         LIMIT 1`,
                        [usuarioId, planoId, subscriptionId, valor, nextDate]
                    );
                } else {
                    // Atualizar ID e datas
                    await pool.query(
                        `UPDATE assinaturas_pagamentos_recorrentes
                         SET mercado_pago_subscription_id = $1,
                             proxima_cobranca = COALESCE($2, proxima_cobranca),
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $3`,
                        [subscriptionId, nextDate, recorrente.rows[0].id]
                    );
                }

                logger.info('Assinatura ativada/sincronizada:', { usuarioId, planoId, subscriptionId, nextDate });
            } else if (status === 'cancelled' || status === 'paused') {
                // Cancelar assinatura no sistema
                await pool.query('BEGIN');
                try {
                    // Atualizar assinatura recorrente
                    await pool.query(
                        `UPDATE assinaturas_pagamentos_recorrentes
                         SET status = 'cancelada',
                             motivo_cancelamento = 'Cancelado via Mercado Pago',
                             cancelado_em = CURRENT_TIMESTAMP,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE usuario_id = $1 AND plano_id = $2 AND status = 'ativa'`,
                        [usuarioId, planoId]
                    );

                    // Atualizar assinatura do usuário
                    await pool.query(
                        `UPDATE assinaturas_usuarios
                         SET status = 'cancelada',
                             data_fim = CURRENT_DATE
                         WHERE usuario_id = $1 AND plano_id = $2 AND status = 'ativa'`,
                        [usuarioId, planoId]
                    );

                    // Atualizar flag no usuário
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
                } catch (err) {
                    await pool.query('ROLLBACK');
                    throw err;
                }
            }
        } catch (error) {
            logger.error('Erro ao processar evento de assinatura:', error);
            throw error;
        }
    }

    static async ativarAssinaturaUsuario(usuarioId, planoId, subscriptionMPId) {
        try {
            logger.info('Ativando assinatura do usuário:', { usuarioId, planoId, subscriptionMPId });

            const uid = parseInt(usuarioId);
            const pid = parseInt(planoId);

            // Verificar se já existe assinatura de usuário ativa
            let assinaturaUsuario = await pool.query(
                `SELECT id FROM assinaturas_usuarios
                 WHERE usuario_id = $1 AND plano_id = $2 AND status = 'ativa'`,
                [uid, pid]
            );

            await pool.query('BEGIN');

            let assinaturaUsuarioId;
            if (assinaturaUsuario.rows.length === 0) {
                // Criar nova assinatura de usuário
                const insert = await pool.query(
                    `INSERT INTO assinaturas_usuarios
                     (usuario_id, plano_id, status, data_inicio, proxima_cobranca, created_at)
                     VALUES ($1, $2, 'ativa', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_TIMESTAMP)
                     RETURNING id`,
                    [uid, pid]
                );
                assinaturaUsuarioId = insert.rows[0].id;
            } else {
                assinaturaUsuarioId = assinaturaUsuario.rows[0].id;
            }

            // Atualizar usuário como assinante
            await pool.query(
                `UPDATE usuarios
                 SET assinante = true, assinatura_id = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [assinaturaUsuarioId, uid]
            );

            // Verificar se já existe assinatura recorrente com esse MP ID
            const recorrenteExistente = await pool.query(
                `SELECT id FROM assinaturas_pagamentos_recorrentes
                 WHERE mercado_pago_subscription_id = $1`,
                [subscriptionMPId]
            );

            if (recorrenteExistente.rows.length === 0) {
                // Buscar valor do plano
                const plano = await pool.query('SELECT valor FROM assinatura WHERE id = $1', [pid]);
                const valorMensal = plano.rows[0]?.valor || 0;

                // Criar assinatura recorrente
                await pool.query(
                    `INSERT INTO assinaturas_pagamentos_recorrentes
                     (usuario_id, assinatura_usuario_id, plano_id, mercado_pago_subscription_id,
                      valor_mensal, proxima_cobranca, status, created_at)
                     VALUES ($1, $2, $3, $4, $5,
                             CURRENT_DATE + INTERVAL '30 days', 'ativa', CURRENT_TIMESTAMP)`,
                    [uid, assinaturaUsuarioId, pid, subscriptionMPId, valorMensal]
                );
            } else {
                // Atualizar o status da existente se necessário
                await pool.query(
                    `UPDATE assinaturas_pagamentos_recorrentes
                     SET status = 'ativa', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND status != 'ativa'`,
                    [recorrenteExistente.rows[0].id]
                );
            }

            await pool.query('COMMIT');
            logger.info('Assinatura ativada com sucesso:', { usuarioId, assinaturaUsuarioId, subscriptionMPId });
        } catch (error) {
            await pool.query('ROLLBACK');
            logger.error('Erro ao ativar assinatura do usuário:', error);
            throw error;
        }
    }
}

module.exports = WebhookController;