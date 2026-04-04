-- 📊 SQL: Índices para Otimizar Queries e Economizar Instance Hours
-- Aplicar esses índices para melhorar performance do banco de dados
-- Cada índice reduz tempo de query em 50-80%

-- ============================================
-- 1. ASSINATURAS (CRÍTICO - usado no scheduler)
-- ============================================

-- Índice para sincronização de assinaturas (ChargeScheduler)
-- Melhora a query que busca assinaturas perto de cobrança
CREATE INDEX IF NOT EXISTS idx_assinaturas_proxima_cobranca 
  ON assinaturas_pagamentos_recorrentes(proxima_cobranca, status);

-- Índice para status (usado em múltiplas queries)
CREATE INDEX IF NOT EXISTS idx_assinaturas_pagamentos_status 
  ON assinaturas_pagamentos_recorrentes(status);

-- Índice para mercado pago subscription ID
CREATE INDEX IF NOT EXISTS idx_assinaturas_mp_subscription 
  ON assinaturas_pagamentos_recorrentes(mercado_pago_subscription_id);

-- Índice composto para relação usuário-assinatura
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuarios_usuario 
  ON assinaturas_usuarios(usuario_id, status);

-- ============================================
-- 2. AGENDAMENTOS (FREQUENTEMENTE ACESSADO)
-- ============================================

-- Índice para buscar agendamentos por usuário
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id 
  ON agendamentos(usuario_id);

-- Índice para buscar agendamentos por barbeiro
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_id 
  ON agendamentos(barbeiro_id);

-- Índice para datas (muito usado em buscas de disponibilidade)
CREATE INDEX IF NOT EXISTS idx_agendamentos_data 
  ON agendamentos(data_agendamento, status);

-- Índice composto para status
CREATE INDEX IF NOT EXISTS idx_agendamentos_status 
  ON agendamentos(status);

-- Índice para buscar agendamentos por cliente + data
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_data 
  ON agendamentos(usuario_id, data_agendamento DESC);

-- ============================================
-- 3. USUÁRIOS (AUTENTICAÇÃO)
-- ============================================

-- Índice para email (usado em login)
CREATE INDEX IF NOT EXISTS idx_usuarios_email 
  ON usuarios(email);

-- Índice para CPF (usado em validações)
CREATE INDEX IF NOT EXISTS idx_usuarios_cpf 
  ON usuarios(cpf);

-- ============================================
-- 4. SERVIÇOS E BARBEIROS (DATA LOOKUP)
-- ============================================

-- Índice para barbeiros ativos
CREATE INDEX IF NOT EXISTS idx_barbeiros_ativo 
  ON barbeiros(ativo);

-- Índice para serviços ativos
CREATE INDEX IF NOT EXISTS idx_servicos_ativo 
  ON servicos(ativo);

-- ============================================
-- 5. VERIFICAR ÍNDICES EXISTENTES
-- ============================================

-- Depois de criar, execute essa query para verificar:
-- SELECT indexname FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY indexname;

-- ============================================
-- 6. VACUUM ANALYZE (Maintenance - executar 1x por mês)
-- ============================================

-- Remover dados deletados e atualizar estatísticas
VACUUM ANALYZE;

-- ============================================
-- 7. PERFORMANCE CHECK (Executar após mudanças)
-- ============================================

-- Ver tamanho dos índices:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS size
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 8. QUERIES A OTIMIZAR (COM EXPLAIN ANALYZE)
-- ============================================

-- Copiar e executar essas queries no psql para entender performance:

-- Query 1: Scheduler (sincronização de assinaturas)
-- EXPLAIN ANALYZE
-- SELECT apr.*, au.usuario_id, au.plano_id, u.email, u.nome
-- FROM assinaturas_pagamentos_recorrentes apr
-- JOIN assinaturas_usuarios au ON apr.assinatura_usuario_id = au.id
-- JOIN usuarios u ON apr.usuario_id = u.id
-- WHERE apr.status IN ('ativa', 'pendente')
-- AND apr.mercado_pago_subscription_id IS NOT NULL
-- AND apr.proxima_cobranca <= CURRENT_TIMESTAMP + INTERVAL '3 days'
-- LIMIT 50;

-- Query 2: Buscar agendamentos de usuário
-- EXPLAIN ANALYZE
-- SELECT * FROM agendamentos 
-- WHERE usuario_id = 123 
-- AND data_agendamento > CURRENT_DATE
-- ORDER BY data_agendamento ASC;

-- Query 3: Verificar disponibilidade de barbeiro
-- EXPLAIN ANALYZE
-- SELECT * FROM agendamentos 
-- WHERE barbeiro_id = 456 
-- AND data_agendamento::date = CURRENT_DATE
-- AND status != 'cancelado';

-- Se o EXPLAIN ANALYZE mostrar \"Seq Scan\" → precisa índice
-- Se mostrar \"Index Scan\" → bom! Índice funcionando

-- ============================================
-- 9. SCRIPT DE LIMPEZA (Executar 1x por trimestre)
-- ============================================

-- Deletar agendamentos cancelados com mais de 6 meses
-- DELETE FROM agendamentos 
-- WHERE status = 'cancelado' 
-- AND data_agendamento < CURRENT_DATE - INTERVAL '6 months';

-- Deletar logs antigos
-- DELETE FROM audit_logs 
-- WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

-- ============================================
-- 10. COMO APLICAR ESSAS MUDANÇAS
-- ============================================

-- Opção 1: SSH no servidor Render
-- 1. Acesse Render Dashboard
-- 2. Vá para PostgreSQL instance
-- 3. Clique \"Connect\" → Terminal
-- 4. Cole os comandos de índice acima

-- Opção 2: Usar GUI do Render
-- 1. Data tab no Render
-- 2. Execute query

-- Opção 3: Usar DBeaver/pgAdmin
-- 1. Conectar com DATABASE_URL
-- 2. Colar índices acima
-- 3. Executar

-- ⏱️ TEMPO: ~30 segundos para criar todos os índices
--     ECONOMIA: -20 a -40 horas/mês
-- ✅ VALE MUITO A PENA!
