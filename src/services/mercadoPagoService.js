// import { MercadoPagoConfig, CardToken, Payment, Preapproval } from 'mercadopago';
// import dotenv from 'dotenv';

// dotenv.config();

// const client = new MercadoPagoConfig({
//   accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
// });

// export class MercadoPagoService {
  
//   // Criar token do cartão
//   static async criarTokenCartao(cartaoData) {
//     try {
//       const cardToken = new CardToken(client);
      
//       const tokenData = {
//         card_number: cartaoData.numero.replace(/\s/g, ''),
//         expiration_year: cartaoData.ano.toString(),
//         expiration_month: cartaoData.mes.toString().padStart(2, '0'),
//         security_code: cartaoData.cvv,
//         cardholder: {
//           name: cartaoData.nome,
//           identification: {
//             type: cartaoData.tipoDocumento || 'CPF',
//             number: cartaoData.documento.replace(/\D/g, '')
//           }
//         }
//       };

//       const token = await cardToken.create({ body: tokenData });
//       return token.id;
//     } catch (error) {
//       console.error('Erro ao criar token do cartão:', error);
//       throw new Error('Falha ao processar cartão');
//     }
//   }

//   // Processar pagamento único (para testes)
//   static async processarPagamento(pagamentoData) {
//     try {
//       const payment = new Payment(client);
      
//       const pagamento = await payment.create({
//         body: {
//           transaction_amount: pagamentoData.valor,
//           token: pagamentoData.token,
//           description: pagamentoData.descricao,
//           installments: 1,
//           payment_method_id: pagamentoData.metodoPagamento,
//           payer: {
//             email: pagamentoData.email,
//             identification: {
//               type: pagamentoData.tipoDocumento,
//               number: pagamentoData.documento
//             }
//           }
//         }
//       });

//       return pagamento;
//     } catch (error) {
//       console.error('Erro ao processar pagamento:', error);
//       throw error;
//     }
//   }

//   // Buscar detalhes da assinatura
//   static async buscarAssinatura(subscriptionId) {
//     try {
//       const preapproval = new Preapproval(client);
//       return await preapproval.get({ id: subscriptionId });
//     } catch (error) {
//       console.error('Erro ao buscar assinatura:', error);
//       throw error;
//     }
//   }

//   // Verificar status do plano
//   static async verificarStatusPlano(planId) {
//     try {
//       const response = await fetch(`https://api.mercadopago.com/preapproval_plan/${planId}`, {
//         headers: {
//           'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
//         }
//       });
//       return await response.json();
//     } catch (error) {
//       console.error('Erro ao verificar plano:', error);
//       throw error;
//     }
//   }
// }