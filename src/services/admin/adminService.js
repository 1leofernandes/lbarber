const Usuario = require('../../models/Usuario');
const Agendamento = require('../../models/Agendamento');
const Servico = require('../../models/Servico');
const Barbeiro = require('../../models/Barbeiro');
const Assinatura = require('../../models/Assinatura');
const Pagamento = require('../../models/Pagamento');
const Plano = require('../../models/Plano');

class AdminService {
    // Métricas gerais do dashboard
    async getDashboardStats() {
        try {
            const [
                totalAgendamentosHoje,
                totalAgendamentosMes,
                totalClientes,
                totalBarbeiros,
                totalServicos,
                totalAssinantes,
                receitaHoje,
                receitaMes
            ] = await Promise.all([
                Agendamento.count({ data: new Date().toISOString().split('T')[0] }),
                Agendamento.count({}),
                Usuario.count(),
                Barbeiro.count(),
                Servico.count(),
                Assinatura.count(),
                Pagamento.getTotalHoje(),
                this.getReceitaMesAtual()
            ]);

            return {
                totalAgendamentosHoje,
                totalAgendamentosMes,
                totalClientes,
                totalBarbeiros,
                totalServicos,
                totalAssinantes,
                receitaHoje,
                receitaMes,
                taxaOcupacao: await this.calcularTaxaOcupacao(),
                crescimentoReceita: await this.calcularCrescimentoReceita()
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas do dashboard:', error);
            throw error;
        }
    }

    async getReceitaMesAtual() {
        try {
            const hoje = new Date();
            const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            
            const receita = await Agendamento.getReceitaTotal(
                primeiroDiaMes.toISOString().split('T')[0],
                ultimoDiaMes.toISOString().split('T')[0]
            );
            
            return receita;
        } catch (error) {
            console.error('Erro ao calcular receita do mês:', error);
            return 0;
        }
    }

    async calcularTaxaOcupacao() {
        try {
            // Horários disponíveis por barbeiro (8 horas/dia)
            const totalBarbeiros = await Barbeiro.count();
            const horasDisponiveis = totalBarbeiros * 8;
            
            // Agendamentos de hoje
            const hoje = new Date().toISOString().split('T')[0];
            const agendamentosHoje = await Agendamento.count({ data: hoje });
            
            // Cada agendamento tem em média 1 hora
            const taxa = horasDisponiveis > 0 ? (agendamentosHoje / horasDisponiveis) * 100 : 0;
            return Math.min(taxa, 100);
        } catch (error) {
            console.error('Erro ao calcular taxa de ocupação:', error);
            return 0;
        }
    }

    async calcularCrescimentoReceita() {
        try {
            const hoje = new Date();
            const mesAtual = hoje.getMonth();
            const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            
            const receitaMesAtual = await this.getReceitaMesAtual();
            const receitaMesAnterior = await Agendamento.getReceitaTotal(
                mesAnterior.toISOString().split('T')[0],
                new Date(hoje.getFullYear(), mesAtual, 0).toISOString().split('T')[0]
            );
            
            if (receitaMesAnterior === 0) return 100; // Primeiro mês
            
            const crescimento = ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100;
            return Math.round(crescimento * 100) / 100;
        } catch (error) {
            console.error('Erro ao calcular crescimento da receita:', error);
            return 0;
        }
    }

    // Buscar dados para o painel inicial
    async getPainelInicial() {
        try {
            const [
                agendamentosRecentes,
                servicosPopulares,
                assinaturasAtivas,
                pagamentosRecentes
            ] = await Promise.all([
                this.getAgendamentosRecentes(),
                this.getServicosPopulares(),
                this.getAssinaturasAtivas(),
                this.getPagamentosRecentes()
            ]);

            return {
                agendamentosRecentes,
                servicosPopulares,
                assinaturasAtivas,
                pagamentosRecentes
            };
        } catch (error) {
            console.error('Erro ao buscar dados do painel inicial:', error);
            throw error;
        }
    }

    async getAgendamentosRecentes(limit = 10) {
        try {
            return await Agendamento.findAll({}, limit, 0);
        } catch (error) {
            console.error('Erro ao buscar agendamentos recentes:', error);
            throw error;
        }
    }

    async getServicosPopulares() {
        try {
            // Implementar lógica para serviços mais agendados
            const servicos = await Servico.findAll();
            return servicos.slice(0, 5); // Temporário
        } catch (error) {
            console.error('Erro ao buscar serviços populares:', error);
            throw error;
        }
    }

    async getAssinaturasAtivas() {
        try {
            return await Assinatura.findAll({ status: 'ativo' });
        } catch (error) {
            console.error('Erro ao buscar assinaturas ativas:', error);
            throw error;
        }
    }

    async getPagamentosRecentes(limit = 10) {
        try {
            return await Pagamento.findAll({}, limit, 0);
        } catch (error) {
            console.error('Erro ao buscar pagamentos recentes:', error);
            throw error;
        }
    }
}

module.exports = new AdminService();