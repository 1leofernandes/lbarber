# 📋 CHECKLIST DE DEPLOY - Render Free Tier

Use este checklist para deploy seguro e bem-sucedido.

---

## PRÉ-DEPLOY (LOCAL)

### 1. Preparação do Código

- [ ] Rodou `npm install` com sucesso
- [ ] Deletou arquivos antigos: `auth.js`, `db.js` (antigos)
- [ ] Verificou que `server.js` novo existe
- [ ] Verificou pasta `src/` com toda estrutura

### 2. Variáveis de Ambiente

- [ ] Copiou `.env.example` para `.env`
- [ ] Preencheu todas variáveis obrigatórias:
  - [ ] `DATABASE_URL` (PostgreSQL Neon)
  - [ ] `REDIS_URL` (Upstash ou local)
  - [ ] `JWT_SECRET` (mínimo 32 caracteres)
  - [ ] `EMAIL_USER` (Gmail)
  - [ ] `EMAIL_PASS` (App password Gmail)
  - [ ] `ADMIN_EMAILS` (seus emails)
  - [ ] `FRONTEND_URL` (seu domínio frontend)

### 3. Banco de Dados

- [ ] Conectou ao PostgreSQL via `psql` ou pgAdmin
- [ ] Rodou `database-schema.sql` (se DB novo) OU `database-indexes.sql` (se DB existente)
- [ ] Verificou que tabelas foram criadas:
  ```bash
  psql -c "\dt"  # Deve listar: usuarios, agendamentos, servicos, etc
  ```

### 4. Teste Local

```bash
# Terminal 1: Rodar servidor
npm run dev

# Terminal 2: Testar health check
curl http://localhost:3000/health
# Esperado: {"status":"ok",...}

# Terminal 2: Testar registrar
curl -X POST http://localhost:3000/auth/registrar \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste","email":"teste@test.com","senha":"senha123"}'
# Esperado: {"success":true,...}
```

- [ ] `/health` retorna `{"status":"ok"}`
- [ ] Registro funciona
- [ ] Login funciona
- [ ] Listar barbeiros funciona
- [ ] Criar agendamento funciona

### 5. Verificações Finais

- [ ] Não há arquivos `auth.js`, `db.js` antigos (deletou)
- [ ] `.env` NÃO está versionado (git status não mostra `.env`)
- [ ] `package.json` tem todas novas dependências
- [ ] Sem erros nos logs: `npm run dev`

---

## DEPLOY (Render)

### 1. Push para Git

```bash
cd "d:\Área de Trabalho\Barbearia"

# Verificar que está tudo commitado
git status
# Deve estar limpo (nothing to commit)

# Se tiver mudanças:
git add .
git commit -m "refactor: novo backend otimizado para Render free tier"

# Push
git push origin main
```

- [ ] Commit realizado com mensagem descritiva
- [ ] Push realizado sem erros

### 2. Render Dashboard

- [ ] Acessou [https://dashboard.render.com](https://dashboard.render.com)
- [ ] Selecionou seu serviço (barbearia)
- [ ] Verificou que começou novo build automaticamente

### 3. Monitorar Build

No Render Dashboard → Seu Serviço → Logs:

```
✓ Building...
✓ Installing dependencies...
✓ Starting server...
✓ Server is running
```

- [ ] Build concluído com sucesso (não tem `ERROR`)
- [ ] Esperou até ver "Server is running"
- [ ] Tempo total: ~2-3 minutos

### 4. Testar em Produção

```bash
# Substituir pelo seu domínio Render
SITE=https://seu-app.render.com

# Health check
curl $SITE/health

# Registrar
curl -X POST $SITE/auth/registrar \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste Prod","email":"test@prod.com","senha":"senha123"}'

# Login
curl -X POST $SITE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@prod.com","senha":"senha123"}'
```

- [ ] Health check retorna `{"status":"ok"}`
- [ ] Endpoints respondem sem erro 500
- [ ] Respostas vêm comprimidas (use DevTools)

### 5. Verificar Logs Produção

Render Dashboard → Seu Serviço → Logs:

```
[INFO] 🚀 Servidor rodando em http://localhost:3000
[INFO] 📡 Ambiente: production
[INFO] ✅ Conexão com PostgreSQL estabelecida
[INFO] ✅ Redis pronto para uso
```

- [ ] Inicializou sem erros
- [ ] Conectou ao PostgreSQL
- [ ] Conectou ao Redis (ou alertou que não disponível - OK)

### 6. Testar com Frontend

- [ ] Atualize URLs no frontend para produção:
  ```javascript
  // De: http://localhost:3000
  // Para: https://seu-app.render.com
  ```
- [ ] Teste login no frontend
- [ ] Teste criação de agendamento
- [ ] Verifique se dados aparecem no banco

---

## PÓS-DEPLOY (Verificações)

### 1. Monitorar 24h

- [ ] Observar logs por 24 horas
  - Não tem crashes (/health status)
  - Erros acontecem raramente
  - Padrões normais de requisições

### 2. Verificar Instance Hours

Render Dashboard → Seu Serviço → Usage:

```
Instance Hours Used: XX h
Estimated Monthly Cost: $X
```

- [ ] Está diminuindo gradualmente (não crescendo exponencialmente)
- [ ] Estimativa deve ser menor que antes (~40% redução)

### 3. Performance

No navegador (F12 → Network):

- [ ] Requisições respondendo em <200ms
- [ ] Respostas comprimidas (Content-Encoding: gzip)
- [ ] Sem erros 5xx

### 4. Dados Confidenciais

- [ ] Arquivo `.env` NÃO está no Git
- [ ] Variáveis secretas estão no Render (Environment)
- [ ] JWT_SECRET é seguro (não é "secreta")

---

## TROUBLESHOOTING

### ❌ Erro: "Cannot find module"

**Causa:** Faltam dependências

**Solução:**
```bash
npm install
git add package-lock.json
git push origin main
# Render fará novo build
```

### ❌ Erro: "Connection refused" (PostgreSQL)

**Causa:** DATABASE_URL inválida

**Solução:**
```bash
# Verificar variável em .env:
DATABASE_URL=postgresql://user:pass@neon-hostname:5432/dbname

# Testar localmente:
psql $DATABASE_URL -c "SELECT 1"
```

### ❌ Erro: "Redis not available"

**Causa:** Redis não está rodando

**Solução:** É OK! Sistema funciona sem cache. Se quiser Redis:
```env
# Upstash (gratuito): https://upstash.com
REDIS_URL=redis://default:password@hostname:port
```

### ❌ Erro: 401 "Token inválido"

**Causa:** JWT_SECRET diferente entre dev/prod

**Solução:**
1. Use MESMO JWT_SECRET em `.env` local e Render
2. Retire todos tokens antigos (re-faça login)

### ❌ Erro: CORS blocked

**Causa:** FRONTEND_URL não está configurado

**Solução:**
```env
# Render (Environment > Add)
FRONTEND_URL=https://seu-frontend.com
```

### ❌ Status: 503 Service Unavailable

**Causa:** Servidor crashed ou iniciando

**Solução:**
1. Ver logs Render: `Deploy` aba
2. Aguardar 1-2 minutos (pode estar iniciando)
3. Se persistir, verificar DB/Redis conexão

---

## ROLLBACK (Se Necessário)

Se algo der MUITO errado:

```bash
# Ver commits anteriores
git log --oneline

# Reverter para versão anterior
git revert HEAD
git push origin main

# Render fará novo build com código antigo
```

---

## OTIMIZAÇÕES PÓS-DEPLOY

### Após 1 semana

- [ ] Revisar logs para padrões
- [ ] Adicionar mais índices se queries lentas
- [ ] Aumentar Redis TTL se muitos misses

### Após 1 mês

- [ ] Comparar instance hours (deve estar -40%)
- [ ] Verificar se há queries lentas
- [ ] Planejar próximas features

---

## PRÓXIMOS PASSOS

1. ✅ Deploy bem-sucedido
2. 📊 Monitorar metrics
3. 💳 Integrar pagamentos (Pagar.me)
4. 📱 Expandir para mobile
5. 🧪 Adicionar testes

---

## Contato/Suporte

Se der erro desconhecido:

1. Verificar logs Render
2. Consultar DOCUMENTACAO-BACKEND-OTIMIZADO.md
3. Testar localmente: `npm run dev`
4. Comparar .env local vs Render Environment

---

**Boa sorte com o deploy!** 🚀
