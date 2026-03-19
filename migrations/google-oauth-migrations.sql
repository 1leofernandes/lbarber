-- ========================================
-- MIGRATIONS PARA GOOGLE OAUTH
-- ========================================
-- Execute este script se o campo google_id ainda não existe na tabela users

-- Adicionar coluna google_id
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Criar índice para google_id para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Comentário da coluna
COMMENT ON COLUMN users.google_id IS 'ID único do Google para login OAuth';

-- Verificar a estrutura
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';

-- Exemplo de dados que serão inseridos:
-- INSERT INTO users (nome, email, google_id, role, telefone, criado_em, atualizado_em)
-- VALUES (
--   'João Silva',
--   'joao@gmail.com',
--   '123456789012345678901',
--   'cliente',
--   '',
--   NOW(),
--   NOW()
-- );
