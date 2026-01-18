@echo off
REM ============================================================
REM Script de Setup Rápido - Barbearia Backend Otimizado
REM ============================================================
REM Este script configura tudo automaticamente

echo.
echo ========================================================
echo   Backend Barbearia - Setup Rápido
echo ========================================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERRO] Node.js não está instalado
  echo Baixe em: https://nodejs.org
  pause
  exit /b 1
)

echo [OK] Node.js detectado
node --version

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERRO] npm não está disponível
  pause
  exit /b 1
)

echo [OK] npm detectado
npm --version

echo.
echo ========================================================
echo [1/4] Limpando node_modules antigos...
echo ========================================================
if exist node_modules (
  rmdir /s /q node_modules >nul 2>&1
  echo [OK] Deletado
) else (
  echo [SKIP] Nenhum node_modules anterior
)

echo.
echo ========================================================
echo [2/4] Instalando dependências...
echo ========================================================
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo [ERRO] Falha ao instalar dependências
  pause
  exit /b 1
)
echo [OK] Dependências instaladas

echo.
echo ========================================================
echo [3/4] Criando .env...
echo ========================================================
if exist .env (
  echo [SKIP] Arquivo .env já existe
) else (
  copy .env.example .env >nul
  echo [OK] Arquivo .env criado
  echo.
  echo IMPORTANTE: Edite .env com suas credenciais:
  echo   - DATABASE_URL
  echo   - REDIS_URL
  echo   - JWT_SECRET
  echo   - EMAIL_USER e EMAIL_PASS
  echo   - ADMIN_EMAILS
)

echo.
echo ========================================================
echo [4/4] Verificação final...
echo ========================================================
echo.
echo [OK] Estrutura criada: src/
for /d %%i in (src\*) do echo      ✓ %%~nxi
echo.
echo [OK] Arquivos criados:
if exist server.js echo      ✓ server.js
if exist package.json echo      ✓ package.json
if exist .env.example echo      ✓ .env.example
if exist database-schema.sql echo      ✓ database-schema.sql
if exist database-indexes.sql echo      ✓ database-indexes.sql

echo.
echo ========================================================
echo PRÓXIMOS PASSOS
echo ========================================================
echo.
echo 1. Editar .env com suas credenciais:
echo    - Abra arquivo .env
echo    - Preencha DATABASE_URL, REDIS_URL, etc
echo.
echo 2. Configurar banco de dados:
echo    - Se novo: psql ^< database-schema.sql
echo    - Se existe: psql ^< database-indexes.sql
echo.
echo 3. Rodar localmente:
echo    - npm run dev
echo.
echo 4. Testar:
echo    - curl http://localhost:3000/health
echo.
echo 5. Deploy:
echo    - Seguir CHECKLIST-DEPLOY.md
echo.
echo ========================================================
echo LEIA ANTES DE COMEÇAR
echo ========================================================
echo.
echo 1. RESUMO-EXECUTIVO.md          ← O que foi feito
echo 2. GUIA-MIGRACAO.md             ← Passo-a-passo
echo 3. DOCUMENTACAO-...md           ← Referência técnica
echo 4. CHECKLIST-DEPLOY.md          ← Antes de deploy
echo.
echo ========================================================
echo Setup concluído com sucesso! ✓
echo ========================================================
echo.
pause
