-- ==================== SCHEMA OTIMIZADO ====================
-- Use este schema como referência para criar/atualizar seu banco

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefone VARCHAR(20),
  senha VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'cliente', -- cliente, barbeiro
  roles VARCHAR(50), -- admin, null
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servicos (
  id SERIAL PRIMARY KEY,
  servico VARCHAR(255) NOT NULL,
  preco DECIMAL(10, 2) NOT NULL,
  duracao INT NOT NULL, -- em minutos
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  barbeiro_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servico_id INT NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  data_agendada DATE NOT NULL,
  hora_agendada TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmado', -- confirmado, cancelado, concluído
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bloqueios (
  id SERIAL PRIMARY KEY,
  barbeiro_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  motivo VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabelas para sistema de pagamentos (preparação futura)

CREATE TABLE IF NOT EXISTS planos_assinatura (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  preco DECIMAL(10, 2) NOT NULL,
  intervalo VARCHAR(50) NOT NULL, -- "mensal", "anual"
  features JSONB NOT NULL, -- Array de features
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plano_id INT NOT NULL REFERENCES planos_assinatura(id),
  status VARCHAR(50) NOT NULL DEFAULT 'ativa', -- ativa, cancelada, pausada
  stripe_subscription_id VARCHAR(255), -- Para Stripe
  pagar_me_subscription_id VARCHAR(255), -- Para Pagar.me
  data_inicio TIMESTAMP DEFAULT NOW(),
  data_proxima_cobranca DATE,
  data_cancelamento TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  assinatura_id INT REFERENCES assinaturas(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- pendente, aprovado, falhou, reembolso
  metodo VARCHAR(50) NOT NULL, -- stripe, pagar_me
  transacao_id VARCHAR(255), -- ID externo
  descricao TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criando índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_id ON agendamentos(barbeiro_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id ON agendamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_data_hora ON agendamentos(barbeiro_id, data_agendada, hora_agendada);
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuario_id ON assinaturas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_usuario_id ON pagamentos(usuario_id);
