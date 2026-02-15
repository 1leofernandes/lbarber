// src/controllers/admin/assinaturaAdminController.js
const pool = require('../../config/database');
const logger = require('../../utils/logger');

class AssinaturaAdminController {
    /**
     * GET /admin/assinaturas - Listar todas as assinaturas ativas com details
     */
    static async listarAssinaturas(req, res, next) {
        try {
            const { status = 'ativa', limit = 50, offset = 0 } = req.query;

            const query = `
                SELECT 
                    a.id,
                    a.usuario_id,
                    a.plano_id,
                    a.status,
                    a.stripe_subscription_id,
                    a.data_inicio,
                    a.data_proxima_cobranca,
                    a.created_at,
                    u.nome as usuario_nome,
                    u.email as usuario_email,
                    u.telefone as usuario_telefone,
                    p.nome as plano_nome,
                    p.preco as valor,
                    p.duracao_dias,
                    p.descricao
                FROM assinaturas a
                JOIN usuarios u ON a.usuario_id = u.id
                JOIN planos_assinatura p ON a.plano_id = p.id
                ${status ? "WHERE a.status = '" + status + "'" : ''}
                ORDER BY a.created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const resultado = await pool.query(query, [parseInt(limit), parseInt(offset)]);

            res.json({
                success: true,
                totalRecords: resultado.rows.length,
                data: resultado.rows.map(row => ({
                    id: row.id,
                    usuario_id: row.usuario_id,
                    usuario_nome: row.usuario_nome,
                    usuario_email: row.usuario_email,
                    plano_id: row.plano_id,
                    plano_nome: row.plano_nome,
                    valor: parseFloat(row.valor),
                    status: row.status,
                    data_inicio: row.data_inicio,
                    proxima_cobranca: row.data_proxima_cobranca,
                    criada_em: row.created_at
                }))
            });
        } catch (error) {
            logger.error('Erro ao listar assinaturas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao listar assinaturas',
                error: error.message
            });
        }
    }

    /**
     * GET /admin/assinaturas/:assinaturaId - Obter detalhes de uma assinatura
     */
    static async obterDetalhesAssinatura(req, res, next) {
        try {
            const { assinaturaId } = req.params;

            const query = `
                SELECT 
                    a.id,
                    a.usuario_id,
                    a.plano_id,
                    a.status,
                    a.stripe_subscription_id,
                    a.data_inicio,
                    a.data_proxima_cobranca,
                    a.data_cancelamento,
                    a.created_at,
                    a.updated_at,
                    u.nome as usuario_nome,
                    u.email as usuario_email,
                    u.telefone as usuario_telefone,
                    p.nome as plano_nome,
                    p.preco as valor,
                    p.duracao_dias,
                    p.descricao,
                    COUNT(ag.id) as total_agendamentos
                FROM assinaturas a
                JOIN usuarios u ON a.usuario_id = u.id
                JOIN planos_assinatura p ON a.plano_id = p.id
                LEFT JOIN agendamentos ag ON a.usuario_id = ag.usuario_id AND ag.data_agendada >= NOW()::date
                WHERE a.id = $1
                GROUP BY a.id, u.id, p.id
            `;

            const resultado = await pool.query(query, [parseInt(assinaturaId)]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Assinatura não encontrada'
                });
            }

            const row = resultado.rows[0];

            res.json({
                success: true,
                data: {
                    id: row.id,
                    usuario_id: row.usuario_id,
                    usuario_nome: row.usuario_nome,
                    usuario_email: row.usuario_email,
                    usuario_telefone: row.usuario_telefone,
                    plano_id: row.plano_id,
                    plano_nome: row.plano_nome,
                    valor: parseFloat(row.valor),
                    duracao_dias: row.duracao_dias,
                    descricao: row.descricao,
                    status: row.status,
                    data_inicio: row.data_inicio,
                    proxima_cobranca: row.data_proxima_cobranca,
                    data_cancelamento: row.data_cancelamento,
                    total_agendamentos_pendentes: parseInt(row.total_agendamentos),
                    criada_em: row.created_at,
                    atualizada_em: row.updated_at
                }
            });
        } catch (error) {
            logger.error('Erro ao obter detalhes da assinatura:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao obter detalhes da assinatura',
                error: error.message
            });
        }
    }

    /**
     * GET /admin/assinaturas/relatorio/resumo - Resumo de assinaturas
     */
    static async obterResumoAssinaturas(req, res, next) {
        try {
            const resumoQuery = `
                SELECT 
                    p.id,
                    p.nome,
                    p.preco,
                    COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) as assinantes_ativos,
                    COUNT(CASE WHEN a.status = 'cancelada' THEN 1 END) as assinantes_cancelados,
                    COUNT(CASE WHEN a.status = 'pausada' THEN 1 END) as assinantes_pausados,
                    COUNT(a.id) as total_assinantes,
                    COALESCE(SUM(CASE WHEN a.status = 'ativa' THEN p.preco ELSE 0 END), 0) as receita_esperada_mensal
                FROM planos_assinatura p
                LEFT JOIN assinaturas a ON p.id = a.plano_id
                GROUP BY p.id, p.nome, p.preco
                ORDER BY p.preco ASC
            `;

            const resultado = await pool.query(resumoQuery);

            res.json({
                success: true,
                data: resultado.rows.map(row => ({
                    plano_id: row.id,
                    plano_nome: row.nome,
                    preco_mensal: parseFloat(row.preco),
                    assinantes_ativos: parseInt(row.assinantes_ativos),
                    assinantes_cancelados: parseInt(row.assinantes_cancelados),
                    assinantes_pausados: parseInt(row.assinantes_pausados),
                    total_assinantes: parseInt(row.total_assinantes),
                    receita_esperada_mensal: parseFloat(row.receita_esperada_mensal)
                }))
            });
        } catch (error) {
            logger.error('Erro ao obter resumo de assinaturas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao obter resumo de assinaturas',
                error: error.message
            });
        }
    }
}

module.exports = assinaturaAdminController = AssinaturaAdminController;
