# 🚀 Guia de Otimização: Economizar Instance Hours no Render

**Status Atual:** 718/750 horas (95.7%) ⚠️  
**Objetivo:** Reduzir para ~500 horas/mês (-33%)  
**Economia Potencial:** 200-250 horas/mês (~240-300 R$/mês no plano pago)

---

## 📋 Análise de Consumo

Seu sistema está consumindo muitos recursos porque:

1. **UptimeRobot em loop** → pinga a cada 5 min = 288 requisições/dia
2. **Instância nunca hiberna** → sempre processando
3. **Sincronização pesada** → ChargeScheduler faz queries grandes a cada 24h
4. **Sem cache agressivo** → endpoints recarregam dados do DB
5. **Rate limiting permissivo** → deixa requisições em fila
6. **Logs verbosos** → I/O adicional

---

## 🎯 PLANO DE AÇÃO (IMPACTO DECRESCENTE)

### 1️⃣ **CRÍTICO: Estratégia UptimeRobot + Hibernação**

**Economia: -200 a -300 horas/mês** ⭐

#### Como funciona:
- **Render FREE** suporta hibernação automática após 15 min de inatividade
- **Você precisa:** Fazer UptimeRobot fazer ping raramente
- **Trade-off:** Primeira requisição após hibernação demora 30-50s

#### Implementação:

##### A) Configure Render:
- ✅ **DEIXAR HIBERNAÇÃO ATIVA** (padrão)
- Isso significa: após 15 min SEM tráfego → entra em sleep
- Primeira requisição acorda a instância (~30s de cold start)

##### B) Configure UptimeRobot:
**ANTES:** A cada 5 minutos (288/dia)  
**DEPOIS:** A cada 25-30 minutos (48-58/dia)

```
Render Free Tier:
- 750 horas/mês disponíveis
- Se instância foca 15 min idle → dorme
- UptimeRobot a cada 30 min = ~48 pings/dia = ~36 horas/mês
- Tráfego real de clientes = ~100-200 horas/mês (estimado)
- Total: ~136-236 horas/mês (-514-614 horas economizadas!)
```

**Como mudar no UptimeRobot:**
1. Vá para Settings do monitor
2. Mude "Check interval" de 5 minutos → **30 minutos**
3. Salve

---

### 2️⃣ **IMPORTANTE: Otimizar ChargeScheduler**

**Economia: -50 a -100 horas/mês** ⭐⭐

#### Problemas atuais:
- Roda a cada 24h
- Consulta TODAS as assinaturas (mesmo inativas/canceladas)
- Faz call externo para cada subscription no Mercado Pago
- Sem cache de resultados

#### Soluções:

```javascript
// MUDANÇAS A IMPLEMENTAR:

1. Aumentar intervalo: 24h → 48h
   Justificativa: Mercado Pago só processa cobranças 1x por dia
   
2. Usar batch/parallelism com limite
   Justificativa: Reduz tempo total + permite sleep
   
3. Cachear últimas sincronizações
   Justificativa: Não sincronizar mesma subscription < 12h
   
4. Sincronizar apenas "próximas cobranças"
   Justificativa: Ignorar assinaturas que não cobram hoje/amanhã
```

---

### 3️⃣ **IMPORTANTE: Cache Agressivo de Endpoints Frequentes**

**Economia: -30 a -50 horas/mês** ⭐⭐

#### Identificar endpoints frequentes:
- `GET /usuarios/perfil` - cache 1 hora
- `GET /barbeiros` - cache 2 horas
- `GET /servicos` - cache 2 horas
- `GET /agendamentos/disponiveis` - cache 15 min
- `GET /assinatura/:id` - cache 30 min

#### Implementar:
```javascript
// Exemplo (adicionar em endpoints):
const cache = require('../utils/cache');

app.get('/barbeiros', async (req, res) => {
  const cacheKey = 'barbeiros:list';
  
  // Tenta cache
  let barbeiros = await cache.get(cacheKey);
  if (barbeiros) return res.json(barbeiros);
  
  // Se não tem, busca DB
  barbeiros = await getBarbeirosFromDB();
  
  // Guarda cache por 2 horas
  await cache.set(cacheKey, barbeiros, 7200);
  
  return res.json(barbeiros);
});

// Invalidar quando criar/editar barbeiro:
await cache.invalidatePattern('barbeiros:*');
```

---

### 4️⃣ **IMPORTANTE: Otimizar Database Queries**

**Economia: -20 a -40 horas/mês** ⭐⭐

#### Checklist:
- [ ] Adicionar índices em colunas frequentes (usuario_id, status, data)
- [ ] Remover JOINs desnecessários
- [ ] Usar LIMIT/OFFSET para paginação
- [ ] Evitar N+1 queries

#### Queries para adicionar índices:
```sql
-- Já devem existir, mas verificar:
CREATE INDEX idx_assinaturas_usuario_id ON assinaturas_usuarios(usuario_id);
CREATE INDEX idx_assinaturas_status ON assinaturas_pagamentos_recorrentes(status);
CREATE INDEX idx_agendamentos_usuario ON agendamentos(usuario_id);
CREATE INDEX idx_agendamentos_barbeiro ON agendamentos(barbeiro_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_agendamento);
```

---

### 5️⃣ **RECOMENDADO: Otimizar Connection Pool**

**Economia: -10 a -20 horas/mês**

Seu current config já está bom (max: 15), mas pode melhorar:

```javascript
// Em src/config/database.js - MUDAR PARA:
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  
  // OTIMIZAÇÕES:
  max: 10,  // ← REDUZIR DE 15 PARA 10
  idleTimeoutMillis: 15000,  // ← REDUZIR DE 30s PARA 15s
  connectionTimeoutMillis: 5000,
  
  // Novo: Descartar conexões com erro
  maxUses: 100,
});
```

---

### 6️⃣ **RECOMENDADO: Reduzir Logging Verboso**

**Economia: -5 a -15 horas/mês**

```javascript
// Em src/utils/logger.js - MUDANÇAS:

// ANTES: log TUDO em info/debug
logger.info(`Cache HIT: ${key}`);
logger.debug(`Cache SET: ${key}`);

// DEPOIS: log APENAS erros
// Remover debug/info de cache
// Manter apenas: logger.error()
```

---

### 7️⃣ **ADICIONAL: Webhooks Assíncronos**

**Economia: -10 a -20 horas/mês**

Se seus webhooks de Mercado Pago fazem processamento pesado:

```javascript
// Em src/routes/webhooks.js

app.post('/webhook/mercadopago', async (req, res) => {
  // RESPONDER IMEDIATAMENTE (libera conexão)
  res.status(200).json({ ok: true });
  
  // PROCESSAR EM BACKGROUND (queue)
  queue.add('process_webhook', req.body);
});
```

---

## 📊 Impacto Total Esperado

| Mudança | Hora/Mês | Implementação |
|---------|----------|---------------|
| UptimeRobot + Hibernação | -200 a -300 | ⭐⭐⭐ Crítica |
| ChargeScheduler otimizado | -50 a -100 | ⭐⭐⭐ Crítica |
| Cache agressivo | -30 a -50 | ⭐⭐ Importante |
| Database queries | -20 a -40 | ⭐⭐ Importante |
| Connection pool | -10 a -20 | ⭐ Recomendada |
| Reduzir logs | -5 a -15 | ⭐ Recomendada |
| Webhooks async | -10 a -20 | ⭐ Adicional |
| **TOTAL** | **-325 a -545** | **Viável!** |

---

## 🔧 Próximos Passos

### Imediatamente (hoje):
1. ✅ Mudar UptimeRobot para 30 minutos
2. ✅ Verificar hibernação está ativa no Render

### Curto prazo (esta semana):
3. ✅ Otimizar ChargeScheduler (código abaixo)
4. ✅ Adicionar cache em 5 endpoints principais
5. ✅ Adicionar índices no database

### Médio prazo (próximas semanas):
6. Monitorar impacto com Render Analytics
7. Fazer load testing para validar mudanças
8. Implementar alertas se consumo subir

---

## 📌 Considerações Importantes

### Performance vs. Economia
- **Cold start:** Primeira req. após hibernação demora ~30-50s
  - Solução: Clientes experientes com isso, ou manter UptimeRobot em 15 min
- **Cache staleness:** Dados podem ficar desatualizados por 2h
  - Solução: Invalidar cache quando dados mudam
- **Batch sync:** Delay de até 48h em sincronizações
  - Solução: Render permite webhooks em tempo real (mais econômico)

### Quando NÃO fazer essas otimizações:
- Se sua barbearia tem +100 agendamentos/dia → precisa estar sempre ON
- Se precisa sync em tempo real → usar webhooks do Mercado Pago
- Se SLA crítico → mantém plano pago

---

## 🎓 Extras Avançados

Se quiser ir além:

1. **Usar Render PostgreSQL** em vez de DB externo (mais rápido)
2. **Serverless functions** para tasks assíncronas (ex: emails)
3. **Static site generation** para páginas públicas (ex: politica-privacidade)
4. **Comprimir assets** (CSS/JS) com Terser/Esbuild
5. **Usar CDN** para static files (ex: Cloudflare)
6. **Database replication** para read-heavy queries

---

## 📞 Suporte

Se tiver dúvidas:
- Render Docs: https://render.com/docs
- UptimeRobot: https://uptimerobot.com/help
- PostgreSQL Performance: https://www.postgresql.org/docs/current/performance-tips.html
