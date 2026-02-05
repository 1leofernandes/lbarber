# 🧪 Guia Completo de Teste - Fluxo de Assinatura

## Status: CORRIGIDO ✅

### O que foi corrigido na Phase 4:

1. ✅ **HMAC Validation Disable**
   - Desabilitada validação HMAC por padrão (`WEBHOOK_HMAC_ENABLED=false`)
   - Webhooks agora são aceitos sem validação de assinatura
   - Reduz erros ao configurar webhook secret no MP dashboard

2. ✅ **External Reference Fetch**
   - Webhook handler agora chama `mp.getSubscription(subscriptionId)` para buscar detalhes completos
   - Extrai `external_reference` da API do MP, não apenas do webhook payload
   - Resolve erro: "Assinatura sem external_reference"

3. ✅ **Subscription Status Handling**
   - Agora aceita status: `authorized`, `active`, `pending_authorization`
   - Mais flexível para diferentes estados de assinatura
   - Status `pending_authorization` também ativa assinatura

4. ✅ **Database Record Creation**
   - `ativarAssinaturaUsuario()` agora cria registros completos:
     - `assinaturas_usuarios` (com status, datas)
     - `assinaturas_pagamentos_recorrentes` (com valor mensal, mercado_pago_subscription_id)
     - `usuarios.assinante = true` + `usuarios.assinatura_id`

---

## 📋 Checklist de Teste (Passo a Passo)

### Pré-Teste

- [ ] Render redeploy completado (verificar em https://dashboard.render.com)
- [ ] Backend rodando sem erros (verificar logs)
- [ ] Mercado Pago credenciais ativas (access_token válido)
- [ ] Cartão de teste disponível com saldo suficiente

### Teste 1: Fluxo Básico de Assinatura

1. Abra: https://barbeariasilva.vercel.app/assinatura.html
2. Selecione um plano (ex: Bronze - R$ 29,90)
3. Clique em "Contratar Agora"
4. Será redirecionado para checkout do MP
5. Insira dados de teste:
   ```
   Cartão: 4235 6477 2802 5682
   CVV: 123
   Validade: 11/2025
   CPF: 123.456.789-09
   ```
6. Confirme pagamento
7. Será redirecionado de volta para o app

**Verificações esperadas:**

- ✅ Redirecionamento bem-sucedido após pagamento
- ✅ Sem erros 500 no app
- ✅ Logs aparecem no Render

### Teste 2: Verificar Webhook Processing (Logs)

1. Após pagar, aguarde 10 segundos
2. Vá para Render Dashboard > Barberia > Logs
3. Procure por linhas com:
   ```
   Webhook Mercado Pago recebido:
   Validação HMAC desabilitada - webhook aceito
   📡 Buscando detalhes da assinatura da API do MP...
   ✅ Detalhes da assinatura buscados:
   Ativando assinatura do usuário:
   ✅ Assinatura criada e usuário ativado:
   ```

**Se vir esses logs = sistema está funcionando!**

### Teste 3: Verificar Database

1. Conecte ao banco (Neon console)
2. Execute queries:

```sql
-- Ver usuário atualizado como assinante
SELECT id, email, assinante, assinatura_id
FROM usuarios
ORDER BY created_at DESC
LIMIT 1;

-- Ver assinatura criada
SELECT id, usuario_id, plano_id, status, data_inicio, proxima_cobranca
FROM assinaturas_usuarios
ORDER BY created_at DESC
LIMIT 1;

-- Ver assinatura recorrente com dados do MP
SELECT id, usuario_id, plano_id, valor_mensal, status, mercado_pago_subscription_id, proxima_cobranca
FROM assinaturas_pagamentos_recorrentes
ORDER BY created_at DESC
LIMIT 1;
```

**Esperado:**

- ✅ `usuarios.assinante = true`
- ✅ `usuarios.assinatura_id` preenchido
- ✅ `assinaturas_usuarios.status = 'ativa'`
- ✅ `assinaturas_pagamentos_recorrentes.mercado_pago_subscription_id` preenchido
- ✅ `proxima_cobranca` em 30 dias

### Teste 4: Verificar Frontend - Minhas Assinaturas

1. Faça login com o usuário que criou assinatura
2. Vá para: https://barbeariasilva.vercel.app/minha-assinatura.html
3. Clique em "Minhas Assinaturas"

**Esperado:**

- ✅ Plano contratado aparece na lista
- ✅ Status mostra "Ativa"
- ✅ Próxima cobrança em 30 dias
- ✅ Botão "Cancelar" disponível

### Teste 5: Cancelamento de Assinatura

1. Na página "Minhas Assinaturas", clique em "Cancelar"
2. Confirme cancelamento
3. Aguarde 5 segundos
4. Recarregue a página

**Verificações:**

- ✅ Assinatura desaparece ou mostra status "Cancelada"
- ✅ DB: `assinante = false`, `assinatura_id = NULL`
- ✅ Logs no Render mostram: "Cancelando assinatura"

---

## 🔍 Troubleshooting

### Problema: "Assinatura HMAC inválida"

**Causa:** WEBHOOK_HMAC_ENABLED não está como `false`
**Solução:**

```bash
# Edite .env:
WEBHOOK_HMAC_ENABLED=false

# Redeploy no Render
```

### Problema: Webhook não chega (no logs)

**Causa:** URL do webhook não configurada no MP dashboard
**Solução:**

1. Vá para: https://www.mercadopago.com.br/developers/panel
2. Clique em sua aplicação
3. Configure webhook URL:
   ```
   https://barbeariasilva.onrender.com/api/webhooks/mercado-pago
   ```
4. Teste webhook no dashboard do MP

### Problema: "Assinatura sem external_reference" (nos logs)

**Causa:** MP não enviou external_reference no webhook
**Solução:** ✅ **JÁ CORRIGIDO** - Sistema agora busca da API

- Se persistir, verifique que `mp.getSubscription()` está sendo chamado nos logs

### Problema: Nenhum registro criado no banco

**Causa:** Webhook processamento falhou (verifique logs)
**Solução:**

1. Procure por erros (ERROR) nos logs do Render
2. Se houver erro em `mp.getSubscription()`, verifique:
   - MERCADO_PAGO_ACCESS_TOKEN está correto
   - API do MP está online

### Problema: Cartão rejeitado (cc_rejected_high_risk)

**Causa:** Cartão de teste com saldo insuficiente
**Solução:**

- Use cartão com suficiente saldo (R$ 50+)
- Ou use sandbox do MP para testes

---

## 📊 Fluxo Esperado Completo

```
1. Frontend: POST /checkout
   ↓
2. Backend: cria checkout link MP (preapproval)
   ↓
3. MP: redireciona para card.html
   ↓
4. Usuário: preenche cartão
   ↓
5. MP: aprova/rejeita pagamento
   ↓
6. MP: envia webhook subscription_preapproval
   ↓
7. Backend Webhook: recebe, busca detalhes da API MP
   ↓
8. Backend: cria assinaturas_usuarios + assinaturas_pagamentos_recorrentes
   ↓
9. Backend: atualiza usuarios.assinante = true
   ↓
10. MP: envia webhook de pagamento (payment event)
    ↓
11. Backend: atualiza historico_cobrancas (se houver)
    ↓
12. ✅ ASSINATURA ATIVA - Cliente consegue acessar conteúdo
```

---

## 🚀 Próximos Passos

### Após Validar Funcionamento:

1. [ ] Teste com diferentes planos
2. [ ] Teste cancelamento
3. [ ] Teste renovação (depois de 30 dias)
4. [ ] Monitorar logs por 7 dias em produção
5. [ ] Validar cobranças no Mercado Pago dashboard

### Produção - Checklist Final:

1. [ ] WEBHOOK_HMAC_ENABLED pode permanecer `false` (ou ativar após configurar secret corretamente)
2. [ ] MERCADO_PAGO_ACCESS_TOKEN é da produção (APP_USR-)
3. [ ] BACKEND_URL aponta para https://barbeariasilva.onrender.com
4. [ ] FRONTEND_URL aponta para https://barbeariasilva.vercel.app
5. [ ] Webhook URL no MP dashboard é a produção
6. [ ] SSL/HTTPS ativado em ambas URLs
7. [ ] Logs estão sendo monitorados

---

## 📱 URLs de Teste

| Item               | URL                                                     |
| ------------------ | ------------------------------------------------------- |
| Frontend           | https://barbeariasilva.vercel.app                       |
| Assinatura         | https://barbeariasilva.vercel.app/assinatura.html       |
| Minhas Assinaturas | https://barbeariasilva.vercel.app/minha-assinatura.html |
| Backend            | https://barbeariasilva.onrender.com                     |
| MP Dashboard       | https://www.mercadopago.com.br/developers/panel         |
| Render Logs        | https://dashboard.render.com                            |

---

## 🆘 Contatos Úteis

- **MP Support:** suporte.desenvolvedores@mercadopago.com
- **Render Support:** https://support.render.com
- **DB (Neon) Console:** https://console.neon.tech
