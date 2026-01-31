# Testes - Mercado Pago (Sandbox e Produção)

## 1) Pré-requisitos

- Chaves no `.env`:
  - `MERCADO_PAGO_ACCESS_TOKEN` (sandbox/prod conforme o caso)
  - `MERCADO_PAGO_PUBLIC_KEY` (para front-end se necessário)
  - `WEBHOOK_SECRET` (mesmo valor que for configurado no painel de webhooks)

## 2) Fluxo de teste (assinatura criada no Mercado Pago)

1. No painel do Mercado Pago (modo sandbox), crie ou use um plano/assinatura.
2. No front-end, redirecione o usuário para a página de assinatura do Mercado Pago (você pode usar o `mercado_pago_plan_id` salvo na tabela `assinatura`).
3. Complete o fluxo no MP (usar cartão de teste em sandbox).
4. No painel do MP, verifique que o evento de `subscription` (preapproval) foi disparado para `https://barbeariasilva.onrender.com/webhooks/mercado-pago`.
5. Verifique o banco de dados:
   - `assinaturas_usuarios` — entrada criada e `status = 'ativa'`
   - `assinaturas_pagamentos_recorrentes` — `mercado_pago_subscription_id` preenchido
   - `usuarios.assinante = true`

## 3) Teste de cobrança (payment)

1. Realize um pagamento de teste (se aplicável) no MP.
2. Verifique que o webhook `payment` atualiza `assinaturas_historico_cobrancas` com `status = 'aprovada'`.
3. Verifique que `assinaturas_pagamentos_recorrentes.proxima_cobranca` foi adiada 30 dias.

## 4) Teste de cancelamento

1. Cancele a assinatura pelo painel do Mercado Pago (ou via endpoint nosso `DELETE /subscricoes-recorrentes/:id`).
2. Verifique webhook `subscription` com `status = 'cancelled'` e que nosso sistema marca `status = 'cancelada'` localmente.

## 5) Comandos úteis (curl)

- Simular webhook (exemplo simplificado):

```bash
curl -X POST https://barbeariasilva.onrender.com/webhooks/mercado-pago \
  -H "Content-Type: application/json" \
  -H "x-signature: <assinatura gerada>" \
  -d '{"type":"subscription","data":{"id":"PREAPPROVAL_ID"}}'
```

(Gere a assinatura HMAC: `echo -n '{...raw body...}' | openssl dgst -sha256 -hmac "WEBHOOK_SECRET" | sed 's/^.* //')`

## 6) Observações

- Sempre validar os logs do servidor se um webhook não produzir o efeito esperado.
- Em sandbox, use credenciais de teste do painel Mercado Pago.
- Se algo não bater (dados de plano/valor), verifique os campos `mercado_pago_plan_id` na tabela `assinatura`.

## 7) Testes em PRODUÇÃO com cartões reais (passos importantes)

1. Certifique-se de que todas as métricas em sandbox funcionaram (assinatura criada, webhook processado, registro local atualizado).
2. Troque **somente** as chaves em `.env` para as chaves de produção do Mercado Pago:
   - `MERCADO_PAGO_ACCESS_TOKEN` = token de produção
   - `MERCADO_PAGO_PUBLIC_KEY` = public key de produção
   - `WEBHOOK_SECRET` = secret seguro (e atualizado no painel de webhooks do MP)
3. Atualize a URL do webhook no painel do Mercado Pago para apontar para `https://barbeariasilva.onrender.com/webhooks/mercado-pago` e confirme que o webhook está ativo.
4. Realize um teste com um cliente real (ou use sua conta): acesse o site, escolha um plano e conclua o checkout no Mercado Pago com cartão real.
5. Verifique:
   - O retorno do Mercado Pago (página de sucesso/erro e redirecionamento ao `back_url`);
   - A criação/atualização de registros nas tabelas `assinaturas_usuarios`, `assinaturas_pagamentos_recorrentes` e `assinaturas_historico_cobrancas`.
   - O campo `usuarios.assinante` deve ser `true` para o usuário que assinou.
6. Logs e auditoria: verifique a saída no servidor (Render/host) para confirmar que webhooks foram processados corretamente e que não ocorreram erros.

Observação final: teste com poucos clientes reais inicialmente para garantir que as cobranças e repasses estão corretos antes de abrir o produto ao público geral.
