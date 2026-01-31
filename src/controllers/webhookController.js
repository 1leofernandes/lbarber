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

            // Validar webhook (implementar verificação de assinatura conforme documentação MP)
            if (!this.validarWebhookMercadoPago(req)) {
                logger.warn('Webhook Mercado Pago com assinatura inválida');
                return res.status(400).json({ success: false, message: 'Assinatura inválida' });
            }

            // Processar conforme tipo de evento
            switch (type) {
                case 'payment':
                    await this.processarEventoPagamento(data);
                    break;
                case 'plan':
                    await this.processarEventoPlano(data);
                    break;
                case 'subscription':
                    await this.processarEventoSubscription(data);
                    break;
                default:
                    logger.info('Tipo de evento não reconhecido:', type);
            }

            res.json({ success: true });
        } catch (error) {
            logger.error('Erro ao processar webhook Mercado Pago:', error);
            // Retornar 200 mesmo com erro para evitar reprocessamento infinito
            res.json({ success: true, error: error.message });
        }
    }

    static async processarEventoPagamento(data) {
        try {
            const paymentId = data.id;
            logger.info('Processando evento de pagamento:', { paymentId });

            // Buscar dados do pagamento diretamente no Mercado Pago para garantir status
            let paymentDetails = data;
            try {
                const mp = require('../config/mercadoPago');
                const detalhe = await mp.getPayment(paymentId);
                if (detalhe && detalhe.status) paymentDetails = detalhe;
            } catch (err) {
                logger.warn('Não foi possível buscar detalhes do pagamento no Mercado Pago, usando payload do webhook');
            }

            const status = paymentDetails.status;

            // Buscar cobrança relacionada
            const cobranca = await pool.query(
                `SELECT * FROM assinaturas_historico_cobranças 
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

    static async processarEventoPlano(data) {
        try {
            logger.info('Processando evento de plano:', { planId: data.id });
            // Pode-se sincronizar dados do plano com a tabela `assinatura` se desejado
        } catch (error) {
            logger.error('Erro ao processar evento de plano:', error);
            throw error;
        }
    }

    static async processarEventoSubscription(data) {
        try {
            const subscriptionId = data.id;
            logger.info('Processando evento de assinatura:', { subscriptionId });

            const mp = require('../config/mercadoPago');
            const detalhes = await mp.getSubscription(subscriptionId);

            // Estrutura esperada em `detalhes` pode variar. Exemplos: { id, status, payer: { email }, auto_recurring: { next_payment_date, transaction_amount }, preapproval_plan_id }
            const status = detalhes.status || null;
            const payerEmail = (detalhes.payer && detalhes.payer.email) || detalhes.payer_email || null;
            const nextDate = (detalhes.auto_recurring && detalhes.auto_recurring.next_payment_date) || null;
            const planoMpId = detalhes.preapproval_plan_id || (detalhes.auto_recurring && detalhes.auto_recurring.product_id) || null;

            if (!payerEmail) {
                logger.warn('Assinatura recebida sem email do pagador; ignorando');
                return;
            }

            // Encontrar usuário local pelo email
            const usuarioRes = await pool.query('SELECT id FROM usuarios WHERE email = $1', [payerEmail]);
            if (usuarioRes.rows.length === 0) {
                logger.warn('Usuário não encontrado para email da assinatura:', payerEmail);
                return;
            }

            const usuarioId = usuarioRes.rows[0].id;

            // Tentar encontrar plano local que corresponda ao plan_id do Mercado Pago
            let planoLocalId = null;
            if (planoMpId) {
                const planoRes = await pool.query('SELECT id, valor FROM assinatura WHERE mercado_pago_plan_id = $1 LIMIT 1', [planoMpId]);
                if (planoRes.rows.length > 0) {
                    planoLocalId = planoRes.rows[0].id;
                }
            }

            // Se não encontrar, tentar casar por valor (auto_recurring.transaction_amount)
            if (!planoLocalId && detalhes.auto_recurring && detalhes.auto_recurring.transaction_amount) {
                const valor = detalhes.auto_recurring.transaction_amount;
                const planoRes2 = await pool.query('SELECT id FROM assinatura WHERE valor = $1 LIMIT 1', [valor]);
                if (planoRes2.rows.length > 0) planoLocalId = planoRes2.rows[0].id;
            }

            // Se já existe uma assinatura com esse mercado_pago_subscription_id, atualize
            const existing = await pool.query(
                'SELECT * FROM assinaturas_pagamentos_recorrentes WHERE mercado_pago_subscription_id = $1 LIMIT 1',
                [subscriptionId]
            );

            if (existing.rows.length > 0) {
                // Atualizar status/proxima cobrança
                await pool.query(
                    `UPDATE assinaturas_pagamentos_recorrentes SET status = $1, proxima_cobranca = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
                    [status === 'authorized' || status === 'active' ? 'ativa' : status === 'cancelled' ? 'cancelada' : 'ativa', nextDate || null, existing.rows[0].id]
                );

                // Atualizar assinaturas_usuarios
                await pool.query(
                    `UPDATE assinaturas_usuarios SET status = $1 WHERE id = $2`,
                    [status === 'cancelled' ? 'cancelada' : 'ativa', existing.rows[0].assinatura_usuario_id]
                );

                logger.info('Assinatura existente atualizada via webhook MP', { subscriptionId });
                return;
            }

            // Criar registros locais
            try {
                await pool.query('BEGIN');

                // Criar assinaturas_usuarios
                const insertUsuarioAssinatura = await pool.query(
                    `INSERT INTO assinaturas_usuarios (usuario_id, plano_id, status, data_inicio, data_fim, proxima_cobranca, created_at)
                        VALUES ($1, $2, $3, CURRENT_DATE, NULL, $4, CURRENT_TIMESTAMP) RETURNING *`,
                    [usuarioId, planoLocalId || null, status === 'cancelled' ? 'cancelada' : 'ativa', nextDate || null]
                );

                const assinaturaUsuarioId = insertUsuarioAssinatura.rows[0].id;

                // Inserir assinaturas_pagamentos_recorrentes
                const planoValor = (detalhes.auto_recurring && detalhes.auto_recurring.transaction_amount) || null;
                const insertRecorrente = await pool.query(
                    `INSERT INTO assinaturas_pagamentos_recorrentes
                        (usuario_id, assinatura_usuario_id, plano_id, cartao_id, mercado_pago_subscription_id, valor_mensal, proxima_cobranca, status, created_at)
                        VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING *`,
                    [usuarioId, assinaturaUsuarioId, planoLocalId || null, subscriptionId, planoValor, nextDate || null, status === 'cancelled' ? 'cancelada' : 'ativa']
                );

                // Atualizar usuario como assinante
                await pool.query('UPDATE usuarios SET assinante = true, assinatura_id = $1 WHERE id = $2', [assinaturaUsuarioId, usuarioId]);

                await pool.query('COMMIT');

                logger.info('Assinatura criada localmente via webhook MP', { subscriptionId, usuarioId, assinaturaUsuarioId: insertRecorrente.rows[0].id });
            } catch (err) {
                await pool.query('ROLLBACK');
                logger.error('Erro ao criar registros de assinatura via webhook:', err);
                throw err;
            }
        } catch (error) {
            logger.error('Erro ao processar evento de assinatura:', error);
            throw error;
        }
    }

    static validarWebhookMercadoPago(req) {
        try {
            const signatureHeader = req.headers['x-signature'] || req.headers['x-hub-signature'] || req.headers['x-mercadopago-signature'];

            if (!signatureHeader) {
                logger.warn('Headers de validação webhook ausentes');
                return false;
            }

            const secret = process.env.WEBHOOK_SECRET;
            if (!secret) {
                // Se não especificado, aceitaremos mas avisamos nos logs (menos seguro)
                logger.warn('WEBHOOK_SECRET não configurado; aceitando webhook sem validação HMAC');
                return true;
            }

            const raw = req.rawBody || JSON.stringify(req.body);
            const sig = signatureHeader.replace(/^sha256=/i, '').trim();
            const crypto = require('crypto');
            const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');

            const valid = sig === expected;
            if (!valid) logger.warn('Assinatura HMAC inválida para webhook');
            return valid;
        } catch (error) {
            logger.error('Erro ao validar webhook:', error);
            return false;
        }
    }
}

module.exports = WebhookController;
