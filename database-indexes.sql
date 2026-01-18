-- ==================== ÍNDICES DE BANCO PARA OTIMIZAÇÃO ====================
-- Execute este arquivo para otimizar as queries

-- Índices em usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_roles ON usuarios(roles);

-- Índices em agendamentos
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_id ON agendamentos(barbeiro_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id ON agendamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_servico_id ON agendamentos(servico_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendada);
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_data_hora ON agendamentos(barbeiro_id, data_agendada, hora_agendada);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);

-- Índices em bloqueios
CREATE INDEX IF NOT EXISTS idx_bloqueios_barbeiro_id ON bloqueios(barbeiro_id);
CREATE INDEX IF NOT EXISTS idx_bloqueios_data ON bloqueios(data);
CREATE INDEX IF NOT EXISTS idx_bloqueios_barbeiro_data ON bloqueios(barbeiro_id, data);

-- Índices em servicos
CREATE INDEX IF NOT EXISTS idx_servicos_ativo ON servicos(ativo);

-- Adicione status column em agendamentos se não existir
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmado';

-- Adicione timestamps em tabelas se não existirem
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE bloqueios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
