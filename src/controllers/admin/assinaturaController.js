// src/controllers/admin/assinaturaController.js
const pool = require('../../config/database');
const logger = require('../../utils/logger');

class AssinaturaController {
    /**
     * GET /admin/assinaturas/planos - Listar todos os planos de assinatura
     */
    static async listarPlanos(req, res, next) {
        try {
            const query = `
                SELECT 
                    a.id,
                    a.nome_plano,
                    a.valor,
                    a.descricao,
                    a.status,
                    a.created_at,
                    COUNT(DISTINCT u.id) as total_assinantes,
                    ARRAY_AGG(DISTINCT ads.dia_semana ORDER BY ads.dia_semana) as dias_semana,
                    ARRAY_AGG(DISTINCT s.nome_servico) as servicos_inclusos
                FROM assinatura a
                LEFT JOIN usuarios u ON u.assinatura_id = a.id AND u.assinante = true
                LEFT JOIN assinatura_dias_semana ads ON a.id = ads.assinatura_id
                LEFT JOIN assinatura_servico asv ON a.id = asv.assinatura_id
                LEFT JOIN servicos s ON asv.servico_id = s.id
                GROUP BY a.id
                ORDER BY a.valor ASC
            `;

            const resultado = await pool.query(query);

            res.json({
                success: true,
                data: resultado.rows.map(row => ({
                    id: row.id,
                    nome_plano: row.nome_plano,
                    valor: parseFloat(row.valor),
                    descricao: row.descricao,
                    status: row.status,
                    total_assinantes: parseInt(row.total_assinantes),
                    dias_semana: row.dias_semana || [],
                    servicos_inclusos: (row.servicos_inclusos || []).filter(s => s),
                    created_at: row.created_at
                }))
            });
        } catch (error) {
            logger.error('Erro ao listar planos:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao listar planos',
                error: error.message
            });
        }
    }

    /**
     * GET /admin/assinaturas/assinantes - Listar usuários com assinatura ativa
     */
    static async listarAssinantesAtivos(req, res, next) {
        try {
            const query = `
                SELECT 
                    u.id,
                    u.nome,
                    u.email,
                    u.telefone,
                    u.assinatura_id,
                    a.nome_plano,
                    a.valor,
                    a.status as plano_status
                FROM usuarios u
                LEFT JOIN assinatura a ON u.assinatura_id = a.id
                WHERE u.assinante = true
                ORDER BY u.nome ASC
            `;

            const resultado = await pool.query(query);

            res.json({
                success: true,
                data: resultado.rows.map(row => ({
                    id: row.id,
                    nome: row.nome,
                    email: row.email,
                    telefone: row.telefone,
                    assinatura_id: row.assinatura_id,
                    plano_nome: row.nome_plano,
                    valor: row.valor ? parseFloat(row.valor) : 0,
                    plano_status: row.plano_status
                }))
            });
        } catch (error) {
            logger.error('Erro ao listar assinantes ativos:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao listar assinantes ativos',
                error: error.message
            });
        }
    }

    /**
     * GET /admin/assinaturas/:planoId - Obter detalhes de um plano
     */
    static async obterDetalhesPlano(req, res, next) {
        try {
            const { planoId } = req.params;

            const query = `
                SELECT 
                    a.id,
                    a.nome_plano,
                    a.valor,
                    a.descricao,
                    a.status,
                    a.created_at,
                    COUNT(DISTINCT u.id) as total_assinantes,
                    ARRAY_AGG(DISTINCT ads.dia_semana ORDER BY ads.dia_semana) as dias_semana,
                    JSON_AGG(JSON_BUILD_OBJECT('id', s.id, 'nome', s.nome_servico) ORDER BY s.nome_servico) as servicos
                FROM assinatura a
                LEFT JOIN usuarios u ON u.assinatura_id = a.id AND u.assinante = true
                LEFT JOIN assinatura_dias_semana ads ON a.id = ads.assinatura_id
                LEFT JOIN assinatura_servico asv ON a.id = asv.assinatura_id
                LEFT JOIN servicos s ON asv.servico_id = s.id
                WHERE a.id = $1
                GROUP BY a.id
            `;

            const resultado = await pool.query(query, [parseInt(planoId)]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Plano não encontrado'
                });
            }

            const row = resultado.rows[0];

            res.json({
                success: true,
                data: {
                    id: row.id,
                    nome_plano: row.nome_plano,
                    valor: parseFloat(row.valor),
                    descricao: row.descricao,
                    status: row.status,
                    total_assinantes: parseInt(row.total_assinantes),
                    dias_semana: row.dias_semana || [],
                    servicos: (row.servicos || []).filter(s => s.id),
                    created_at: row.created_at
                }
            });
        } catch (error) {
            logger.error('Erro ao obter detalhes do plano:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao obter detalhes do plano',
                error: error.message
            });
        }
    }

    /**
     * POST /admin/assinaturas/planos - Criar novo plano
     */
    static async criarPlano(req, res, next) {
        const client = await pool.connect();
        try {
            const { nome_plano, valor, descricao, dias_semana, servicos } = req.body;

            if (!nome_plano || !valor) {
                return res.status(400).json({
                    success: false,
                    message: 'Nome do plano e valor são obrigatórios'
                });
            }

            // Iniciar transação
            await client.query('BEGIN');

            // 1. Criar plano
            const queryPlano = `
                INSERT INTO assinatura (nome_plano, valor, descricao, status)
                VALUES ($1, $2, $3, 'ativo')
                RETURNING id
            `;
            const resultPlano = await client.query(queryPlano, [nome_plano, valor, descricao || null]);
            const planoId = resultPlano.rows[0].id;

            // 2. Inserir dias da semana (se fornecidos)
            if (dias_semana && Array.isArray(dias_semana) && dias_semana.length > 0) {
                for (const dia of dias_semana) {
                    const queryDia = `
                        INSERT INTO assinatura_dias_semana (assinatura_id, dia_semana)
                        VALUES ($1, $2)
                    `;
                    await client.query(queryDia, [planoId, dia]);
                }
            }

            // 3. Inserir serviços (se fornecidos)
            if (servicos && Array.isArray(servicos) && servicos.length > 0) {
                for (const servicoId of servicos) {
                    const queryServico = `
                        INSERT INTO assinatura_servico (assinatura_id, servico_id)
                        VALUES ($1, $2)
                    `;
                    await client.query(queryServico, [planoId, servicoId]);
                }
            }

            // Confirmar transação
            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Plano criado com sucesso',
                data: {
                    id: planoId,
                    nome_plano,
                    valor: parseFloat(valor),
                    descricao,
                    dias_semana: dias_semana || [],
                    servicos: servicos || []
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erro ao criar plano:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao criar plano',
                error: error.message
            });
        } finally {
            client.release();
        }
    }

    /**
     * PUT /admin/assinaturas/:planoId - Editar plano
     */
    static async editarPlano(req, res, next) {
        const client = await pool.connect();
        try {
            const { planoId } = req.params;
            const { nome_plano, valor, descricao, dias_semana, servicos } = req.body;

            // Iniciar transação
            await client.query('BEGIN');

            // 1. Atualizar plano
            const queryUpdate = `
                UPDATE assinatura 
                SET nome_plano = $1, valor = $2, descricao = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
            `;
            await client.query(queryUpdate, [nome_plano, valor, descricao || null, parseInt(planoId)]);

            // 2. Limpar e reinserir dias da semana
            await client.query('DELETE FROM assinatura_dias_semana WHERE assinatura_id = $1', [parseInt(planoId)]);
            if (dias_semana && Array.isArray(dias_semana) && dias_semana.length > 0) {
                for (const dia of dias_semana) {
                    const queryDia = `
                        INSERT INTO assinatura_dias_semana (assinatura_id, dia_semana)
                        VALUES ($1, $2)
                    `;
                    await client.query(queryDia, [parseInt(planoId), dia]);
                }
            }

            // 3. Limpar e reinserir serviços
            await client.query('DELETE FROM assinatura_servico WHERE assinatura_id = $1', [parseInt(planoId)]);
            if (servicos && Array.isArray(servicos) && servicos.length > 0) {
                for (const servicoId of servicos) {
                    const queryServico = `
                        INSERT INTO assinatura_servico (assinatura_id, servico_id)
                        VALUES ($1, $2)
                    `;
                    await client.query(queryServico, [parseInt(planoId), servicoId]);
                }
            }

            // Confirmar transação
            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Plano atualizado com sucesso',
                data: {
                    id: parseInt(planoId),
                    nome_plano,
                    valor: parseFloat(valor),
                    descricao
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erro ao editar plano:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao editar plano',
                error: error.message
            });
        } finally {
            client.release();
        }
    }

    /**
     * DELETE /admin/assinaturas/:planoId - Deletar plano
     */
    static async deletarPlano(req, res, next) {
        try {
            const { planoId } = req.params;

            // Verificar se há usuários com esta assinatura
            const checkQuery = `
                SELECT COUNT(*) as total FROM usuarios WHERE assinatura_id = $1 AND assinante = true
            `;
            const checkResult = await client.query(checkQuery, [parseInt(planoId)]);

            if (parseInt(checkResult.rows[0].total) > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Não é possível deletar um plano com assinantes ativos'
                });
            }

            // Deletar plano (constraints fazem cascade automático)
            const deleteQuery = `
                DELETE FROM assinatura WHERE id = $1
            `;
            const result = await pool.query(deleteQuery, [parseInt(planoId)]);

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Plano não encontrado'
                });
            }

            res.json({
                success: true,
                message: 'Plano deletado com sucesso'
            });
        } catch (error) {
            logger.error('Erro ao deletar plano:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao deletar plano',
                error: error.message
            });
        }
    }

    /**
     * GET /admin/assinaturas - Listar assinantes (alias para listarAssinantesAtivos)
     */
    static async listarAssinaturas(req, res, next) {
        return AssinaturaController.listarAssinantesAtivos(req, res, next);
    }
}

module.exports = AssinaturaController;
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

module.exports = AssinaturaController;
