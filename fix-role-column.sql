-- Script para corrigir a coluna 'role' de VARCHAR(25) para VARCHAR(50)
-- Execute este script no seu banco de dados no Render

ALTER TABLE usuarios 
ALTER COLUMN role TYPE VARCHAR(50);

ALTER TABLE usuarios 
ALTER COLUMN roles TYPE VARCHAR(50);
