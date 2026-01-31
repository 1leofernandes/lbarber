# Configuração do Webhook (Mercado Pago)

1. URL do webhook (use o BACKEND):
   - **Webhook URL**: `https://barbeariasilva.onrender.com/webhooks/mercado-pago`
   - **Por quê?** Webhooks devem apontar para o servidor que processa eventos e atualiza o banco de dados (frontend não deve receber webhooks).

2. Segredo de validação (HMAC):
   - Defina uma chave secreta (ex.: `sua_chave_webhook_aleatoria`) e coloque em `.env` como:
     ```
     WEBHOOK_SECRET=sua_chave_webhook_aleatoria
     ```
   - No painel do Mercado Pago: no menu de Webhooks (ou Notifications), registre a URL e, se disponível, adicione o mesmo segredo de validação (alguns painéis permitem um campo "secret" para assinatura). Caso o painel não possua campo de secret explícito, registre a URL normalmente e use a validação baseada no cabeçalho `x-signature` ou `x-mercadopago-signature` conforme o Mercado Pago enviar.

3. HMAC / Validação:
   - Nosso backend calcula `HMAC-SHA256(rawBody, WEBHOOK_SECRET)` e compara com o header recebido (`x-signature`, `x-hub-signature` ou `x-mercadopago-signature`).
   - Para testes, se `WEBHOOK_SECRET` não estiver definido, o webhook será aceito (com aviso de log). Em produção, sempre defina `WEBHOOK_SECRET`.

4. Eventos recomendados:
   - `payment` (pagamentos) — para atualizar cobranças
   - `preapproval` / `subscription` (assinaturas) — para criar/atualizar/cancelar assinaturas locais
   - `plan` (se usar planos MP) — opcional para sincronização

5. Testes rápidos (Dashboard / CLI):
   - Use o painel do Mercado Pago (sandbox) para simular eventos e confirmar que o endpoint responde 200 e que o banco foi atualizado.
   - Utilize o `stripe listen` equivalente do Mercado Pago se existir (ou a opção de enviar test webhook no painel).

6. Verificações no servidor:
   - Verifique logs: `php://stdout` via nossa `logger` ou `console` no Render
   - Verifique as tabelas: `assinaturas_usuarios`, `assinaturas_pagamentos_recorrentes`, `assinaturas_historico_cobrancas`, e a coluna `usuarios.assinante`
