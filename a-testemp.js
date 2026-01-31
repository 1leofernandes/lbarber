
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';

const client = new MercadoPagoConfig({ 
    accessToken: 'TEST-119178121117776-012914-87e14c28a1188330634131112eccad88-677278457' // Use o de teste!
});

const plan = new PreApprovalPlan(client);

async function createPlan() {
    try {
        const body = {
            reason: "Assinatura Mensal - Silva Barbearia",
            auto_recurring: { // Mudança aqui: de repetition para auto_recurring
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 0.50,
                currency_id: "BRL"
            },
            back_url: "https://www.google.com", // URL temporária para teste
            status: "active"
        };

        const result = await plan.create({ body });
        
        console.log("✅ Plano Criado com Sucesso!");
        console.log("ID do Plano:", result.id);
        console.log("Link para o cliente assinar:", result.init_point);
    } catch (error) {
        // Log detalhado para capturar erros da API
        console.error("❌ Erro ao criar plano:", error.message);
        if (error.cause) console.error("Detalhes:", error.cause);
    }
}

createPlan();

// const preApproval = new PreApproval(client);

// async function cancelSubscription(subscriptionId) {
//     try {
//         // O cancelamento é apenas um "update" mudando o status para "cancelled"
//         const result = await preApproval.update({ 
//             id: subscriptionId, 
//             body: { status: "cancelled" } 
//         });
//         console.log("Assinatura cancelada com sucesso!");
//     } catch (error) {
//         console.error("Erro ao cancelar:", error);
//     }
// }