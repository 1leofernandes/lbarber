const Pagamento = require('../../models/Payment');
const Assinatura = require('../../models/Subscription');
const Agendamento = require('../../models/Appointment');
const Usuario = require('../../models/User');

class PagamentoService {
    async getAllPagamentos(filters = {}, limit = 100, offset = 0) {
        try {
            return await Pagamento.findAll(filters, limit, offset);
        } catch (error) {
            console.error('Erro ao buscar pagamentos:', error);
            throw error;
        }
    }

    async getPagamentoById(id) {
        try {
            const pagamento = await Pagamento.findById(id);
            if (!pagamento) {
                throw new Error('Pagamento não encontrado');
            }
            return pagamento;
        } catch (error) {
            console.error('Erro ao buscar pagamento:', error);
            throw error;
        }
    }

    async createPagamento(pagamentoData) {
        try {
            // Validar dados
            await this.validarPagamento(pagamentoData);
            
            return await Pagamento.create(pagamentoData);
        } catch (error) {
            console.error('Erro ao criar pagamento:', error);
            throw error;
        }
    }

    async updateStatus(id, status) {
        try {
            const statusValidos = ['pendente', 'pago', 'cancelado', 'reembolsado', 'falhou'];
            
            if (!statusValidos.includes(status)) {
                throw new Error('Status inválido');
            }
            
            return await Pagamento.updateStatus(id, status);
        } catch (error) {
            console.error('Erro ao atualizar status do pagamento:', error);
            throw error;
        }
    }

    async confirmarPagamento(id, dadosConfirmacao) {
        try {
            const { transacao_id, metodo_pagamento, data_pagamento } = dadosConfirmacao;
            
            const pagamento = await Pagamento.findById(id);
            if (!pagamento) {
                throw new Error('Pagamento não encontrado');
            }
            
            // Atualizar pagamento
            const pagamentoAtualizado = await Pagamento.updateStatus(id, 'pago');
            
            // Atualizar transação relacionada
            if (pagamento.agendamento_id) {
                await Agendamento.updateStatus(pagamento.agendamento_id, 'confirmado');
            }
            
            if (pagamento.assinatura_id) {
                await Assinatura.updateStatus(pagamento.assinatura_id, 'ativo');
            }
            
            return pagamentoAtualizado;
        } catch (error) {
            console.error('Erro ao confirmar pagamento:', error);
            throw error;
        }
    }

    async validarPagamento(pagamentoData) {
        const { usuario_id, agendamento_id, assinatura_id, tipo, valor } = pagamentoData;
        
        // Validar tipo
        const tiposValidos = ['assinatura', 'agendamento'];
        if (!tiposValidos.includes(tipo)) {
            throw new Error('Tipo de pagamento inválido');
        }
        
        // Validar usuário
        const usuario = await Usuario.findById(usuario_id);
        if (!usuario) {
            throw new Error('Usuário não encontrado');
        }
        
        // Validar valor
        if (!valor || valor <= 0) {
            throw new Error('Valor do pagamento deve ser positivo');
        }
        
        // Validar referência (agendamento ou assinatura)
        if (tipo === 'agendamento') {
            if (!agendamento_id) {
                throw new Error('ID do agendamento é obrigatório para pagamentos de agendamento');
            }
            
            const agendamento = await Agendamento.findById(agendamento_id);
            if (!agendamento) {
                throw new Error('Agendamento não encontrado');
            }
            
            // Verificar se já existe pagamento para este agendamento
            const pagamentoExistente = await this.verificarPagamentoExistente('agendamento', agendamento_id);
            if (pagamentoExistente) {
                throw new Error('Já existe um pagamento para este agendamento');
            }
        }
        
        if (tipo === 'assinatura') {
            if (!assinatura_id) {
                throw new Error('ID da assinatura é obrigatório para pagamentos de assinatura');
            }
            
            const assinatura = await Assinatura.findById(assinatura_id);
            if (!assinatura) {
                throw new Error('Assinatura não encontrada');
            }
            
            // Verificar se já existe pagamento recente para esta assinatura
            const pagamentoExistente = await this.verificarPagamentoExistente('assinatura', assinatura_id);
            if (pagamentoExistente) {
                throw new Error('Já existe um pagamento recente para esta assinatura');
            }
        }
        
        return true;
    }

    async verificarPagamentoExistente(tipo, referencia_id) {
        try {
            const query = `
                SELECT COUNT(*) as total
                FROM pagamentos
                WHERE tipo = $1
                AND (
                    (tipo = 'agendamento' AND agendamento_id = $2)
                    OR (tipo = 'assinatura' AND assinatura_id = $2)
                )
                AND status IN ('pendente', 'pago')
                AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [tipo, referencia_id]);
            
            return parseInt(result.rows[0].total) > 0;
        } catch (error) {
            console.error('Erro ao verificar pagamento existente:', error);
            throw error;
        }
    }

    async getResumoFinanceiro(data_inicio, data_fim) {
        try {
            const receitas = await Pagamento.getReceitaTotal(data_inicio, data_fim);
            
            let totalPago = 0;
            let totalPendente = 0;
            let totalCancelado = 0;
            let totalAgendamentos = 0;
            let totalAssinaturas = 0;
            
            receitas.forEach(receita => {
                if (receita.status === 'pago') {
                    totalPago += parseFloat(receita.total);
                } else if (receita.status === 'pendente') {
                    totalPendente += parseFloat(receita.total);
                } else if (receita.status === 'cancelado') {
                    totalCancelado += parseFloat(receita.total);
                }
                
                if (receita.tipo === 'agendamento') {
                    totalAgendamentos += parseFloat(receita.quantidade);
                } else if (receita.tipo === 'assinatura') {
                    totalAssinaturas += parseFloat(receita.quantidade);
                }
            });
            
            return {
                totalPago,
                totalPendente,
                totalCancelado,
                totalAgendamentos,
                totalAssinaturas,
                totalGeral: totalPago + totalPendente,
                receitasDetalhadas: receitas
            };
        } catch (error) {
            console.error('Erro ao buscar resumo financeiro:', error);
            throw error;
        }
    }

    async getPagamentosPorPeriodo(periodo = 'mes') {
        try {
            let intervalo;
            switch (periodo) {
                case 'dia':
                    intervalo = '1 day';
                    break;
                case 'semana':
                    intervalo = '7 days';
                    break;
                case 'mes':
                    intervalo = '30 days';
                    break;
                case 'ano':
                    intervalo = '365 days';
                    break;
                default:
                    intervalo = '30 days';
            }
            
            const query = `
                SELECT 
                    DATE(data_pagamento) as data,
                    COUNT(*) as quantidade,
                    COALESCE(SUM(valor), 0) as total,
                    tipo,
                    status
                FROM pagamentos
                WHERE data_pagamento >= CURRENT_DATE - INTERVAL '${intervalo}'
                GROUP BY DATE(data_pagamento), tipo, status
                ORDER BY data DESC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar pagamentos por período:', error);
            throw error;
        }
    }

    async gerarRelatorio(data_inicio, data_fim) {
        try {
            const pagamentos = await this.getAllPagamentos({
                data_inicio,
                data_fim
            }, 1000, 0);
            
            const resumo = await this.getResumoFinanceiro(data_inicio, data_fim);
            
            return {
                periodo: {
                    inicio: data_inicio,
                    fim: data_fim
                },
                resumo: resumo,
                pagamentos: pagamentos,
                totalPagamentos: pagamentos.length
            };
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            throw error;
        }
    }

    async getMetodosPagamentoEstatisticas() {
        try {
            const query = `
                SELECT 
                    metodo_pagamento,
                    COUNT(*) as quantidade,
                    COALESCE(SUM(valor), 0) as total
                FROM pagamentos
                WHERE status = 'pago'
                AND data_pagamento >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY metodo_pagamento
                ORDER BY total DESC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar estatísticas de métodos de pagamento:', error);
            throw error;
        }
    }
}

module.exports = new PagamentoService();