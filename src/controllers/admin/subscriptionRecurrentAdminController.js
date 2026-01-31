// src/controllers/admin/subscriptionRecurrentAdminController.js
const subscriptionRecurrentService = require('../../services/subscriptionRecurrentService');
const RecurringSubscription = require('../../models/RecurringSubscription');
const logger = require('../../utils/logger');

class SubscriptionRecurrentAdminController {
    // ==================== CONFIGURAÇÃO MERCADO PAGO ====================

    static async saveMercadoPagoConfig(req, res, next) {
        try {
            const adminId = req.user.id;
            const { accessToken, publicKey, emailRecebimento } = req.body;

            if (!accessToken || !publicKey || !emailRecebimento) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados de configuração do Mercado Pago incompletos'
                });
            }

            const config = await subscriptionRecurrentService.saveMercadoPagoConfig(
                adminId,
                accessToken,
                publicKey,
                emailRecebimento
            );

            res.status(201).json({
                success: true,
                message: 'Configuração do Mercado Pago salva com sucesso',
                config: {
                    id: config.id,
                    admin_id: config.admin_id,
                    email_recebimento: config.email_recebimento,
                    status: config.status
                }
            });
        } catch (error) {
            logger.error('Erro ao salvar configuração Mercado Pago:', error);
            next(error);
        }
    }

    static async getMercadoPagoConfig(req, res, next) {
        try {
            const adminId = req.user.id;
            const config = await RecurringSubscription.getMercadoPagoConfig(adminId);

            res.json({
                success: true,
                config: config ? {
                    id: config.id,
                    admin_id: config.admin_id,
                    email_recebimento: config.email_recebimento,
                    status: config.status
                } : null
            });
        } catch (error) {
            logger.error('Erro ao buscar configuração Mercado Pago:', error);
            next(error);
        }
    }

    // ==================== DADOS BANCÁRIOS ====================

    static async saveDadosBancarios(req, res, next) {
        try {
            const adminId = req.user.id;
            const { titularConta, banco, agencia, conta, tipoConta, cpfCnpj, pixChave } = req.body;

            if (!titularConta || !banco || !agencia || !conta || !tipoConta || !cpfCnpj) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados bancários incompletos (campos obrigatórios: titularConta, banco, agencia, conta, tipoConta, cpfCnpj)'
                });
            }

            const dados = await subscriptionRecurrentService.saveDadosBancarios(adminId, {
                titularConta,
                banco,
                agencia,
                conta,
                tipoConta,
                cpfCnpj,
                pixChave
            });

            res.status(201).json({
                success: true,
                message: 'Dados bancários salvos com sucesso',
                dados: {
                    id: dados.id,
                    admin_id: dados.admin_id,
                    titular_conta: dados.titular_conta,
                    banco: dados.banco,
                    status: dados.status
                }
            });
        } catch (error) {
            logger.error('Erro ao salvar dados bancários:', error);
            next(error);
        }
    }

    static async getDadosBancarios(req, res, next) {
        try {
            const adminId = req.user.id;
            const dados = await RecurringSubscription.getDadosBancarios(adminId);

            if (!dados) {
                return res.status(404).json({
                    success: false,
                    message: 'Dados bancários não encontrados'
                });
            }

            res.json({
                success: true,
                dados: {
                    id: dados.id,
                    admin_id: dados.admin_id,
                    titular_conta: dados.titular_conta,
                    banco: dados.banco,
                    agencia: dados.agencia,
                    conta: dados.conta,
                    tipo_conta: dados.tipo_conta,
                    cpf_cnpj: dados.cpf_cnpj,
                    pix_chave: dados.pix_chave,
                    status: dados.status
                }
            });
        } catch (error) {
            logger.error('Erro ao buscar dados bancários:', error);
            next(error);
        }
    }

    static async updateStatusDadosBancarios(req, res, next) {
        try {
            const adminId = req.user.id;
            const { status } = req.body;

            const statusValidos = ['pendente_verificacao', 'verificado', 'rejeitado'];
            if (!statusValidos.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status inválido'
                });
            }

            const dados = await RecurringSubscription.updateStatusDadosBancarios(adminId, status);

            res.json({
                success: true,
                message: 'Status dos dados bancários atualizado',
                dados
            });
        } catch (error) {
            logger.error('Erro ao atualizar status dos dados bancários:', error);
            next(error);
        }
    }

    // ==================== ASSINATURAS RECORRENTES (ADMIN) ====================

    static async listarAssinaturasRecorrentes(req, res, next) {
        try {
            const { status = 'ativa', limit = 50, offset = 0 } = req.query;

            const query = `
                SELECT apr.*, u.nome, u.email, ast.valor
                FROM assinaturas_pagamentos_recorrentes apr
                JOIN usuarios u ON apr.usuario_id = u.id
                JOIN assinatura ast ON apr.plano_id = ast.id
                ${status ? "WHERE apr.status = '" + status + "'" : ''}
                ORDER BY apr.created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const pool = require('../../config/database');
            const resultado = await pool.query(query, [parseInt(limit), parseInt(offset)]);

            res.json({
                success: true,
                assinaturas: resultado.rows
            });
        } catch (error) {
            logger.error('Erro ao listar assinaturas recorrentes:', error);
            next(error);
        }
    }

    static async getAssinaturaRecorrenteDetalhes(req, res, next) {
        try {
            const { assinaturaId } = req.params;

            const assinatura = await RecurringSubscription.getAssinaturaRecorrente(parseInt(assinaturaId));

            if (!assinatura) {
                return res.status(404).json({
                    success: false,
                    message: 'Assinatura não encontrada'
                });
            }

            res.json({
                success: true,
                assinatura
            });
        } catch (error) {
            logger.error('Erro ao buscar detalhes da assinatura:', error);
            next(error);
        }
    }

    // ==================== HISTÓRICO DE COBRANÇAS (ADMIN) ====================

    static async listarCobrancas(req, res, next) {
        try {
            const { status, dataInicio, dataFim, limit = 50, offset = 0 } = req.query;

            let query = `
                SELECT ahc.*, u.nome, u.email
                FROM assinaturas_historico_cobranças ahc
                JOIN usuarios u ON ahc.usuario_id = u.id
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 1;

            if (status) {
                query += ` AND ahc.status = $${paramCount}`;
                params.push(status);
                paramCount++;
            }

            if (dataInicio) {
                query += ` AND ahc.data_cobranca >= $${paramCount}`;
                params.push(dataInicio);
                paramCount++;
            }

            if (dataFim) {
                query += ` AND ahc.data_cobranca <= $${paramCount}`;
                params.push(dataFim);
                paramCount++;
            }

            query += ` ORDER BY ahc.data_cobranca DESC
                      LIMIT $${paramCount} OFFSET $${paramCount + 1}`;

            params.push(parseInt(limit), parseInt(offset));

            const pool = require('../../config/database');
            const resultado = await pool.query(query, params);

            res.json({
                success: true,
                cobrancas: resultado.rows
            });
        } catch (error) {
            logger.error('Erro ao listar cobranças:', error);
            next(error);
        }
    }

    static async getResumoAssinaturas(req, res, next) {
        try {
            const pool = require('../../config/database');

            const [assinaturasAtivas, assinaturasEncerradas, receitaMês, proximasCobrancas] = await Promise.all([
                pool.query(
                    `SELECT COUNT(*) as total FROM assinaturas_pagamentos_recorrentes 
                    WHERE status = 'ativa'`
                ),
                pool.query(
                    `SELECT COUNT(*) as total FROM assinaturas_pagamentos_recorrentes 
                    WHERE status = 'cancelada'`
                ),
                pool.query(
                    `SELECT SUM(valor) as total FROM assinaturas_historico_cobranças 
                    WHERE status = 'aprovada' 
                    AND EXTRACT(YEAR FROM data_cobranca) = EXTRACT(YEAR FROM CURRENT_DATE)
                    AND EXTRACT(MONTH FROM data_cobranca) = EXTRACT(MONTH FROM CURRENT_DATE)`
                ),
                pool.query(
                    `SELECT COUNT(*) as total FROM assinaturas_pagamentos_recorrentes 
                    WHERE status = 'ativa' AND proxima_cobranca = CURRENT_DATE`
                )
            ]);

            res.json({
                success: true,
                resumo: {
                    assinaturasAtivas: parseInt(assinaturasAtivas.rows[0].total),
                    assinaturasEncerradas: parseInt(assinaturasEncerradas.rows[0].total),
                    receitaMês: parseFloat(receitaMês.rows[0].total || 0),
                    proximasCobrancas: parseInt(proximasCobrancas.rows[0].total)
                }
            });
        } catch (error) {
            logger.error('Erro ao buscar resumo de assinaturas:', error);
            next(error);
        }
    }
}

module.exports = SubscriptionRecurrentAdminController;
