// src/utils/chargeScheduler.js
const subscriptionRecurrentService = require('../services/subscriptionRecurrentService');
const mercadoPago = require('../config/mercadoPago');
const pool = require('../config/database');
const logger = require('./logger');

let schedulerInterval = null;

class ChargeScheduler {
    static start() {
        // Executar a cada 1 hora
        schedulerInterval = setInterval(() => {
            this.checkAndSyncSubscriptions();
        }, 60 * 60 * 1000);

        // Executar imediatamente na inicialização
        this.checkAndSyncSubscriptions();

        logger.info('✅ Sincronizador de assinaturas iniciado (a cada 1 hora)');
    }

    static stop() {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            schedulerInterval = null;
            logger.info('Sincronizador de assinaturas parado');
        }
    }

    static async checkAndSyncSubscriptions() {
        try {
            logger.info('🔄 [SYNC] Sincronizando assinaturas com Mercado Pago...');

            // Buscar todas as assinaturas ativas
            const assinaturas = await pool.query(`
                SELECT apr.*, au.usuario_id, au.plano_id, u.email, u.nome
                FROM assinaturas_pagamentos_recorrentes apr
                JOIN assinaturas_usuarios au ON apr.assinatura_usuario_id = au.id
                JOIN usuarios u ON apr.usuario_id = u.id
                WHERE apr.status = 'ativa' 
                AND apr.mercado_pago_subscription_id IS NOT NULL
            `);

            logger.info(`📊 [SYNC] Encontradas ${assinaturas.rows.length} assinaturas ativas`);

            let atualizadas = 0;
            let erros = 0;

            // Para cada assinatura, sincronizar com MP
            for (const assinatura of assinaturas.rows) {
                try {
                    const { 
                        id: assinatura_id, 
                        usuario_id, 
                        mercado_pago_subscription_id,
                        proxima_cobranca: proxima_cobranca_antiga 
                    } = assinatura;

                    // Buscar dados da preapproval no MP
                    const detalhes = await mercadoPago.getSubscription(mercado_pago_subscription_id);

                    if (!detalhes) {
                        throw new Error('Preapproval não encontrada');
                    }

                    // Extrair informações
                    const status_mp = detalhes.status;
                    const ultima_cobranca = detalhes.summarized?.last_charged_date 
                        ? new Date(detalhes.summarized.last_charged_date) 
                        : null;
                    const proxima_cobranca = detalhes.next_payment_date 
                        ? new Date(detalhes.next_payment_date) 
                        : null;

                    // Atualizar status se foi cancelada/pausada
                    if (status_mp === 'cancelled' || status_mp === 'paused') {
                        logger.info(`⚠️ [SYNC] Usuário ${usuario_id}: Status mudou para ${status_mp}`);

                        await pool.query(`
                            UPDATE assinaturas_pagamentos_recorrentes
                            SET status = $1, 
                                motivo_cancelamento = 'Cancelado/Pausado no Mercado Pago',
                                cancelado_em = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = $2
                        `, [
                            status_mp === 'cancelled' ? 'cancelada' : 'pausada',
                            assinatura_id
                        ]);

                        atualizadas++;
                    } 
                    // Atualizar datas de cobrança se forem diferentes
                    else if (proxima_cobranca && 
                             proxima_cobranca.toDateString() !== 
                             new Date(proxima_cobranca_antiga).toDateString()) {
                        
                        logger.info(`📅 [SYNC] Usuário ${usuario_id}: Próxima cobrança ${proxima_cobranca.toLocaleDateString('pt-BR')}`);

                        await pool.query(`
                            UPDATE assinaturas_pagamentos_recorrentes
                            SET ultima_cobranca = $1,
                                proxima_cobranca = $2,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = $3
                        `, [
                            ultima_cobranca,
                            proxima_cobranca,
                            assinatura_id
                        ]);

                        atualizadas++;
                    }

                } catch (erro) {
                    erros++;
                    logger.error(`❌ [SYNC] Erro ao sincronizar usuário ${assinatura.usuario_id}: ${erro.message}`);
                }
            }

            logger.info(`✅ [SYNC] Concluído! Atualizadas: ${atualizadas} | Erros: ${erros}`);

        } catch (error) {
            logger.error('❌ [SYNC] Erro fatal na sincronização:', error.message);
        }
    }
}

module.exports = ChargeScheduler;
