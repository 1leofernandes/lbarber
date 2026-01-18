#!/bin/bash

# ============================================================
# Script de Setup Rápido - Barbearia Backend Otimizado
# Para Linux/Mac
# ============================================================

echo ""
echo "========================================================"
echo "  Backend Barbearia - Setup Rápido"
echo "========================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não está instalado"
    echo "Baixe em: https://nodejs.org"
    exit 1
fi

echo "[OK] Node.js detectado"
node --version

# Check npm
if ! command -v npm &> /dev/null; then
    echo "[ERRO] npm não está disponível"
    exit 1
fi

echo "[OK] npm detectado"
npm --version

echo ""
echo "========================================================"
echo "[1/4] Limpando node_modules antigos..."
echo "========================================================"
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "[OK] Deletado"
else
    echo "[SKIP] Nenhum node_modules anterior"
fi

echo ""
echo "========================================================"
echo "[2/4] Instalando dependências..."
echo "========================================================"
npm install
if [ $? -ne 0 ]; then
    echo "[ERRO] Falha ao instalar dependências"
    exit 1
fi
echo "[OK] Dependências instaladas"

echo ""
echo "========================================================"
echo "[3/4] Criando .env..."
echo "========================================================"
if [ -f ".env" ]; then
    echo "[SKIP] Arquivo .env já existe"
else
    cp .env.example .env
    echo "[OK] Arquivo .env criado"
    echo ""
    echo "IMPORTANTE: Edite .env com suas credenciais:"
    echo "  - DATABASE_URL"
    echo "  - REDIS_URL"
    echo "  - JWT_SECRET"
    echo "  - EMAIL_USER e EMAIL_PASS"
    echo "  - ADMIN_EMAILS"
fi

echo ""
echo "========================================================"
echo "[4/4] Verificação final..."
echo "========================================================"
echo ""
echo "[OK] Estrutura criada: src/"
for dir in src/*/; do
    dirname=$(basename "$dir")
    echo "      ✓ $dirname"
done

echo ""
echo "[OK] Arquivos criados:"
[ -f "server.js" ] && echo "      ✓ server.js"
[ -f "package.json" ] && echo "      ✓ package.json"
[ -f ".env.example" ] && echo "      ✓ .env.example"
[ -f "database-schema.sql" ] && echo "      ✓ database-schema.sql"
[ -f "database-indexes.sql" ] && echo "      ✓ database-indexes.sql"

echo ""
echo "========================================================"
echo "PRÓXIMOS PASSOS"
echo "========================================================"
echo ""
echo "1. Editar .env com suas credenciais:"
echo "   - Abra arquivo .env"
echo "   - Preencha DATABASE_URL, REDIS_URL, etc"
echo ""
echo "2. Configurar banco de dados:"
echo "   - Se novo: psql < database-schema.sql"
echo "   - Se existe: psql < database-indexes.sql"
echo ""
echo "3. Rodar localmente:"
echo "   - npm run dev"
echo ""
echo "4. Testar:"
echo "   - curl http://localhost:3000/health"
echo ""
echo "5. Deploy:"
echo "   - Seguir CHECKLIST-DEPLOY.md"
echo ""
echo "========================================================"
echo "LEIA ANTES DE COMEÇAR"
echo "========================================================"
echo ""
echo "1. RESUMO-EXECUTIVO.md          ← O que foi feito"
echo "2. GUIA-MIGRACAO.md             ← Passo-a-passo"
echo "3. DOCUMENTACAO-...md           ← Referência técnica"
echo "4. CHECKLIST-DEPLOY.md          ← Antes de deploy"
echo ""
echo "========================================================"
echo "Setup concluído com sucesso! ✓"
echo "========================================================"
echo ""
