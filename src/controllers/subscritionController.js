// controllers/subscriptionController.js
export const webhookMercadoPago = async (req, res) => {
    try {
        const { type, data } = req.body;
        
        if (type === 'subscription_preapproval') {
            const { id, status } = data;
            
            // Buscar assinatura pelo marketplace_pago_subscription_id
            const assinatura = await pool.query(
                'SELECT * FROM assinaturas_pagamentos_recorrentes WHERE mercado_pago_subscription_id = $1',
                [id]
            );
            
            if (assinatura.rows.length > 0) {
                // Atualizar status
                await pool.query(
                    'UPDATE assinaturas_pagamentos_recorrentes SET status = $1 WHERE mercado_pago_subscription_id = $2',
                    [status === 'authorized' ? 'ativa' : status, id]
                );
                
                // Se aprovado, atualizar usuário
                if (status === 'authorized') {
                    await pool.query(
                        `UPDATE usuarios u 
                         SET assinante = true, assinatura_id = (
                             SELECT plano_id FROM assinaturas_pagamentos_recorrentes 
                             WHERE mercado_pago_subscription_id = $1
                         )
                         FROM assinaturas_pagamentos_recorrentes apr
                         WHERE apr.mercado_pago_subscription_id = $1 
                         AND apr.usuario_id = u.id`,
                        [id]
                    );
                }
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro webhook:', error);
        res.sendStatus(500);
    }
};

// Rota para minhas assinaturas
export const minhasAssinaturas = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        
        const result = await pool.query(
            `SELECT au.*, a.nome_plano, a.descricao, a.valor,
                    apr.mercado_pago_subscription_id, apr.proxima_cobranca,
                    (SELECT COUNT(*) FROM agendamentos ag WHERE ag.assinatura_usuario_id = au.id) as total_agendamentos
             FROM assinaturas_usuarios au
             JOIN assinatura a ON au.plano_id = a.id
             LEFT JOIN assinaturas_pagamentos_recorrentes apr ON au.id = apr.assinatura_usuario_id
             WHERE au.usuario_id = $1
             ORDER BY au.created_at DESC`,
            [usuarioId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar assinaturas:', error);
        res.status(500).json({ error: 'Erro ao buscar assinaturas' });
    }
};