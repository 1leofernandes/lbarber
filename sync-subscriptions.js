const pool = require('./src/config/database');
const mercadoPago = require('./src/config/mercadoPago');
const logger = require('./src/utils/logger');

/**
 * Script simples para sincronizar assinaturas com Mercado Pago
 * Atualiza: ultima_cobranca, proxima_cobranca, status
 * 
 * Uso: node sync-subscriptions.js
 */

async function sincronizarAssinaturas() {
    try {
        logger.info('🔄 Iniciando sincronização com Mercado Pago...\n');

        // 1. Buscar todas as assinaturas ativas
        const assinaturas = await pool.query(`
            SELECT apr.*, au.usuario_id, au.plano_id, u.email, u.nome
            FROM assinaturas_pagamentos_recorrentes apr
            JOIN assinaturas_usuarios au ON apr.assinatura_usuario_id = au.id
            JOIN usuarios u ON apr.usuario_id = u.id
            WHERE apr.status = 'ativa' 
            AND apr.mercado_pago_subscription_id IS NOT NULL
        `);

        logger.info(`✅ Encontradas ${assinaturas.rows.length} assinaturas ativas\n`);

        let atualizadas = 0;
        let erros = 0;

        // 2. Para cada assinatura, sincronizar com MP
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
                    throw new Error('Preapproval não encontrada no MP');
                }

                // Extrair informações
                const status_mp = detalhes.status;
                const ultima_cobranca = detalhes.summarized?.last_charged_date 
                    ? new Date(detalhes.summarized.last_charged_date) 
                    : null;
                const proxima_cobranca = detalhes.next_payment_date 
                    ? new Date(detalhes.next_payment_date) 
                    : null;

                logger.info(`👤 Usuário ${usuario_id}:`);
                logger.info(`   Status MP: ${status_mp}`);
                logger.info(`   Última cobrança: ${ultima_cobranca?.toLocaleDateString('pt-BR') || 'Nenhuma'}`);
                logger.info(`   Próxima cobrança: ${proxima_cobranca?.toLocaleDateString('pt-BR') || 'N/A'}`);

                // 3. Atualizar status do banco caso tenha mudado
                if (status_mp === 'cancelled' || status_mp === 'paused') {
                    logger.warn(`   ⚠️ Status diferente! Atualizando para: ${status_mp}\n`);

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
                // 4. Atualizar datas de cobrança se forem diferentes
                else if (proxima_cobranca && 
                         proxima_cobranca.toDateString() !== 
                         new Date(proxima_cobranca_antiga).toDateString()) {
                    
                    logger.info(`   📅 Atualizando datas\n`);

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
                } else {
                    logger.info(`   ✅ Já sincronizada\n`);
                }

            } catch (erro) {
                erros++;
                logger.error(`   ❌ Erro ao sincronizar: ${erro.message}\n`);
            }
        }

        logger.info(`\n========================================`);
        logger.info(`✅ Sincronização concluída!`);
        logger.info(`📊 Total: ${assinaturas.rows.length} | Atualizadas: ${atualizadas} | Erros: ${erros}`);
        logger.info(`========================================\n`);

        process.exit(0);

    } catch (error) {
        logger.error('❌ Erro fatal na sincronização:', error.message);
        process.exit(1);
    }
}

sincronizarAssinaturas();
