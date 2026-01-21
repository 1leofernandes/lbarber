const axios = require('axios');

async function main() {
  try {
    // Verifica agendamentos próximos
    const agora = new Date();
    const duasHorasFrente = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
    
    // Formato para query
    const params = new URLSearchParams({
      inicio: agora.toISOString(),
      fim: duasHorasFrente.toISOString()
    });
    
    const response = await axios.get(
      `https://barbeariasilva.onrender.com/agendamentos?${params}`,
      { timeout: 5000 } // Timeout curto
    );
    
    if (response.data.length > 0) {
      console.log(`📅 ${response.data.length} agendamento(s) nas próximas 2 horas`);
      // Mantém acordado com um health check
      await axios.get('https://barbeariasilva.onrender.com/health');
    } else {
      console.log('😴 Sem agendamentos próximos - pode dormir');
    }
  } catch (error) {
    console.log('⚠️  Erro ao verificar, mantendo acordado por segurança');
    await axios.get('https://barbeariasilva.onrender.com/health');
  }
}

main();