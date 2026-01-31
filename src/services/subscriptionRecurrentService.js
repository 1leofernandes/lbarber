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
                // Verificar se assinatura pertence ao usuário
                const assinatura = await RecurringSubscription.getAssinaturaRecorrente(assinaturaRecurrenteId);

                if (!assinatura || assinatura.usuario_id !== usuarioId) {
                    throw new Error('Assinatura não encontrada ou não autorizada');
                }

                // Cancelar no Mercado Pago se necessário
                if (assinatura.mercado_pago_subscription_id) {
                    await mercadoPagoConfig.cancelSubscription(assinatura.mercado_pago_subscription_id);
                }

                // Cancelar assinatura no banco de dados
                const resultado = await RecurringSubscription.cancelarAssinaturaRecorrente(
                    assinaturaRecurrenteId,
                    motivo
                );

                // Atualizar status da assinatura do usuário
                await pool.query(
                    `UPDATE assinaturas_usuarios 
                    SET status = 'cancelada' 
                    WHERE id = $1`,
                    [assinatura.assinatura_usuario_id]
                );

                await pool.query('COMMIT');

                logger.info('Assinatura recorrente cancelada:', { assinaturaRecurrenteId, usuarioId });
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
