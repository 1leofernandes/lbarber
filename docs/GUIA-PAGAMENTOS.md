# 💳 GUIA DE INTEGRAÇÃO - STRIPE E PAGAR.ME

## Comparação: Stripe vs Pagar.me

| Aspecto | Stripe | Pagar.me |
|---------|--------|----------|
| Taxa | 2.99% + R$0.30 | 2.99% + R$0.30 |
| Documentação | Excelente | Boa |
| Suporte | Ótimo | Ótimo (PT-BR) |
| Recebimento | 2-7 dias | 2-7 dias |
| Recomendação | Melhor para SaaS | Melhor Brasil |

**Recomendação:** Use **Pagar.me** (melhor para público BR)

---

## PASSO 1: Integração Básica Stripe

### 1.1 Instalar dependência

```bash
npm install stripe
```

### 1.2 Adicionar variáveis ao .env

```env
STRIPE_SECRET_KEY=sk_test_seu_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_seu_public_key
STRIPE_WEBHOOK_SECRET=whsec_seu_webhook_secret
```

### 1.3 Criar Stripe Service

```javascript
// src/services/stripeService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  static async createCheckoutSession(usuario_id, plano_id, email) {
    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: plano_id === 1 ? 'Plano Básico' : 'Plano Premium'
          },
          unit_amount: plano_id === 1 ? 9900 : 29900 // centavos
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancelado`,
      customer_email: email
    });

    return session;
  }

  static async handleWebhookEvent(event) {
    switch (event.type) {
      case 'checkout.session.completed':
        // Pagamento bem-sucedido
        return this.handlePaymentSuccess(event.data.object);
      
      case 'charge.failed':
        // Pagamento falhou
        return this.handlePaymentFailed(event.data.object);
      
      default:
        return null;
    }
  }

  static async handlePaymentSuccess(session) {
    // Registrar pagamento
    // Ativar assinatura
    // Enviar email confirmação
    logger.info('Pagamento confirmado Stripe', session);
  }

  static async handlePaymentFailed(charge) {
    logger.warn('Pagamento falhou Stripe', charge);
  }
}

module.exports = StripeService;
```

### 1.4 Integrar ao server.js

```javascript
// server.js
const StripeService = require('./src/services/stripeService');

// Webhook Stripe (ANTES de bodyParser JSON)
app.post('/pagamentos/webhook/stripe', 
  express.raw({type: 'application/json'}), 
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      await StripeService.handleWebhookEvent(event);
      res.json({ received: true });
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// Outras rotas DEPOIS
app.use(bodyParser.json());
```

---

## PASSO 2: Integração Pagar.me (RECOMENDADO PARA BRASIL)

### 2.1 Instalar dependência

```bash
npm install pagarme
```

### 2.2 Adicionar ao .env

```env
PAGAR_ME_API_KEY=ak_live_seu_api_key
PAGAR_ME_ENCRYPTION_KEY=ek_live_seu_encryption_key
```

### 2.3 Criar Pagar.me Service

```javascript
// src/services/pagarMeService.js
const pagarme = require('pagarme');

class PagarMeService {
  static async createTransaction(usuario_id, amount, cardToken) {
    try {
      // Conectar à API Pagar.me
      const client = await pagarme.client.connect({
        api_key: process.env.PAGAR_ME_API_KEY
      });

      // Criar transação
      const transaction = await client.transactions.create({
        amount: Math.round(amount * 100), // centavos
        card_id: cardToken,
        customer: {
          external_id: String(usuario_id),
          name: 'Cliente ' + usuario_id,
          email: 'cliente@example.com',
          type: 'individual'
        },
        billing: {
          name: 'Assinatura Barbearia',
          address: {
            country: 'br',
            state: 'sp',
            city: 'São Paulo',
            street: 'Rua X',
            street_number: '123',
            zipcode: '01234-567'
          }
        }
      });

      return transaction;
    } catch (err) {
      logger.error('Erro Pagar.me:', err);
      throw err;
    }
  }

  static async createSubscription(usuario_id, plano_id, cardToken) {
    try {
      const client = await pagarme.client.connect({
        api_key: process.env.PAGAR_ME_API_KEY
      });

      // Determinar preço conforme plano
      const prices = {
        1: 9900, // Plano Básico
        2: 29900  // Plano Premium
      };

      const subscription = await client.subscriptions.create({
        customer_id: usuario_id,
        plan_id: plano_id,
        card_id: cardToken,
        capture: true
      });

      return subscription;
    } catch (err) {
      logger.error('Erro criar assinatura Pagar.me:', err);
      throw err;
    }
  }

  static async handleWebhookEvent(event) {
    // Processar eventos do Pagar.me
    logger.info('Webhook Pagar.me:', event);
    
    switch (event.type) {
      case 'transaction':
        if (event.status === 'paid') {
          // Pagamento aprovado
        } else if (event.status === 'refused') {
          // Pagamento recusado
        }
        break;
      
      case 'subscription':
        if (event.current_status === 'active') {
          // Assinatura ativa
        }
        break;
    }
  }
}

module.exports = PagarMeService;
```

---

## PASSO 3: Frontend - Integração com Checkout

### 3.1 HTML para Formulário de Cartão

```html
<form id="payment-form">
  <div id="card-element"></div>
  <button type="submit">Assinar Plano</button>
  <div id="payment-message"></div>
</form>

<script src="https://js.stripe.com/v3/"></script>
<script>
const stripe = Stripe(PK_KEY);
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const { token } = await stripe.createToken(cardElement);
  
  // Enviar para backend
  const response = await fetch('/pagamentos/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token.id,
      plano_id: 1
    })
  });

  const result = await response.json();
  // Redirecionar para checkout ou tratar sucesso/erro
});
</script>
```

---

## PASSO 4: Fluxo Completo de Assinatura

### Fluxograma

```
1. Cliente clica "Assinar"
   ↓
2. Frontend abre modal com planos
   ↓
3. Cliente seleciona plano + insere cartão
   ↓
4. Frontend envia token do Stripe/Pagar.me
   ↓
5. Backend cria checkout session (Stripe) ou transaction (Pagar.me)
   ↓
6. Cliente completa pagamento
   ↓
7. Webhook confirma pagamento
   ↓
8. Backend:
   - Cria assinatura no DB
   - Atualiza permissões do usuário
   - Envia email confirmação
   ↓
9. Cliente redireciona para Dashboard
```

### Implementação Backend

```javascript
// src/controllers/paymentController.js

static async createCheckoutSession(req, res, next) {
  try {
    const { plano_id } = req.body;
    const usuario_id = req.user.id;
    const user = await User.findById(usuario_id);

    const session = await StripeService.createCheckoutSession(
      usuario_id,
      plano_id,
      user.email
    );

    res.json({
      success: true,
      sessionId: session.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    next(err);
  }
}
```

---

## PASSO 5: Testes

### Cartões de Teste Stripe

```
Pagamento bem-sucedido: 4242 4242 4242 4242
Pagamento recusado: 4000 0000 0000 0002
Expiração: qualquer data futura
CVC: qualquer 3 dígitos
```

### Cartões de Teste Pagar.me

```
Sucesso: 4111 1111 1111 1111
Falha: 4111 1111 1111 1112
```

---

## PASSO 6: Deploy em Produção

### 6.1 Chaves de Produção

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_XXXXX
STRIPE_PUBLISHABLE_KEY=pk_live_XXXXX

# Pagar.me
PAGAR_ME_API_KEY=ak_live_XXXXX
```

### 6.2 Configurar Webhook em Produção

**Stripe:**
1. Dashboard Stripe → Developers → Webhooks
2. Add Endpoint: `https://seu-dominio/pagamentos/webhook/stripe`
3. Selecione eventos: `charge.succeeded`, `charge.failed`, etc
4. Copie Signing Secret para `STRIPE_WEBHOOK_SECRET`

**Pagar.me:**
1. Dashboard → Configurações → Webhooks
2. URL: `https://seu-dominio/pagamentos/webhook/pagar-me`
3. Selecione eventos desejados

---

## Monitoramento

### Verificar Transações

```javascript
// Dashboard ou via CLI
stripe.transactions.list();  // Stripe
pagarme.transactions.find(); // Pagar.me
```

### Logs Importantes

```javascript
// Em production, registre:
logger.info('Assinatura criada', { 
  usuario_id, 
  plano_id, 
  stripe_id, 
  amount 
});

logger.warn('Pagamento falhou', { 
  usuario_id, 
  reason: err.message 
});
```

---

## Problemas Comuns

### ❌ Webhook não recebido
- Verificar se URL está acessível publicamente
- Testar local com ngrok: `ngrok http 3000`

### ❌ Transação criada mas assinatura não ativa
- Verificar se webhook foi processado
- Verificar logs do backend

### ❌ Cliente vê erro ao pagar
- Checar console do browser
- Verificar chaves de API

---

## Próximas Etapas

1. ✅ Integrar pagamentos
2. 📧 Enviar email confirmação
3. 🔄 Implementar renovação automática
4. 💳 Dashboard para gerenciar assinatura
5. 📊 Relatórios de receita
