const Agendamento = require('../../models/Agendamento');
const Assinatura = require('../../models/Assinatura');
const Pagamento = require('../../models/Pagamento');
const Usuario = require('../../models/Usuario');

class DashboardService {
    async getResumoFinanceiro(mes, ano) {
        try {
            const dataInicio = new Date(ano, mes - 1, 1);
            const dataFim = new Date(ano, mes, 0);
            
            const [
                receitaTotal,
                receitaAssinaturas,
                receitaAgendamentos,
                novosClientes,
                agendamentosMes,
                assinaturasAtivas
            ] = await Promise.all([
                this.calcularReceitaTotal(dataInicio, dataFim),
                this.calcularReceitaAssinaturas(dataInicio, dataFim),
                this.calcularReceitaAgendamentos(dataInicio, dataFim),
                this.contarNovosClientes(dataInicio, dataFim),
                this.contarAgendamentosMes(dataInicio, dataFim),
                this.contarAssinaturasAtivas()
            ]);

            return {
                receitaTotal,
                receitaAssinaturas,
                receitaAgendamentos,
                novosClientes,
                agendamentosMes,
                assinaturasAtivas,
                ticketMedio: agendamentosMes > 0 ? receitaTotal / agendamentosMes : 0
            };
        } catch (error) {
            console.error('Erro ao buscar resumo financeiro:', error);
            throw error;
        }
    }

    async calcularReceitaTotal(dataInicio, dataFim) {
        try {
            const pagamentos = await Pagamento.getReceitaTotal(
                dataInicio.toISOString().split('T')[0],
                dataFim.toISOString().split('T')[0]
            );
            
            let total = 0;
            pagamentos.forEach(p => {
                if (p.status === 'pago') {
                    total += parseFloat(p.total);
                }
            });
            
            return total;
        } catch (error) {
            console.error('Erro ao calcular receita total:', error);
            return 0;
        }
    }

    async calcularReceitaAssinaturas(dataInicio, dataFim) {
        try {
            const receitaMensal = await Assinatura.getReceitaMensal();
            
            let total = 0;
            receitaMensal.forEach(r => {
                if (parseInt(r.mes) === dataInicio.getMonth() + 1 && 
                    parseInt(r.ano) === dataInicio.getFullYear()) {
                    total += parseFloat(r.receita_total);
                }
            });
            
            return total;
        } catch (error) {
            console.error('Erro ao calcular receita de assinaturas:', error);
            return 0;
        }
    }

    async calcularReceitaAgendamentos(dataInicio, dataFim) {
        try {
            return await Agendamento.getReceitaTotal(
                dataInicio.toISOString().split('T')[0],
                dataFim.toISOString().split('T')[0]
            );
        } catch (error) {
            console.error('Erro ao calcular receita de agendamentos:', error);
            return 0;
        }
    }

    async contarNovosClientes(dataInicio, dataFim) {
        try {
            const query = `
                SELECT COUNT(*) as total
                FROM usuarios
                WHERE created_at BETWEEN $1 AND $2
                AND 'cliente' = ANY(roles)
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [dataInicio, dataFim]);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao contar novos clientes:', error);
            return 0;
        }
    }

    async contarAgendamentosMes(dataInicio, dataFim) {
        try {
            return await Agendamento.count({
                data_inicio: dataInicio.toISOString().split('T')[0],
                data_fim: dataFim.toISOString().split('T')[0]
            });
        } catch (error) {
            console.error('Erro ao contar agendamentos do mês:', error);
            return 0;
        }
    }

    async contarAssinaturasAtivas() {
        try {
            return await Assinatura.count('ativo');
        } catch (error) {
            console.error('Erro ao contar assinaturas ativas:', error);
            return 0;
        }
    }

    async getGraficoReceita(periodo = '6meses') {
        try {
            const hoje = new Date();
            let dataInicio;
            
            switch (periodo) {
                case '1mes':
                    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate());
                    break;
                case '3meses':
                    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 3, hoje.getDate());
                    break;
                case '6meses':
                    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 6, hoje.getDate());
                    break;
                case '1ano':
                    dataInicio = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
                    break;
                default:
                    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 6, hoje.getDate());
            }
            
            const query = `
                SELECT 
                    DATE_TRUNC('month', p.data_pagamento) as mes,
                    COALESCE(SUM(CASE WHEN p.tipo = 'assinatura' THEN p.valor ELSE 0 END), 0) as assinaturas,
                    COALESCE(SUM(CASE WHEN p.tipo = 'agendamento' THEN p.valor ELSE 0 END), 0) as agendamentos
                FROM pagamentos p
                WHERE p.data_pagamento >= $1
                AND p.status = 'pago'
                GROUP BY DATE_TRUNC('month', p.data_pagamento)
                ORDER BY mes ASC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [dataInicio]);
            
            return result.rows.map(row => ({
                mes: new Date(row.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                assinaturas: parseFloat(row.assinaturas),
                agendamentos: parseFloat(row.agendamentos)
            }));
        } catch (error) {
            console.error('Erro ao buscar dados do gráfico de receita:', error);
            throw error;
        }
    }

    async getTopServicos(limit = 5) {
        try {
            const query = `
                SELECT 
                    s.nome_servico,
                    COUNT(a.id) as total_agendamentos,
                    COALESCE(SUM(s.valor_servico), 0) as receita_total
                FROM agendamentos a
                JOIN servicos s ON a.servico_id = s.id
                WHERE a.status = 'finalizado'
                AND a.data_agendada >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY s.id, s.nome_servico
                ORDER BY total_agendamentos DESC
                LIMIT $1
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [limit]);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar top serviços:', error);
            throw error;
        }
    }

    async getMetricasBarbeiros() {
        try {
            const query = `
                SELECT 
                    u.id,
                    u.nome,
                    COUNT(a.id) as total_agendamentos,
                    COALESCE(SUM(s.valor_servico), 0) as receita_gerada
                FROM usuarios u
                LEFT JOIN agendamentos a ON u.id = a.barbeiro_id
                LEFT JOIN servicos s ON a.servico_id = s.id
                WHERE 'barbeiro' = ANY(u.roles)
                AND u.ativo = true
                AND a.data_agendada >= CURRENT_DATE - INTERVAL '30 days'
                AND a.status = 'finalizado'
                GROUP BY u.id, u.nome
                ORDER BY receita_gerada DESC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar métricas dos barbeiros:', error);
            throw error;
        }
    }
}

module.exports = new DashboardService();