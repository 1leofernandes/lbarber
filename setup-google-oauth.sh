#!/bin/bash

# ============================================================================
# 🚀 SCRIPT DE INSTALAÇÃO - GOOGLE OAUTH
# ============================================================================
# Este script automatiza os passos de instalação do Google OAuth
# Execute: bash setup-google-oauth.sh
# ============================================================================

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                    GOOGLE OAUTH - SETUP                            ║"
echo "║                   100% GRATUITO E SEGURO                           ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar Node.js
echo "1️⃣  Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale Node.js 16+"
    exit 1
fi
echo "✅ Node.js $(node --version) encontrado"
echo ""

# Verificar npm
echo "2️⃣  Verificando npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado"
    exit 1
fi
echo "✅ npm $(npm --version) encontrado"
echo ""

# Criar .env se não existir
echo "3️⃣  Verificando .env..."
if [ ! -f .env ]; then
    echo "⚠️  .env não encontrado. Criando a partir de .env.example..."
    cp .env.example .env
    echo "✅ .env criado. Edite com suas credenciais Google!"
    echo ""
    echo "📝 Adicione as seguintes variáveis:"
    echo "   GOOGLE_CLIENT_ID=seu_id_aqui"
    echo "   GOOGLE_CLIENT_SECRET=seu_secret_aqui"
    echo "   BACKEND_URL=http://localhost:3000"
    echo "   SESSION_SECRET=gere_uma_string_aleatoria"
    echo ""
else
    echo "✅ .env encontrado"
fi
echo ""

# Instalar dependências
echo "4️⃣  Instalando dependências..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi
echo "✅ Dependências instaladas"
echo ""

# Testar configuração
echo "5️⃣  Validando configuração..."
node test-google-oauth.js
if [ $? -ne 0 ]; then
    echo "⚠️  Configuração incompleta. Verifique .env"
    echo ""
    echo "📝 Abra .env e preencha:"
    echo "   GOOGLE_CLIENT_ID=seu_id"
    echo "   GOOGLE_CLIENT_SECRET=seu_secret"
    echo ""
else
    echo "✅ Configuração validada"
fi
echo ""

# Resumo
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SETUP CONCLUÍDO!                             ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Próximos passos:"
echo "   1. Edite .env com credenciais Google"
echo "   2. Execute: npm run dev"
echo "   3. Acesse: http://localhost:3000/login.html"
echo "   4. Clique: 'Entrar com Google'"
echo ""
echo "📚 Para mais informações:"
echo "   Abra: GOOGLE-OAUTH-SETUP.md"
echo ""
echo "🆘 Erro ao instalar?"
echo "   Consulte: GOOGLE-OAUTH-SETUP.md (seção Troubleshooting)"
echo ""
