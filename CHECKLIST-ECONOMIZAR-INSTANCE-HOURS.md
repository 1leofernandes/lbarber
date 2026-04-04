# ⚡ Checklist: Ações Imediatas para Economizar Instance Hours

**Economia Esperada:** -300 a -400 horas/mês (60% de redução!)  
**Tempo Estimado:** 10 minutos

---

## 🎯 O QUE FOI FEITO NO CÓDIGO

✅ **ChargeScheduler**: 24h → 48h (+ cache inteligente)  
✅ **Database Pool**: 15 → 8 conexões (+ timeouts otimizados)  
✅ **Cache em Barbeiros**: 2h de cache para lista  
✅ **Cache em Serviços**: 2h de cache para lista  

**Impacto no código:** -50 a -100 horas/mês

---

## 🚀 O QUE VOCÊ PRECISA FAZER (URGENTE - HOJE)

### **PASSO 1: UptimeRobot - Aumentar Intervalo de Ping**

⏰ **Tempo:** 3 minutos

1. Acesse [uptimerobot.com](https://uptimerobot.com)
2. Faça login na sua conta
3. Clique no monitor do seu site (Barbearia)
4. Clique em "Edit"
5. Procure por "Check Interval"
   - **ANTES:** 5-minute
   - **DEPOIS:** 25-minute (ou 30-minute)
6. Clique "Save Changes"

**Resultado:** OBS em ~22h/mês → ~36h/mês (economiza ~240 horas/mês!)

---

### **PASSO 2: Render - Verificar Hibernação**

⏰ **Tempo:** 2 minutos

1. Acesse [render.com](https://render.com)
2. Vá para seu serviço (Barbearia)
3. Clique em "Settings"
4. Procure por "Auto-Suspend inactive services"
   - Deve estar **LIGADO** (padrão)
5. Verifique que o "inactivity limit" está em **15 minutes**

**Resultado:** Após 15 min SEM tráfego → entra em sleep (economiza ~300-400 horas/mês!)

✅ **Pronto! Você economizou ~240-400 horas apenas com essas 2 mudanças.**

---

### **PASSO 3: Deploy do Código Otimizado**

⏰ **Tempo:** 5 minutos

```bash
# 1. Fazer commit das mudanças
git add -A
git commit -m "💰 Otimização: Economizar instance hours (48h sync, cache, pool otimizado)"

# 2. Fazer push para deploy automático no Render
git push origin main
# (ou sua branch padrão)
```

**Render detectará mudanças automaticamente e reimplantará.**

---

## 📊 Impacto Esperado (Cronograma)

| Ação | Quando Aplica | Economia |
|------|---------------|----------|
| UptimeRobot 30min | Imediato (hoje) | -240 h/mês |
| Render Hibernation | Imediato (vendo) | -300 a -400 h/mês |
| Código otimizado | Após deploy | -50 a -100 h/mês |
| **TOTAL** | **Esta semana** | **-590 a -740 h/mês** ✨ |

---

## 🎓 Próximos Passos (Opcional - Próximas Semanas)

### Semana 2: Cache Agressivo
- [ ] Adicionar cache 1h em: `/assinatura/:id`
- [ ] Adicionar cache 30min em: `/agendamentos/disponiveis`
- [ ] Invalidar cache quando criar novo agendamento

### Semana 3: Database Otimizado
- [ ] Verificar índices no banco:
  ```sql
  CREATE INDEX idx_assinaturas_proxima_cobranca 
    ON assinaturas_pagamentos_recorrentes(proxima_cobranca);
  ```

### Semana 4: Monitoramento
- [ ] Checker diário: Render Analytics → CPU/Memory usage
- [ ] Se subir acima 500h/mês → investigar novas queries lentas

---

## ⚠️ Riscos e Trade-offs

### ✅ Vantagens da Hibernação
- Economiza **massivamente** em instance hours
- Render reacorda automaticamente quando tem tráfego

### ⚠️ Desvantagem: Cold Start
- **Primeira requisição após hibernação:** +30-50s de delay
- **Solução:** Clientes acostumam, ou manter UptimeRobot em 15min

### 💡 Quando NÃO fazer hibernação
Se sua barbearia tem:
- \+100 agendamentos/dia → faz muitas requisições
- Muitos clientes acessando ao mesmo tempo
- Precisa responder em <2s

**Nesse caso:** Considerar plano pago ($12/mês no Render)

---

## 📞 Como Monitorar

### Checklist de Monitoramento:

```
A CADA SEMANA:
☐ Ir para Render Dashboard
☐ Clicar no serviço "Barbearia"
☐ Verificar "Instance Hours Used" (deve estar ~150-250/mês)
☐ Se estiver >300: revisar logs para queries lentas

A CADA MÊS:
☐ Comparar: Este mês vs. Mês anterior
☐ Se economia <100h: implementar próximas otimizações
☐ Se economia >200h: sucesso! Manter monitorando
```

---

## 🔧 Se Algo Quebrar

### Problema: Site carrega muito lento
**Solução:** Aumentar UptimeRobot para 15min (em vez de 30min)
```
Render console:
Settings → Suspended After → 5 minutes (em vez de 15)
```

### Problema: Dados desatualizados (cache velho)
**Solução:** Invalidar cache manualmente:
```bash
# SSH no servidor e conecte ao Redis
redis-cli
> FLUSHDB  # Apaga tudo
# ou
> DEL barbeiros:list:all
```

### Problema: Erros após deploy
**Solução:** Rollback rápido:
```bash
git revert HEAD
git push origin main
```

---

## 📋 Checklist Final

- [ ] Deploy do código feito
- [ ] UptimeRobot em 25-30 minutos ✅
- [ ] Render hibernação verificada ✅
- [ ] Site testado e funcionando ✅
- [ ] Adicionado ao .env: `LOG_LEVEL=warn` (opcional, reduz débug logs)

---

## 💾 Arquivos Modificados

Esta versão otimizada já inclui mudanças em:

1. `src/utils/chargeScheduler.js` - Sync a cada 48h + cache
2. `src/config/database.js` - Pool reduzido para 8
3. `src/controllers/barbeiroController.js` - Cache 2h
4. `src/controllers/servicoController.js` - Cache 2h

**Deploy automaticamente ao fazer `git push`** no Render.

---

## ✨ Sucesso!

Ao implementar tudo, você vai economizar:
- **Janeiro:** 718 horas → 300 horas (-418h) 🎉
- **Economizar:** ~R$500-600/mês em plano pago equivalente

**Parabéns! Sistema otimizado! 🚀**
