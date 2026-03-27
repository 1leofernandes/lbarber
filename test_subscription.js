// test_subscription.js
require('dotenv').config();
const MercadoPago = require('./src/config/mercadoPago');

async function verificarAssinaturas() {
  const assinaturasIds = [
    '20590b667f4b4988b145cd52e9044cae',  // ID 4
    '14a5b5f9af28448b85a2c24642963162',  // ID 5
    '42d152f628a94136b6a7f7921c4a4552'   // ID 6
  ];
  
  for (const id of assinaturasIds) {
    try {
      const result = await MercadoPago.getSubscription(id);
      console.log(`\n=== Assinatura ${id} ===`);
      console.log(`Status no Mercado Pago: ${result.status}`);
      console.log(`Próxima cobrança: ${result.next_payment_date}`);
      console.log(`Motivo: ${result.reason}`);
      console.log(`Payer email: ${result.payer_email}`);
      console.log(`Status detalhado:`, result.status_detail);
    } catch (error) {
      console.log(`\n=== Assinatura ${id} ===`);
      console.log(`❌ Erro: ${error.message}`);
    }
  }
}

verificarAssinaturas();