// src/services/subscriptionRecurrentService.js
const RecurringSubscription = require('../models/RecurringSubscription');
const mercadoPagoConfig = require('../config/mercadoPago');
const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

class SubscriptionRecurrentService {
    // ==================== CONFIGURAÇÃO DO ADMIN ====================

    async saveMercadoPagoConfig(adminId, accessToken, publicKey, emailRecebimento) {
        try {
            // Inicializar Mercado Pago com o token fornecido
            await mercadoPagoConfig.initialize(accessToken);

            const config = await RecurringSubscription.createMercadoPagoConfig(
                adminId,
                accessToken,
                publicKey,
                emailRecebimento
            );

            logger.info('Configuração do Mercado Pago salva para admin:', { adminId });
            return config;
        } catch (error) {
            logger.error('Erro ao salvar configuração Mercado Pago:', error);
            throw error;
        }
    }

    async saveDadosBancarios(adminId, dadosData) {
        try {
            // Validar dados bancários
            this.validarDadosBancarios(dadosData);

            const dados = await RecurringSubscription.createDadosBancarios(adminId, dadosData);

            logger.info('Dados bancários salvos para admin:', { adminId });
            return dados;
        } catch (error) {
            logger.error('Erro ao salvar dados bancários:', error);
            throw error;
        }
    }

    validarDadosBancarios(dados) {
        const { titularConta, banco, agencia, conta, tipoConta, cpfCnpj } = dados;

        if (!titularConta || titularConta.trim().length < 3) {
            throw new Error('Titular da conta deve ter pelo menos 3 caracteres');
        }

        if (!banco || banco.trim().length === 0) {
            throw new Error('Banco é obrigatório');
        }

        if (!agencia || agencia.trim().length === 0) {
            throw new Error('Agência é obrigatória');
        }

        if (!conta || conta.trim().length === 0) {
            throw new Error('Conta é obrigatória');
        }

        if (!['corrente', 'poupanca'].includes(tipoConta)) {
            throw new Error('Tipo de conta deve ser "corrente" ou "poupanca"');
        }

        // Validar CPF ou CNPJ básico
        if (!cpfCnpj || cpfCnpj.replace(/\D/g, '').length < 11) {
            throw new Error('CPF ou CNPJ inválido');
        }
    }

    // ==================== CARTÕES DO CLIENTE ====================

    async saveCartaoCliente(usuarioId, cartaoData) {
        try {
            const { numeroCartao, mesValidade, anoValidade, codigoSeguranca, nomeTitular } = cartaoData;

            // Criar token no Mercado Pago
            const cardToken = await mercadoPagoConfig.createCardToken({
                numeroCartao,
                mesValidade,
                anoValidade,
                codigoSeguranca,
                nomeTitular
            });

            if (!cardToken || !cardToken.id) {
                throw new Error('Erro ao criar token de cartão');
            }

            // Salvar cartão no banco de dados
            const ultimosDigitos = numeroCartao.slice(-4);
            const bandeira = this.detectarBandeira(numeroCartao);

            const cartao = await RecurringSubscription.createCartao(
                usuarioId,
                cardToken.id,
                ultimosDigitos,
                bandeira,
                nomeTitular
            );

            logger.info('Cartão salvo para usuário:', { usuarioId, ultimosDigitos });
            return {
                id: cartao.id,
                ultimosDigitos: cartao.ultimos_digitos,
                bandeira: cartao.bandeira,
                nomeTitular: cartao.nome_titular
            };
        } catch (error) {
            logger.error('Erro ao salvar cartão:', error);
            throw error;
        }
    }

    detectarBandeira(numeroCartao) {
        const numero = numeroCartao.replace(/\D/g, '');
        
        if (/^4[0-9]{12}(?:[0-9]{3})?$/.test(numero)) {
            return 'Visa';
        } else if (/^5[1-5][0-9]{14}$/.test(numero)) {
            return 'Mastercard';
        } else if (/^3[47][0-9]{13}$/.test(numero)) {
            return 'Amex';
        } else if (/^6(?:011|5[0-9]{2})[0-9]{12}$/.test(numero)) {
            return 'Discover';
        } else if (/^(?:2131|1800|35\d{3})\d{11}$/.test(numero)) {
            return 'JCB';
        }
        
        return 'Desconhecida';
    }

    async deleteCartao(cartaoId, usuarioId) {
        try {
            const cartao = await RecurringSubscription.deleteCartao(cartaoId, usuarioId);
            
            if (!cartao) {
                throw new Error('Cartão não encontrado');
            }

            logger.info('Cartão deletado:', { cartaoId, usuarioId });
            return cartao;
        } catch (error) {
            logger.error('Erro ao deletar cartão:', error);
            throw error;
        }
    }

    // ==================== CRIAR ASSINATURA RECORRENTE ====================

    async criarAssinaturaRecorrente(usuarioId, assinaturaUsuarioId, planoId, cartaoId, emailCliente, nomeCliente) {
        try {
            // Iniciar transação
            await pool.query('BEGIN');

            try {
                // Buscar assinatura do usuário
                const assinaturaUsuario = await pool.query(
                    'SELECT * FROM assinaturas_usuarios WHERE id = $1 AND usuario_id = $2',
                    [assinaturaUsuarioId, usuarioId]
                );

                if (assinaturaUsuario.rows.length === 0) {
                    throw new Error('Assinatura do usuário não encontrada');
                }

                // Buscar plano
                const plano = await pool.query(
                    'SELECT * FROM assinatura WHERE id = $1',
                    [planoId]
                );

                if (plano.rows.length === 0) {
                    throw new Error('Plano não encontrado');
                }

                // Buscar cartão
                const cartao = await RecurringSubscription.getCartaoById(cartaoId);
                if (!cartao) {
                    throw new Error('Cartão não encontrado');
                }

                // Criar assinatura recorrente
                const assinaturaRecorrente = await RecurringSubscription.createAssinaturaRecorrente({
                    usuarioId,
                    assinaturaUsuarioId,
                    planoId,
                    cartaoId,
                    valorMensal: plano.rows[0].valor
                });

                // TODO: Criar plano e assinatura no Mercado Pago (se necessário)
                // const mpPlan = await mercadoPagoConfig.createSubscriptionPlan({...});
                // const mpSubscription = await mercadoPagoConfig.createSubscription({...});

                // Atualizar assinatura recorrente com ID do Mercado Pago
                // await RecurringSubscription.updateAssinaturaRecorrente(assinaturaRecorrente.id, {
                //     mercadoPagoSubscriptionId: mpSubscription.id
                // });

                await pool.query('COMMIT');

                logger.info('Assinatura recorrente criada:', { usuarioId, planoId });
                return assinaturaRecorrente;
            } catch (error) {
                await pool.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            logger.error('Erro ao criar assinatura recorrente:', error);
            throw error;
        }
    }

    // ==================== PROCESSAR COBRANÇAS ====================

    async processarCobrancasDiarias() {
        try {
            logger.info('Iniciando processamento de cobranças diárias...');

            // Buscar assinaturas vencidas hoje
            const assinaturasVencidas = await RecurringSubscription.getAssinaturasVencidasHoje();

            if (assinaturasVencidas.length === 0) {
                logger.info('Nenhuma assinatura vencida hoje');
                return;
            }

            logger.info(`Encontradas ${assinaturasVencidas.length} assinaturas vencidas para processar`);

            for (const assinatura of assinaturasVencidas) {
                await this.processarCobranca(assinatura);
            }

            logger.info('Processamento de cobranças diárias concluído');
        } catch (error) {
            logger.error('Erro ao processar cobranças diárias:', error);
        }
    }

    async processarCobranca(assinatura) {
        try {
            const { id, usuario_id, valor_mensal, proxima_cobranca } = assinatura;

            // Criar registro de cobrança
            const cobranca = await RecurringSubscription.createCobranca({
                assinaturaPagamentoId: id,
                usuarioId: usuario_id,
                valor: valor_mensal,
                dataCobranca: proxima_cobranca
            });

            // Processar pagamento no Mercado Pago
            try {
                const payment = await this.procesarPagamentoMercadoPago(assinatura, cobranca);

                // Atualizar cobrança com sucesso
                await RecurringSubscription.updateCobranca(cobranca.id, {
                    status: payment.status === 'approved' ? 'aprovada' : 'pendente',
                    mercadoPagoPaymentId: payment.id,
                    dataProcessamento: new Date()
                });

                // Atualizar próxima cobrança
                if (payment.status === 'approved') {
                    await pool.query(
                        `UPDATE assinaturas_pagamentos_recorrentes 
                        SET proxima_cobranca = CURRENT_DATE + INTERVAL '30 days',
                            ultima_cobranca = CURRENT_DATE
                        WHERE id = $1`,
                        [id]
                    );

                    logger.info('Cobrança processada com sucesso:', { assinatura_id: id });
                }
            } catch (error) {
                // Atualizar cobrança com falha
                await RecurringSubscription.updateCobranca(cobranca.id, {
                    status: 'falha',
                    motivoFalha: error.message
                });

                // Incrementar tentativas
                await RecurringSubscription.incrementarTentativasCobranca(cobranca.id);

                logger.warn('Falha ao processar cobrança:', { assinatura_id: id, erro: error.message });
            }
        } catch (error) {
            logger.error('Erro ao processar cobrança individual:', error);
        }
    }

    async procesarPagamentoMercadoPago(assinatura, cobranca) {
        try {
            const { usuario_id, valor_mensal, email, nome, token_cartao } = assinatura;

            // Criar chave única para idempotência
            const idempotenciaKey = crypto.randomUUID();

            const payment = await mercadoPagoConfig.createPayment({
                valor: valor_mensal,
                descricao: `Assinatura Recorrente - Cobrança #${cobranca.id}`,
                emailCliente: email,
                nomeCliente: nome,
                cartaoToken: token_cartao,
                idempotenciaKey
            });

            return payment;
        } catch (error) {
            logger.error('Erro ao processar pagamento no Mercado Pago:', error);
            throw error;
        }
    }

    // ==================== CANCELAR ASSINATURA ====================

    async cancelarAssinatura(assinaturaRecurrenteId, usuarioId, motivo) {
        try {
            await pool.query('BEGIN');

            try {
                // Tentar buscar assinatura considerando que o ID recebido pode ser id de `assinaturas_pagamentos_recorrentes` (apr.id)
                // ou `assinaturas_usuarios` (assinatura_usuario_id)
                let assinatura = await RecurringSubscription.getAssinaturaRecorrente(assinaturaRecurrenteId);
                let pagamentoRecorrenteId = assinaturaRecurrenteId;

                if (!assinatura) {
                    // Interpretar como assinatura_usuario_id e buscar o pagamento recorrente ativo correspondente
                    const q = await pool.query(
                        `SELECT id, usuario_id, assinatura_usuario_id, mercado_pago_subscription_id FROM assinaturas_pagamentos_recorrentes WHERE assinatura_usuario_id = $1 AND status = 'ativa' LIMIT 1`,
                        [assinaturaRecurrenteId]
                    );

                    if (q.rows.length === 0) {
                        throw new Error('Assinatura não encontrada ou não autorizada');
                    }

                    pagamentoRecorrenteId = q.rows[0].id;
                    assinatura = {
                        usuario_id: q.rows[0].usuario_id,
                        assinatura_usuario_id: q.rows[0].assinatura_usuario_id,
                        mercado_pago_subscription_id: q.rows[0].mercado_pago_subscription_id
                    };
                }

                if (assinatura.usuario_id !== usuarioId) {
                    throw new Error('Assinatura não encontrada ou não autorizada');
                }

                // Cancelar no Mercado Pago se necessário
                if (assinatura.mercado_pago_subscription_id) {
                    await mercadoPagoConfig.cancelSubscription(assinatura.mercado_pago_subscription_id);
                }

                // Cancelar assinatura no banco de dados (usando pagamento_recorrente_id)
                const resultado = await RecurringSubscription.cancelarAssinaturaRecorrente(
                    pagamentoRecorrenteId,
                    motivo
                );

                // Atualizar status da assinatura do usuário
                await pool.query(
                    `UPDATE assinaturas_usuarios 
                    SET status = 'cancelada', data_fim = CURRENT_DATE 
                    WHERE id = $1`,
                    [assinatura.assinatura_usuario_id]
                );

                await pool.query('COMMIT');

                logger.info('Assinatura recorrente cancelada:', { pagamentoRecorrenteId, usuarioId });
                return resultado;
            } catch (error) {
                await pool.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            logger.error('Erro ao cancelar assinatura:', error);
            throw error;
        }
    }

    // ==================== BUSCAR ASSINATURA ====================

    async getAssinaturaRecorrentePorUsuario(usuarioId) {
        try {
            return await RecurringSubscription.getAssinaturaRecorrentePorUsuario(usuarioId);
        } catch (error) {
            logger.error('Erro ao buscar assinatura recorrente:', error);
            throw error;
        }
    }

    // Confirmar assinatura quando recebemos preapprovalId (retorno do Mercado Pago)
    async confirmarAssinaturaPorPreapproval(preapprovalId, usuarioId) {
        try {
            const mp = require('../config/mercadoPago');
            const detalhes = await mp.getSubscription(preapprovalId);

            if (!detalhes) throw new Error('Detalhes da assinatura não encontrados no Mercado Pago');

            const externalReference = detalhes.external_reference;
            if (!externalReference) throw new Error('Assinatura sem external_reference');

            const match = externalReference.match(/usuario_(\d+)_plano_(\d+)/);
            if (!match) throw new Error('External reference em formato inválido');

            const usuarioIdRef = parseInt(match[1]);
            const planoId = parseInt(match[2]);

            if (usuarioIdRef !== usuarioId) {
                throw new Error('Esta assinatura não pertence a você');
            }

            // Se já existe assinatura ativa para esse usuário/plano, apenas atualizar campos
            if (detalhes.status === 'authorized' || detalhes.status === 'active') {
                const poolLocal = require('../config/database');

                const planoRes = await poolLocal.query('SELECT id, valor FROM assinatura WHERE id = $1', [planoId]);
                if (planoRes.rows.length === 0) throw new Error('Plano não encontrado');

                const plano = planoRes.rows[0];

                await poolLocal.query('BEGIN');

                // Verificar se já existe uma assinatura ativa para este usuário/plano
                const existing = await poolLocal.query(
                    `SELECT * FROM assinaturas_usuarios WHERE usuario_id = $1 AND plano_id = $2 AND status = 'ativa' LIMIT 1`,
                    [usuarioId, planoId]
                );

                let assinaturaUsuarioId;
                if (existing.rows.length > 0) {
                    assinaturaUsuarioId = existing.rows[0].id;

                    // Verificar se já existe um registro de pagamento recorrente
                    const percor = await poolLocal.query(
                        `SELECT * FROM assinaturas_pagamentos_recorrentes WHERE assinatura_usuario_id = $1 LIMIT 1`,
                        [assinaturaUsuarioId]
                    );

                    if (percor.rows.length === 0) {
                        const insertRecorrente = await poolLocal.query(
                            `INSERT INTO assinaturas_pagamentos_recorrentes
                            (usuario_id, assinatura_usuario_id, plano_id, mercado_pago_subscription_id, 
                            valor_mensal, proxima_cobranca, status, created_at)
                            VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '30 days', 'ativa', CURRENT_TIMESTAMP) 
                            RETURNING *`,
                            [usuarioId, assinaturaUsuarioId, planoId, preapprovalId, plano.valor]
                        );

                        await poolLocal.query(
                            `UPDATE usuarios 
                            SET assinante = true, assinatura_id = $1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = $2`,
                            [assinaturaUsuarioId, usuarioId]
                        );

                        await poolLocal.query('COMMIT');
                        logger.info('Assinatura confirmada via preapproval (existing usuario):', { usuarioId, preapprovalId });
                        return insertRecorrente.rows[0];
                    } else {
                        // Atualizar mercado id se necessário e retornar
                        const atualizar = await poolLocal.query(
                            `UPDATE assinaturas_pagamentos_recorrentes SET mercado_pago_subscription_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
                            [preapprovalId, percor.rows[0].id]
                        );

                        await poolLocal.query(
                            `UPDATE usuarios 
                            SET assinante = true, assinatura_id = $1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = $2`,
                            [assinaturaUsuarioId, usuarioId]
                        );

                        await poolLocal.query('COMMIT');
                        logger.info('Assinatura confirmada via preapproval (updated recorrente):', { usuarioId, preapprovalId });
                        return atualizar.rows[0];
                    }
                } else {
                    // Criar assinatura do usuário
                    const insertUsuarioAssinatura = await poolLocal.query(
                        `INSERT INTO assinaturas_usuarios 
                        (usuario_id, plano_id, status, data_inicio, proxima_cobranca, created_at)
                        VALUES ($1, $2, 'ativa', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_TIMESTAMP) 
                        RETURNING *`,
                        [usuarioId, planoId]
                    );

                    assinaturaUsuarioId = insertUsuarioAssinatura.rows[0].id;

                    const insertRecorrente = await poolLocal.query(
                        `INSERT INTO assinaturas_pagamentos_recorrentes
                        (usuario_id, assinatura_usuario_id, plano_id, mercado_pago_subscription_id, 
                        valor_mensal, proxima_cobranca, status, created_at)
                        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '30 days', 'ativa', CURRENT_TIMESTAMP) 
                        RETURNING *`,
                        [usuarioId, assinaturaUsuarioId, planoId, preapprovalId, plano.valor]
                    );

                    await poolLocal.query(
                        `UPDATE usuarios 
                        SET assinante = true, assinatura_id = $1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2`,
                        [assinaturaUsuarioId, usuarioId]
                    );

                    await poolLocal.query('COMMIT');
                    logger.info('Assinatura confirmada via preapproval:', { usuarioId, preapprovalId });
                    return insertRecorrente.rows[0];
                }
            } else {
                throw new Error(`Assinatura com status inválido: ${detalhes.status}`);
            }
        } catch (error) {
            logger.error('Erro ao confirmar assinatura por preapproval:', error);
            throw error;
        }
    }

    async getHistoricoCobrancas(usuarioId, limit = 20, offset = 0) {
        try {
            return await RecurringSubscription.getHistoricoCobrancas(usuarioId, limit, offset);
        } catch (error) {
            logger.error('Erro ao buscar histórico de cobranças:', error);
            throw error;
        }
    }

    async getCartoesPorUsuario(usuarioId) {
        try {
            return await RecurringSubscription.getCartoesPorUsuario(usuarioId);
        } catch (error) {
            logger.error('Erro ao buscar cartões:', error);
            throw error;
        }
    }
}

module.exports = new SubscriptionRecurrentService();
