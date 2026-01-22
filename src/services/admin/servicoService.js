const Servico = require('../../models/Servico');
const Plano = require('../../models/Plano');

class ServicoService {
    async getAllServicos(ativosOnly = true) {
        try {
            return await Servico.findAll(ativosOnly);
        } catch (error) {
            console.error('Erro ao buscar serviços:', error);
            throw error;
        }
    }

    async getServicoById(id) {
        try {
            const servico = await Servico.findById(id);
            if (!servico) {
                throw new Error('Serviço não encontrado');
            }
            return servico;
        } catch (error) {
            console.error('Erro ao buscar serviço:', error);
            throw error;
        }
    }

    async createServico(servicoData) {
        try {
            // Validar dados
            await this.validarServico(servicoData);
            
            // Validar assinaturas (se fornecidas)
            if (servicoData.assinatura_ids && servicoData.assinatura_ids.length > 0) {
                await this.validarAssinaturas(servicoData.assinatura_ids);
            }
            
            return await Servico.create(servicoData);
        } catch (error) {
            console.error('Erro ao criar serviço:', error);
            throw error;
        }
    }

    async updateServico(id, servicoData) {
        try {
            const servicoExistente = await Servico.findById(id);
            if (!servicoExistente) {
                throw new Error('Serviço não encontrado');
            }
            
            // Validar dados
            await this.validarServico(servicoData);
            
            // Validar assinaturas (se fornecidas)
            if (servicoData.assinatura_ids && servicoData.assinatura_ids.length > 0) {
                await this.validarAssinaturas(servicoData.assinatura_ids);
            }
            
            return await Servico.update(id, servicoData);
        } catch (error) {
            console.error('Erro ao atualizar serviço:', error);
            throw error;
        }
    }

    async deleteServico(id) {
        try {
            const servico = await Servico.findById(id);
            if (!servico) {
                throw new Error('Serviço não encontrado');
            }
            
            // Verificar se o serviço está sendo usado em agendamentos futuros
            const temAgendamentos = await this.verificarAgendamentosFuturos(id);
            if (temAgendamentos) {
                throw new Error('Não é possível excluir este serviço pois existem agendamentos futuros vinculados a ele');
            }
            
            return await Servico.delete(id);
        } catch (error) {
            console.error('Erro ao excluir serviço:', error);
            throw error;
        }
    }

    async validarServico(servicoData) {
        const { nome_servico, duracao_servico, valor_servico } = servicoData;
        
        if (!nome_servico || nome_servico.trim().length < 3) {
            throw new Error('Nome do serviço deve ter pelo menos 3 caracteres');
        }
        
        if (!duracao_servico || duracao_servico < 15) {
            throw new Error('Duração do serviço deve ser de pelo menos 15 minutos');
        }
        
        if (duracao_servico % 15 !== 0) {
            throw new Error('Duração do serviço deve ser múltiplo de 15 minutos');
        }
        
        if (!valor_servico || valor_servico < 0) {
            throw new Error('Valor do serviço deve ser positivo');
        }
        
        return true;
    }

    async validarAssinaturas(assinatura_ids) {
        try {
            for (const assinatura_id of assinatura_ids) {
                const plano = await Plano.findById(assinatura_id);
                if (!plano) {
                    throw new Error(`Plano de assinatura ${assinatura_id} não encontrado`);
                }
            }
            return true;
        } catch (error) {
            console.error('Erro ao validar assinaturas:', error);
            throw error;
        }
    }

    async verificarAgendamentosFuturos(servico_id) {
        try {
            const query = `
                SELECT COUNT(*) as total
                FROM agendamentos
                WHERE servico_id = $1
                AND data_agendada >= CURRENT_DATE
                AND status NOT IN ('cancelado')
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [servico_id]);
            
            return parseInt(result.rows[0].total) > 0;
        } catch (error) {
            console.error('Erro ao verificar agendamentos futuros:', error);
            throw error;
        }
    }

    async getServicosPorAssinatura(assinatura_id) {
        try {
            return await Servico.getServicosPorAssinatura(assinatura_id);
        } catch (error) {
            console.error('Erro ao buscar serviços por assinatura:', error);
            throw error;
        }
    }

    async atualizarStatus(id, ativo) {
        try {
            const servico = await Servico.findById(id);
            if (!servico) {
                throw new Error('Serviço não encontrado');
            }
            
            return await Servico.update(id, { ...servico, ativo });
        } catch (error) {
            console.error('Erro ao atualizar status do serviço:', error);
            throw error;
        }
    }

    async getEstatisticasServicos() {
        try {
            const query = `
                SELECT 
                    s.id,
                    s.nome_servico,
                    COUNT(a.id) as total_agendamentos,
                    COALESCE(SUM(s.valor_servico), 0) as receita_total,
                    AVG(EXTRACT(EPOCH FROM (a.updated_at - a.created_at)) / 60) as tempo_medio_servico
                FROM servicos s
                LEFT JOIN agendamentos a ON s.id = a.servico_id
                WHERE a.status = 'finalizado'
                AND a.data_agendada >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY s.id, s.nome_servico
                ORDER BY total_agendamentos DESC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar estatísticas dos serviços:', error);
            throw error;
        }
    }
}

module.exports = new ServicoService();