# Frontend - Fluxo de Assinatura (Mercado Pago)

Este guia descreve as alterações no frontend para permitir que um cliente escolha um plano e seja redirecionado ao Mercado Pago para cadastrar o cartão e assinar.

Arquivos alterados:

- `public/assinatura.html`
  - Lista planos via GET `/api/subscricoes-recorrentes/planos`
  - Botão **Torne-se um assinante** para cada plano que inicia o fluxo
  - O botão chama POST `/api/subscricoes-recorrentes/checkout` e redireciona para a URL retornada pelo Mercado Pago

- `public/minha-assinatura.html`
  - Adiciona botão rápido que direciona para `assinatura.html`

Como funciona (resumo):

1. Usuário logado acessa `assinatura.html`.
2. A página carrega planos (`GET /api/subscricoes-recorrentes/planos`) e mostra `nome_plano`, `valor`, `servicos`.
3. Ao clicar **Torne-se um assinante**, o frontend chama `POST /api/subscricoes-recorrentes/checkout` (envia `planoId`) com `Authorization: Bearer <token>`.
4. O backend cria um `preapproval` no Mercado Pago e retorna `redirectUrl`.
5. Frontend redireciona o usuário para o Mercado Pago (sandbox/produção conforme suas chaves).
6. O usuário completa o fluxo no Mercado Pago (cadastra cartão, autoriza assinatura).
7. O Mercado Pago envia um webhook para `POST /webhooks/mercado-pago` do backend; o backend processa e cria/atualiza registros locais (assinaturas_usuarios, assinaturas_pagamentos_recorrentes, marcar `usuarios.assinante=true`).
8. Após o redirecionamento de retorno (via `back_url`), o frontend pode checar `GET /subscricoes-recorrentes/minha-assinatura` para ver o status atualizado.

## 9) Status automático na interface

O sistema agora exibe automaticamente o status da assinatura no canto superior direito (badge no header). Funciona assim:

- O badge é carregado via `GET /api/subscricoes-recorrentes/minha-assinatura` usando o token do usuário (`Authorization: Bearer <token>`).
- O badge é atualizado a cada 60 segundos e também ao carregar a página.
- Exibe status resumido (Ativa, Pendente, Cancelada, Suspensa) e, quando disponível, a data da próxima cobrança.
- Se o usuário não estiver autenticado, o badge fica oculto.

Essa funcionalidade está presente em `cliente-home.html`, `assinatura.html` e `minha-assinatura.html`.Observações de segurança e UX:

- O usuário precisa estar autenticado para iniciar checkout (o backend usa o email do usuário para preencher `payer_email`).
- Não armazenamos dados de cartão no nosso sistema. Tudo é feito pelo Mercado Pago.
- Para testes, use credenciais de sandbox no `.env`.

Problemas comuns:

- Se o webhook não estiver configurado corretamente ou o `WEBHOOK_SECRET` não bater, o backend pode não criar a assinatura local; verifique logs e tabela `assinaturas_usuarios`.
- Se o `redirectUrl` não for retornado, verifique se sua `MERCADO_PAGO_ACCESS_TOKEN` está correta.

Sugestão: teste primeiro em sandbox e verifique fluxo completo (checkout → webhook → registro local) antes de usar cartões reais em produção.
