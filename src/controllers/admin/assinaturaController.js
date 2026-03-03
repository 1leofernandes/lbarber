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
                    COUNT(DISTINCT au.usuario_id) as total_assinantes,
                    ARRAY_AGG(DISTINCT ads.dia_semana ORDER BY ads.dia_semana) FILTER (WHERE ads.dia_semana IS NOT NULL) as dias_semana,
                    ARRAY_AGG(DISTINCT s.nome_servico) FILTER (WHERE s.nome_servico IS NOT NULL) as servicos_inclusos
                FROM assinatura a
                LEFT JOIN assinatura_dias_semana ads ON a.id = ads.assinatura_id
                LEFT JOIN assinatura_servico asv ON a.id = asv.assinatura_id
                LEFT JOIN servicos s ON asv.servico_id = s.id
                LEFT JOIN assinaturas_usuarios au ON a.id = au.plano_id AND au.status = 'ativa'
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
                    total_assinantes: parseInt(row.total_assinantes || 0),
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
                    a.id as assinatura_id,          -- id do plano (tabela assinatura)
                    a.nome_plano,
                    a.valor,
                    a.status as plano_status
                FROM usuarios u
                LEFT JOIN assinaturas_usuarios au ON u.id = au.usuario_id 
                    AND au.status = 'ativa'          -- considera apenas assinaturas ativas (opcional)
                LEFT JOIN assinatura a ON au.plano_id = a.id
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
                    assinatura_id: row.assinatura_id,   // agora é o id do plano correto
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
                    COUNT(DISTINCT au.usuario_id) as total_assinantes,
                    ARRAY_AGG(DISTINCT ads.dia_semana ORDER BY ads.dia_semana) FILTER (WHERE ads.dia_semana IS NOT NULL) as dias_semana,
                    JSON_AGG(JSON_BUILD_OBJECT('id', s.id, 'nome', s.nome_servico) ORDER BY s.nome_servico) FILTER (WHERE s.id IS NOT NULL) as servicos
                FROM assinatura a
                LEFT JOIN assinatura_dias_semana ads ON a.id = ads.assinatura_id
                LEFT JOIN assinatura_servico asv ON a.id = asv.assinatura_id
                LEFT JOIN servicos s ON asv.servico_id = s.id
                LEFT JOIN assinaturas_usuarios au ON a.id = au.plano_id AND au.status = 'ativa'
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
                SET nome_plano = $1, valor = $2, descricao = $3
                WHERE id = $4
                RETURNING id
            `;
            const updateResult = await client.query(queryUpdate, [nome_plano, valor, descricao || null, parseInt(planoId)]);
            
            if (updateResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Plano não encontrado'
                });
            }

            // 2. Limpar e reinserir dias da semana (se fornecidos)
            if (dias_semana !== undefined) {
                await client.query('DELETE FROM assinatura_dias_semana WHERE assinatura_id = $1', [parseInt(planoId)]);
                if (dias_semana && Array.isArray(dias_semana) && dias_semana.length > 0) {
                    for (const dia of dias_semana) {
                        const queryDia = `
                            INSERT INTO assinatura_dias_semana (assinatura_id, dia_semana)
                            VALUES ($1, $2)
                            ON CONFLICT (assinatura_id, dia_semana) DO NOTHING
                        `;
                        await client.query(queryDia, [parseInt(planoId), dia]);
                    }
                }
            }

            // 3. Limpar e reinserir serviços (se fornecidos)
            if (servicos !== undefined) {
                await client.query('DELETE FROM assinatura_servico WHERE assinatura_id = $1', [parseInt(planoId)]);
                if (servicos && Array.isArray(servicos) && servicos.length > 0) {
                    for (const servicoId of servicos) {
                        const queryServico = `
                            INSERT INTO assinatura_servico (assinatura_id, servico_id)
                            VALUES ($1, $2)
                            ON CONFLICT (assinatura_id, servico_id) DO NOTHING
                        `;
                        await client.query(queryServico, [parseInt(planoId), servicoId]);
                    }
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
     * DELETE /admin/assinaturas/planos/:planoId - Deletar plano
     */
    static async deletarPlano(req, res, next) {
        try {
            const { planoId } = req.params;

            // Verificar se há usuários com esta assinatura
            const checkQuery = `
                SELECT COUNT(DISTINCT usuario_id) as total FROM assinaturas_usuarios WHERE plano_id = $1 AND status = 'ativa'
            `;
            const checkResult = await pool.query(checkQuery, [parseInt(planoId)]);

            if (parseInt(checkResult.rows[0].total) > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Não é possível deletar um plano com assinantes ativos'
                });
            }

            // Deletar plano (constraints fazem cascade automático)
            const deleteQuery = `
                DELETE FROM assinatura WHERE id = $1
                RETURNING id
            `;
            const result = await pool.query(deleteQuery, [parseInt(planoId)]);

            if (result.rows.length === 0) {
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

    /**
     * GET /admin/assinaturas/relatorio/resumo - Resumo de assinaturas
     */
    static async obterResumoAssinaturas(req, res, next) {
        try {
            const resumoQuery = `
                SELECT 
                    a.id,
                    a.nome_plano,
                    a.valor,
                    COUNT(DISTINCT au.usuario_id) as total_assinantes,
                    COALESCE(COUNT(DISTINCT au.usuario_id) * a.valor, 0) as receita_esperada_mensal
                FROM assinatura a
                LEFT JOIN assinaturas_usuarios au ON a.id = au.plano_id AND au.status = 'ativa'
                GROUP BY a.id
                ORDER BY a.valor ASC
            `;

            const resultado = await pool.query(resumoQuery);

            res.json({
                success: true,
                data: resultado.rows.map(row => ({
                    plano_id: row.id,
                    plano_nome: row.nome_plano,
                    preco_mensal: parseFloat(row.valor),
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
        