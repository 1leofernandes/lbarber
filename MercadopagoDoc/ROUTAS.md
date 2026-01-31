# Rotas relacionadas a Assinaturas (Mercado Pago)

Todas as rotas de assinaturas exigem `Authorization: Bearer <token>` (JWT), exceto o webhook.

## Cliente

- GET /subscricoes-recorrentes/minha-assinatura
  - Descrição: Retorna a assinatura ativa do usuário (status, próximo pagamento, plano, serviços)
  - Resposta (200):
    ```json
    {
      "success": true,
      "assinatura": {
        /* objeto com campos da view */
      }
    }
    ```

- DELETE /subscricoes-recorrentes/:assinaturaRecurrenteId
  - Descrição: Cancela a assinatura (será cancelada no Mercado Pago e localmente)
  - Body: { "motivo": "..." } (opcional)
  - Resposta (200):
    ```json
    { "success": true, "message": "Assinatura cancelada com sucesso" }
    ```

- GET /subscricoes-recorrentes/historico/cobrancas
  - Descrição: Histórico de cobranças do usuário

## Admin (monitoramento)

- GET /admin/assinaturas-recorrentes
  - Listagem/filtragem de assinaturas

- GET /admin/assinaturas-recorrentes/:assinaturaId
  - Detalhes de assinatura

- GET /admin/assinaturas-recorrentes/cobrancas/lista
  - Listar cobranças (filtráveis)

- GET /admin/assinaturas-recorrentes/resumo/geral
  - Resumo de assinaturas e receita

## Webhook (público, sem autenticação)

- POST /webhooks/mercado-pago
  - Descrição: Recebe eventos do Mercado Pago. O servidor valida HMAC (se `WEBHOOK_SECRET` configurado) e processa os eventos:
    - `payment` → atualiza `assinaturas_historico_cobrancas` e `assinaturas_pagamentos_recorrentes`
    - `subscription` / `preapproval` → cria/atualiza `assinaturas_usuarios` e `assinaturas_pagamentos_recorrentes`
    - `plan` → (opcional) sincronização de planos

Exemplos de checagens: verifique `usuarios.assinante`, `assinaturas_usuarios.status`, `assinaturas_pagamentos_recorrentes.status`.
