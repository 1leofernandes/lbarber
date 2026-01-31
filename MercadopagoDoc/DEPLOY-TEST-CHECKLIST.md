# Checklist de Deploy e Testes (Produção)

1. Variáveis de ambiente (PRODUÇÃO)
   - MERCADO*PAGO_ACCESS_TOKEN=APP_USR*... (produção)
   - MERCADO*PAGO_PUBLIC_KEY=pk*...
   - WEBHOOK_SECRET=uma_chave_segura_e_aleatoria
   - FRONTEND_URL=https://barbeariasilva.vercel.app
   - BACKEND_URL=https://barbeariasilva.onrender.com

2. Endpoints do Mercado Pago
   - Webhook URL configurado: `https://barbeariasilva.onrender.com/webhooks/mercado-pago` (ou `https://barbeariasilva.onrender.com/api/webhooks/mercado-pago`)
   - Eventos habilitados: `payment`, `preapproval`/`subscription`, `plan` (opcional)

3. Deploy do backend
   - Instalar dependências: `npm install`
   - Reiniciar servidor (pm2 / systemd / Render)
   - Confirmar que `GET /health` retorna status ok

4. Testes em produção (poucos clientes reais primeiro)
   - Entrar no frontend (login como cliente)
   - Acessar `assinatura.html` e escolher um plano
   - Realizar checkout via Mercado Pago (com cartão real)
   - Verificar retorno e redirecionamento ao `back_url`
   - Verificar webhook recebido e registros em DB

5. Verificações adicionais
   - Conferir registros: `assinaturas_usuarios`, `assinaturas_pagamentos_recorrentes`, `assinaturas_historico_cobrancas`, `usuarios.assinante`
   - Logs do servidor: sem erros ao processar webhooks
   - Notificar o dono após o primeiro teste com dados reais para validar recebimentos

6. Rollback
   - Se algo crítico falhar, reverter chaves para sandbox e reprocessar com ambiente de teste até corrigir o problema

7. Observações finais
   - Registre toda alteração de chave/URL em documento seguro (senhas manager)
   - Monitore transações nas primeiras 48 horas após liberar para produção
