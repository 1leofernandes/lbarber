-- ============================================
-- TABELA DE AGENDAMENTOS - SCHEMA DEFINIDO
-- ============================================
-- Essa tabela armazena todos os agendamentos de clientes
-- com barbeiros. Usa hora_inicio e hora_fim para
-- suportar serviços com durações variáveis.

CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  barbeiro_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  data_agendada DATE NOT NULL,
  hora_inicio TIME NOT NULL,           -- Ex: 10:00
  hora_fim TIME NOT NULL,              -- Ex: 11:00 (calculado de duracao_servico)
  status VARCHAR(20) DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'concluido', 'cancelado')),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices para queries comuns
  CONSTRAINT check_hora_valida CHECK (hora_fim > hora_inicio),
  CONSTRAINT check_data_futura CHECK (data_agendada >= CURRENT_DATE),
  CONSTRAINT check_mesmo_barbeiro CHECK (barbeiro_id != usuario_id)
);

-- Índices para performance
CREATE INDEX idx_agendamentos_barbeiro_data 
ON agendamentos(barbeiro_id, data_agendada);

CREATE INDEX idx_agendamentos_usuario_data 
ON agendamentos(usuario_id, data_agendada);

CREATE INDEX idx_agendamentos_data_status 
ON agendamentos(data_agendada, status);

CREATE INDEX idx_agendamentos_intervalo 
ON agendamentos(barbeiro_id, data_agendada, hora_inicio, hora_fim);

-- ============================================
-- EXPLICAÇÃO DO DESIGN
-- ============================================
/*
Por que usar hora_inicio e hora_fim?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SUPORTE A DURAÇÕES VARIÁVEIS:
   ✅ Corte = 30 min (10:00 - 10:30)
   ✅ Barba = 30 min (10:30 - 11:00)
   ✅ Corte + Barba = 60 min (10:00 - 11:00)
   
2. BLOQUEIO DE MÚLTIPLOS HORÁRIOS:
   ✅ 1 agendamento bloqueia automaticamente o intervalo inteiro
   ✅ Consulta rápida: SELECT * WHERE hora_inicio < $fim AND hora_fim > $inicio
   
3. COMPATIBILIDADE COM BLOQUEIOS:
   ✅ Tabela bloqueios também usa hora_inicio/hora_fim
   ✅ Uma única query UNION para encontrar indisponibilidades
   
4. FLEXIBILIDADE:
   ✅ Pode-se agendar serviços que duram 15, 30, 45, 60+ minutos
   ✅ Barber pode ter pausas (bloqueios) de qualquer duração
   ✅ Fácil implementar "buffer time" entre agendamentos

FLUXO DE FUNCIONAMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━

1. Cliente escolhe serviço (ex: "Corte + Barba" = 60 min)
2. Frontend faz GET /agendamentos/disponiveis?barbeiro_id=5&data_agendada=2024-01-15&servico_id=2
3. Backend:
   - Busca duracao_servico da tabela servicos (60 minutos)
   - Query bloqueios E agendamentos do dia
   - Gera slots de 30 em 30 minutos (08:00, 08:30, 09:00, ...)
   - Para cada slot, verifica se cabe o serviço (60 min)
   - Retorna apenas slots que têm espaço
4. Cliente seleciona "10:00"
5. Frontend faz POST /agendamentos com hora_inicio=10:00
6. Backend:
   - Calcula hora_fim = 10:00 + 60 min = 11:00
   - Insere: (usuario_id, barbeiro_id, servico_id, data_agendada, 10:00, 11:00)
   - Bloqueia 10:00-11:00 automaticamente

QUERIES OTIMIZADAS:
━━━━━━━━━━━━━━━━━━

-- Verificar conflitos:
SELECT id FROM agendamentos
WHERE barbeiro_id = $1
  AND data_agendada = $2
  AND hora_inicio < $4           -- slot_fim
  AND hora_fim > $3              -- slot_inicio
  AND status != 'cancelado';

-- Listar horários indisponíveis:
SELECT hora_inicio, hora_fim FROM agendamentos
WHERE barbeiro_id = $1 AND data_agendada = $2 AND status != 'cancelado'
UNION
SELECT hora_inicio, hora_fim FROM bloqueios
WHERE id_barbeiro = $1 AND data = $2;

-- Agendamentos do barbeiro (com detalhes):
SELECT a.id, a.data_agendada, a.hora_inicio, a.hora_fim,
       c.nome as cliente, s.nome_servico as servico
FROM agendamentos a
INNER JOIN usuarios c ON a.usuario_id = c.id
INNER JOIN servicos s ON a.servico_id = s.id
WHERE a.barbeiro_id = $1
ORDER BY a.data_agendada, a.hora_inicio;
*/
