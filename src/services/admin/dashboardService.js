const pool = require('../../config/database');

class DashboardService {
    async getResumoFinanceiro(mes, ano) {
        try {
            const dataInicio = new Date(ano, mes - 1, 1);
            const dataFim = new Date(ano, mes, 0);
            
            const [
                receitaTotal,
                totalClientes,
                agendamentosConcluidos,
                novosClientes,
                taxaConversao
            ] = await Promise.all([
                this.calcularReceitaTotal(dataInicio, dataFim),
                this.contarTotalClientes(),
                this.contarAgendamentosConcluidos(dataInicio, dataFim),
                this.contarNovosClientes(dataInicio, dataFim),
                this.calcularTaxaConversao(dataInicio, dataFim)
            ]);
            
            return {
                receitaTotal,
                totalClientes,
                agendamentosConcluidos,
                novosClientes,
                taxaConversao
            };
        } catch (error) {
            console.error('Erro ao buscar resumo financeiro:', error);
            throw error;
        }
    }

    async calcularReceitaTotal(dataInicio, dataFim) {
        try {
            // Considerando múltiplos serviços por agendamento
            const query = `
                SELECT COALESCE(SUM(s.valor_servico), 0) as total
                FROM agendamentos a
                LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                LEFT JOIN servicos s ON ags.servico_id = s.id
                WHERE a.status = 'concluido'
                AND a.data_agendada >= $1
                AND a.data_agendada <= $2
            `;
            
            const result = await pool.query(query, [
                dataInicio.toISOString().split('T')[0],
                dataFim.toISOString().split('T')[0]
            ]);
            
            return parseFloat(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao calcular receita total:', error);
            return 0;
        }
    }

    async contarTotalClientes() {
        try {
            // Verificar se usa role ou roles
            const query = `
                SELECT COUNT(*) as total
                FROM usuarios
                WHERE role = 'cliente'
                OR (roles IS NOT NULL AND roles = 'cliente')
            `;
            
            const result = await pool.query(query);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao contar total de clientes:', error);
            return 0;
        }
    }

    async contarAgendamentosConcluidos(dataInicio, dataFim) {
        try {
            const query = `
                SELECT COUNT(*) as total
                FROM agendamentos
                WHERE status = 'concluido'
                AND data_agendada >= $1
                AND data_agendada <= $2
            `;
            
            const result = await pool.query(query, [
                dataInicio.toISOString().split('T')[0],
                dataFim.toISOString().split('T')[0]
            ]);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao contar agendamentos concluídos:', error);
            return 0;
        }
    }

    async contarNovosClientes(dataInicio, dataFim) {
        try {
            const query = `
                SELECT COUNT(*) as total
                FROM usuarios
                WHERE (role = 'cliente' OR (roles IS NOT NULL AND roles = 'cliente'))
                AND created_at >= $1
                AND created_at <= $2
            `;
            
            const result = await pool.query(query, [
                dataInicio.toISOString(),
                dataFim.toISOString()
            ]);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao contar novos clientes:', error);
            return 0;
        }
    }

    async calcularTaxaConversao(dataInicio, dataFim) {
        try {
            const query = `
                SELECT 
                    COUNT(CASE WHEN status = 'concluido' THEN 1 END) as concluidos,
                    COUNT(*) as total
                FROM agendamentos
                WHERE data_agendada >= $1
                AND data_agendada <= $2
                AND status IN ('confirmado', 'concluido', 'cancelado')
            `;
            
            const result = await pool.query(query, [
                dataInicio.toISOString().split('T')[0],
                dataFim.toISOString().split('T')[0]
            ]);
            
            const concluidos = parseInt(result.rows[0].concluidos);
            const total = parseInt(result.rows[0].total);
            
            return total > 0 ? (concluidos / total * 100) : 0;
        } catch (error) {
            console.error('Erro ao calcular taxa de conversão:', error);
            return 0;
        }
    }

    async getGraficoReceita(periodo = '6meses') {
        try {
            const hoje = new Date();
            let meses;
            
            switch (periodo) {
                case '1mes': meses = 1; break;
                case '3meses': meses = 3; break;
                case '6meses': meses = 6; break;
                case '1ano': meses = 12; break;
                default: meses = 6;
            }
            
            const dados = [];
            
            for (let i = meses - 1; i >= 0; i--) {
                const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
                const dataInicio = new Date(data.getFullYear(), data.getMonth(), 1);
                const dataFim = new Date(data.getFullYear(), data.getMonth() + 1, 0);
                
                const receita = await this.calcularReceitaTotal(dataInicio, dataFim);
                
                dados.push({
                    mes: data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                    receita: receita
                });
            }
            
            return dados;
        } catch (error) {
            console.error('Erro ao buscar dados do gráfico de receita:', error);
            throw error;
        }
    }

    async getTopServicos(limit = 5) {
        try {
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
            
            // Consulta otimizada considerando múltiplos serviços
            const query = `
                WITH servicos_agendados AS (
                    SELECT 
                        s.id,
                        s.nome_servico,
                        s.valor_servico,
                        a.data_agendada
                    FROM agendamentos a
                    JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                    JOIN servicos s ON ags.servico_id = s.id
                    WHERE a.status = 'concluido'
                    AND a.data_agendada >= $1
                )
                SELECT 
                    nome_servico,
                    COUNT(*) as quantidade,
                    COALESCE(SUM(valor_servico), 0) as receita_total,
                    COALESCE(AVG(valor_servico), 0) as media_servico
                FROM servicos_agendados
                GROUP BY id, nome_servico
                ORDER BY quantidade DESC
                LIMIT $2
            `;
            
            const result = await pool.query(query, [
                trintaDiasAtras.toISOString().split('T')[0],
                limit
            ]);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar top serviços:', error);
            throw error;
        }
    }

    async getMetricasBarbeiros() {
        try {
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
            
            const query = `
                SELECT 
                    u.id,
                    u.nome,
                    COUNT(DISTINCT a.id) as total_agendamentos,
                    COALESCE(SUM(s.valor_servico), 0) as receita_gerada
                FROM usuarios u
                LEFT JOIN agendamentos a ON u.id = a.barbeiro_id
                LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                LEFT JOIN servicos s ON ags.servico_id = s.id
                WHERE (u.role = 'barbeiro' OR 'barbeiro' = ANY(u.roles))
                AND a.data_agendada >= $1
                AND a.status = 'concluido'
                GROUP BY u.id, u.nome
                ORDER BY receita_gerada DESC
            `;
            
            const result = await pool.query(query, [trintaDiasAtras.toISOString().split('T')[0]]);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar métricas dos barbeiros:', error);
            throw error;
        }
    }

    // Método adicional para o card da página inicial
    async getResumoHoje() {
        try {
            const hoje = new Date();
            const dataHoje = hoje.toISOString().split('T')[0];
            
            const [
                receitaHoje,
                agendamentosHoje,
                novosClientesHoje,
                servicosPopularesHoje
            ] = await Promise.all([
                this.calcularReceitaHoje(dataHoje),
                this.contarAgendamentosHoje(dataHoje),
                this.contarNovosClientesHoje(),
                this.getServicosPopularesHoje(dataHoje)
            ]);
            
            return {
                receitaHoje,
                agendamentosHoje,
                novosClientesHoje,
                servicosPopularesHoje: servicosPopularesHoje.length
            };
        } catch (error) {
            console.error('Erro ao buscar resumo do dia:', error);
            throw error;
        }
    }

    async calcularReceitaHoje(dataHoje) {
        try {
            const query = `
                SELECT COALESCE(SUM(s.valor_servico), 0) as total
                FROM agendamentos a
                LEFT JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                LEFT JOIN servicos s ON ags.servico_id = s.id
                WHERE a.status = 'concluido'
                AND a.data_agendada = $1
            `;
            
            const result = await pool.query(query, [dataHoje]);
            return parseFloat(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao calcular receita de hoje:', error);
            return 0;
        }
    }

    async contarAgendamentosHoje(dataHoje) {
        try {
            const query = `
                SELECT COUNT(*) as total
                FROM agendamentos
                WHERE data_agendada = $1
                AND status = 'concluido'
            `;
            
            const result = await pool.query(query, [dataHoje]);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao contar agendamentos de hoje:', error);
            return 0;
        }
    }

    async contarNovosClientesHoje() {
        try {
            const hoje = new Date();
            const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
            
            const query = `
                SELECT COUNT(*) as total
                FROM usuarios
                WHERE (role = 'cliente' OR (roles IS NOT NULL AND roles = 'cliente'))
                AND created_at >= $1
                AND created_at < $2
            `;
            
            const result = await pool.query(query, [
                inicioDia.toISOString(),
                fimDia.toISOString()
            ]);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao contar novos clientes hoje:', error);
            return 0;
        }
    }

    async getServicosPopularesHoje(dataHoje) {
        try {
            const query = `
                SELECT DISTINCT s.id, s.nome_servico
                FROM agendamentos a
                JOIN agendamento_servicos ags ON a.id = ags.agendamento_id
                JOIN servicos s ON ags.servico_id = s.id
                WHERE a.data_agendada = $1
                AND a.status = 'concluido'
                LIMIT 3
            `;
            
            const result = await pool.query(query, [dataHoje]);
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar serviços populares hoje:', error);
            return [];
        }
    }
}

module.exports = new DashboardService();