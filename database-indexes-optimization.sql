-- =====================================================
-- OTIMIZAÇÃO DE ÍNDICES PARA AGENDAMENTOS
-- =====================================================
-- Estes índices melhoram drasticamente a performance das consultas de agendamentos

-- Índices compostos para filtros de agendamentos
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_data ON agendamentos(status, data_agendada DESC);
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_data ON agendamentos(barbeiro_id, data_agendada DESC);
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_data ON agendamentos(usuario_id, data_agendada DESC);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_nome ON agendamentos(cliente_nome_admin);

-- Índice para busca de serviços por agendamento (crítico para performance)
CREATE INDEX IF NOT EXISTS idx_agendamento_servicos_agendamento_id ON agendamento_servicos(agendamento_id);

-- Índices para assinatura de usuários
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuarios_usuario_id_status ON assinaturas_usuarios(usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_assinatura_dias_semana_assinatura_id ON assinatura_dias_semana(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_assinatura_servico_assinatura_id ON assinatura_servico(assinatura_id);

-- Índice para usuários por role
CREATE INDEX IF NOT EXISTS idx_usuarios_role_nome ON usuarios(role, nome);

-- Verify indexes are created
\d+ agendamentos
\d+ agendamento_servicos
\d+ assinaturas_usuarios
