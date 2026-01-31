# Documentação Mercado Pago - Barbearia Silva

Este diretório contém guias práticos para configurar e testar a integração com **Mercado Pago** (webhooks, fluxos de assinatura, rotas e testes).

Arquivos:

- `WEBHOOK-SETUP.md` — Como configurar o webhook no painel Mercado Pago e validação HMAC
- `ROUTAS.md` — Rotas relacionadas às assinaturas, exemplos e respostas
- `TESTS.md` — Passo-a-passo para testar (sandbox e produção), exemplos de payloads
- `CHANGES.md` — Resumo das alterações feitas no código

Ponto crítico: o webhook deve apontar para o BACKEND do sistema (não para o frontend). Exemplo: `https://barbeariasilva.onrender.com/webhooks/mercado-pago` (ou `https://barbeariasilva.onrender.com/api/webhooks/mercado-pago`)

O frontend já contém a integração para listar planos e iniciar o checkout via Mercado Pago:

- GET `/api/subscricoes-recorrentes/planos` → lista de planos disponíveis (requer autenticação)
- POST `/api/subscricoes-recorrentes/checkout` → cria o `preapproval` no Mercado Pago e retorna `redirectUrl` para redirecionamento do cliente

Leia `WEBHOOK-SETUP.md` e `FRONTEND.md` antes de testar para garantir que webhook e chaves estão configurados corretamente.
