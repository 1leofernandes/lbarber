# CHANGES - Migração para fluxo Mercado Pago (resumo técnico)

Resumo das alterações realizadas no repositório para suportar o novo fluxo:

1. Server
   - `server.js`: adicionado `rawBody` capture para validação HMAC dos webhooks.

2. Novos módulos
   - `src/config/mercadoPago.js`: wrapper simples para chamadas ao API do Mercado Pago (buscar pagamento, buscar assinatura, cancelar assinatura).

3. Webhook
   - `src/controllers/webhookController.js`: validação HMAC usando `WEBHOOK_SECRET` e tratamento de eventos:
     - `payment` → atualiza cobranças e agenda próxima cobrança
     - `subscription` → cria/atualiza assinaturas locais e marca usuário como assinante

4. Rotas
   - `src/routes/subscriptionRecurrent.js`: removidos endpoints de cartão e criação direta de assinatura (agora: apenas `minha-assinatura`, `cancelar` e `historico`) — **adicionados** endpoints `GET /planos` e `POST /checkout` para listagem de planos e criação de preapproval (checkout) no Mercado Pago.
   - `src/routes/admin/subscriptionRecurrentRoutes.js`: removidas rotas para configuração MP e dados bancários; mantidos endpoints de monitoramento.

5. Frontend
   - `public/assinatura.html`: adicionado botão **Torne-se um assinante** que lista planos e inicia checkout via `POST /api/subscricoes-recorrentes/checkout` (redirecionamento ao Mercado Pago)
   - `public/minha-assinatura.html`: botão rápido para `assinatura.html` para facilitar teste de fluxo do cliente.

6. Documentação
   - Criada pasta `/MercadopagoDoc` com instruções de webhook, rotas, testes e lista de mudanças.

Observação: mantivemos o schema do banco inalterado conforme solicitado; todas as operações utilizam as tabelas existentes `assinatura`, `assinaturas_usuarios`, `assinaturas_pagamentos_recorrentes`, `assinaturas_historico_cobrancas`, `usuarios`.

Se desejar, posso:

- Gerar endpoints auxiliares para criar links de checkout via API do Mercado Pago (opcional);
- Adicionar testes automatizados para webhooks;
- Adicionar comandos SQL para checar rapidamente o estado das assinaturas.
