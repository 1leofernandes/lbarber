// src/models/RecurringSubscription.js
const pool = require('../config/database');

class RecurringSubscription {
    // ==================== MERCADO PAGO CONFIG ====================
    
    static async getMercadoPagoConfig(adminId) {
        const query = `
            SELECT id, admin_id, access_token, public_key, email_recebimento, status
            FROM admin_mercado_pago_config
            WHERE admin_id = $1
        `;
        const result = await pool.query(query, [adminId]);
        return result.rows[0] || null;
    }

    static async createMercadoPagoConfig(adminId, accessToken, publicKey, emailRecebimento) {
        const query = `
            INSERT INTO admin_mercado_pago_config 
            (admin_id, access_token, public_key, email_recebimento)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (admin_id) DO UPDATE SET
                access_token = $2,
                public_key = $3,
                email_recebimento = $4,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        const result = await pool.query(query, [adminId, accessToken, publicKey, emailRecebimento]);
        return result.rows[0];
    }

    // ==================== DADOS BANCÁRIOS ====================

    static async getDadosBancarios(adminId) {
        const query = `
            SELECT id, admin_id, titular_conta, banco, agencia, conta, 
                   tipo_conta, cpf_cnpj, pix_chave, status
            FROM admin_dados_bancarios
            WHERE admin_id = $1
        `;
        const result = await pool.query(query, [adminId]);
        return result.rows[0] || null;
    }

    static async createDadosBancarios(adminId, dadosData) {
        const { titularConta, banco, agencia, conta, tipoConta, cpfCnpj, pixChave } = dadosData;
        
        const query = `
            INSERT INTO admin_dados_bancarios 
            (admin_id, titular_conta, banco, agencia, conta, tipo_conta, cpf_cnpj, pix_chave)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (admin_id) DO UPDATE SET
                titular_conta = $2,
                banco = $3,
                agencia = $4,
                conta = $5,
                tipo_conta = $6,
                cpf_cnpj = $7,
                pix_chave = $8,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            adminId, titularConta, banco, agencia, conta, tipoConta, cpfCnpj, pixChave
        ]);
        
        return result.rows[0];
    }

    static async updateStatusDadosBancarios(adminId, status) {
        const query = `
            UPDATE admin_dados_bancarios
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE admin_id = $2
            RETURNING *
        `;
        const result = await pool.query(query, [status, adminId]);
        return result.rows[0];
    }

    // ==================== CARTÕES DE CLIENTE ====================

    static async getCartaoById(cartaoId) {
        const query = `
            SELECT id, usuario_id, token_cartao, ultimos_digitos, bandeira, nome_titular, status
            FROM cliente_cartoes
            WHERE id = $1
        `;
        const result = await pool.query(query, [cartaoId]);
        return result.rows[0] || null;
    }

    static async getCartoesPorUsuario(usuarioId) {
        const query = `
            SELECT id, usuario_id, token_cartao, ultimos_digitos, bandeira, nome_titular, status
            FROM cliente_cartoes
            WHERE usuario_id = $1 AND status = 'ativo'
            ORDER BY criado_em DESC
        `;
        const result = await pool.query(query, [usuarioId]);
        return result.rows;
    }

    static async createCartao(usuarioId, tokenCartao, ultimosDigitos, bandeira, nomeTitular) {
        const query = `
            INSERT INTO cliente_cartoes 
            (usuario_id, token_cartao, ultimos_digitos, bandeira, nome_titular)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, usuario_id, token_cartao, ultimos_digitos, bandeira, nome_titular, status
        `;
        
        const result = await pool.query(query, [usuarioId, tokenCartao, ultimosDigitos, bandeira, nomeTitular]);
        return result.rows[0];
    }

    static async deleteCartao(cartaoId, usuarioId) {
        const query = `
            UPDATE cliente_cartoes
            SET status = 'inativo', atualizado_em = CURRENT_TIMESTAMP
            WHERE id = $1 AND usuario_id = $2
            RETURNING id
        `;
        const result = await pool.query(query, [cartaoId, usuarioId]);
        return result.rows[0];
    }

    // ==================== ASSINATURAS RECORRENTES ====================

    static async getAssinaturaRecorrente(assinaturaRecurrenteId) {
        const query = `
            SELECT apr.*, u.email, u.nome, assu.status as status_assinatura, 
                   ast.valor, ast.servicos
            FROM assinaturas_pagamentos_recorrentes apr
            JOIN usuarios u ON apr.usuario_id = u.id
            JOIN assinaturas_usuarios assu ON apr.assinatura_usuario_id = assu.id
            JOIN assinatura ast ON apr.plano_id = ast.id
            WHERE apr.id = $1
        `;
        const result = await pool.query(query, [assinaturaRecurrenteId]);
        return result.rows[0] || null;
    }

    static async getAssinaturaRecorrentePorUsuario(usuarioId) {
        const query = `
            SELECT apr.*, u.email, u.nome, assu.status as status_assinatura,
                   ast.valor, ast.servicos, cc.ultimos_digitos, cc.bandeira
            FROM assinaturas_pagamentos_recorrentes apr
            JOIN usuarios u ON apr.usuario_id = u.id
            JOIN assinaturas_usuarios assu ON apr.assinatura_usuario_id = assu.id
            JOIN assinatura ast ON apr.plano_id = ast.id
            LEFT JOIN cliente_cartoes cc ON apr.cartao_id = cc.id
            WHERE apr.usuario_id = $1 AND apr.status = 'ativa'
            LIMIT 1
        `;
        const result = await pool.query(query, [usuarioId]);
        return result.rows[0] || null;
    }

    static async createAssinaturaRecorrente(dados) {
        const { usuarioId, assinaturaUsuarioId, planoId, cartaoId, valorMensal } = dados;
        
        const query = `
            INSERT INTO assinaturas_pagamentos_recorrentes 
            (usuario_id, assinatura_usuario_id, plano_id, cartao_id, valor_mensal, proxima_cobranca, status)
            VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '30 days', 'ativa')
            RETURNING *
        `;
        
        const result = await pool.query(query, [usuarioId, assinaturaUsuarioId, planoId, cartaoId, valorMensal]);
        return result.rows[0];
    }

    static async updateAssinaturaRecorrente(assinaturaRecurrenteId, dados) {
        const { mercadoPagoSubscriptionId } = dados;
        
        const query = `
            UPDATE assinaturas_pagamentos_recorrentes
            SET mercado_pago_subscription_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await pool.query(query, [mercadoPagoSubscriptionId, assinaturaRecurrenteId]);
        return result.rows[0];
    }

    static async cancelarAssinaturaRecorrente(assinaturaRecurrenteId, motivo) {
        const query = `
            UPDATE assinaturas_pagamentos_recorrentes
            SET status = 'cancelada', 
                motivo_cancelamento = $1,
                cancelado_em = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await pool.query(query, [motivo, assinaturaRecurrenteId]);
        return result.rows[0];
    }

    static async getAssinaturasVencidasHoje() {
        const query = `
            SELECT apr.*, u.email, u.nome, cc.token_cartao
            FROM assinaturas_pagamentos_recorrentes apr
            JOIN usuarios u ON apr.usuario_id = u.id
            LEFT JOIN cliente_cartoes cc ON apr.cartao_id = cc.id
            WHERE apr.proxima_cobranca = CURRENT_DATE 
            AND apr.status = 'ativa'
        `;
        const result = await pool.query(query);
        return result.rows;
    }

    // ==================== HISTÓRICO DE COBRANÇAS ====================

    static async createCobranca(dados) {
        const { assinaturaPagamentoId, usuarioId, valor, dataCobranca } = dados;
        
        const query = `
            INSERT INTO assinaturas_historico_cobranças 
            (assinatura_pagamento_id, usuario_id, valor, data_cobranca, status)
            VALUES ($1, $2, $3, $4, 'pendente')
            RETURNING *
        `;
        
        const result = await pool.query(query, [assinaturaPagamentoId, usuarioId, valor, dataCobranca]);
        return result.rows[0];
    }

    static async updateCobranca(cobrancaId, dados) {
        const { status, mercadoPagoPaymentId, dataProcessamento, motivoFalha } = dados;
        
        let query = `
            UPDATE assinaturas_historico_cobranças
            SET status = $1, updated_at = CURRENT_TIMESTAMP
        `;
        let params = [status, cobrancaId];
        let paramCount = 2;

        if (mercadoPagoPaymentId) {
            paramCount++;
            query += `, mercado_pago_payment_id = $${paramCount}`;
            params.splice(paramCount - 1, 0, mercadoPagoPaymentId);
        }

        if (dataProcessamento) {
            paramCount++;
            query += `, data_processamento = $${paramCount}`;
            params.splice(paramCount - 1, 0, dataProcessamento);
        }

        if (motivoFalha) {
            paramCount++;
            query += `, motivo_falha = $${paramCount}`;
            params.splice(paramCount - 1, 0, motivoFalha);
        }

        query += ` WHERE id = $${paramCount + 1} RETURNING *`;
        params.push(cobrancaId);

        const result = await pool.query(query, params);
        return result.rows[0];
    }

    static async getCobrancasComFalha() {
        const query = `
            SELECT ahc.*, apr.usuario_id, u.email
            FROM assinaturas_historico_cobranças ahc
            JOIN assinaturas_pagamentos_recorrentes apr ON ahc.assinatura_pagamento_id = apr.id
            JOIN usuarios u ON ahc.usuario_id = u.id
            WHERE ahc.status = 'falha' 
            AND ahc.tentativas < 3
            AND ahc.proxima_tentativa <= CURRENT_TIMESTAMP
            ORDER BY ahc.proxima_tentativa ASC
        `;
        const result = await pool.query(query);
        return result.rows;
    }

    static async incrementarTentativasCobranca(cobrancaId) {
        const query = `
            UPDATE assinaturas_historico_cobranças
            SET tentativas = tentativas + 1,
                proxima_tentativa = CURRENT_TIMESTAMP + INTERVAL '24 hours',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [cobrancaId]);
        return result.rows[0];
    }

    static async getHistoricoCobrancas(usuarioId, limit = 20, offset = 0) {
        const query = `
            SELECT ahc.*
            FROM assinaturas_historico_cobranças ahc
            WHERE ahc.usuario_id = $1
            ORDER BY ahc.data_cobranca DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [usuarioId, limit, offset]);
        return result.rows;
    }
}

module.exports = RecurringSubscription;
