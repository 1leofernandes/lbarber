const Assinatura = require('../../models/Assinatura');
const Plano = require('../../models/Plano');
const Usuario = require('../../models/Usuario');

class AssinaturaService {
    async getAllAssinaturas(filters = {}) {
        try {
            return await Assinatura.findAll(filters);
        } catch (error) {
            console.error('Erro ao buscar assinaturas:', error);
            throw error;
        }
    }

    async getAssinaturaById(id) {
        try {
            const assinatura = await Assinatura.findById(id);
            if (!assinatura) {
                throw new Error('Assinatura não encontrada');
            }
            return assinatura;
        } catch (error) {
            console.error('Erro ao buscar assinatura:', error);
            throw error;
        }
    }

    async getAssinaturaByUsuarioId(usuario_id) {
        try {
            return await Assinatura.findByUsuarioId(usuario_id);
        } catch (error) {
            console.error('Erro ao buscar assinatura do usuário:', error);
            throw error;
        }
    }

    async createAssinatura(assinaturaData) {
        try {
            // Validar dados
            await this.validarAssinatura(assinaturaData);
            
            // Verificar se usuário já tem assinatura ativa
            const assinaturaAtiva = await Assinatura.findByUsuarioId(assinaturaData.usuario_id);
            if (assinaturaAtiva) {
                throw new Error('Usuário já possui uma assinatura ativa');
            }
            
            return await Assinatura.create(assinaturaData);
        } catch (error) {
            console.error('Erro ao criar assinatura:', error);
            throw error;
        }
    }

    async updateAssinatura(id, assinaturaData) {
        try {
            const assinaturaExistente = await Assinatura.findById(id);
            if (!assinaturaExistente) {
                throw new Error('Assinatura não encontrada');
            }
            
            // Validar dados
            await this.validarAssinatura(assinaturaData, true);
            
            return await Assinatura.update(id, assinaturaData);
        } catch (error) {
            console.error('Erro ao atualizar assinatura:', error);
            throw error;
        }
    }

    async updateStatus(id, status) {
        try {
            const statusValidos = ['ativo', 'pendente', 'cancelado', 'suspenso'];
            
            if (!statusValidos.includes(status)) {
                throw new Error('Status inválido');
            }
            
            return await Assinatura.updateStatus(id, status);
        } catch (error) {
            console.error('Erro ao atualizar status da assinatura:', error);
            throw error;
        }
    }

    async cancelarAssinatura(id) {
        try {
            return await this.updateStatus(id, 'cancelado');
        } catch (error) {
            console.error('Erro ao cancelar assinatura:', error);
            throw error;
        }
    }

    async deleteAssinatura(id) {
        try {
            const assinatura = await Assinatura.findById(id);
            if (!assinatura) {
                throw new Error('Assinatura não encontrada');
            }
            
            // Verificar se a assinatura está ativa
            if (assinatura.status === 'ativo') {
                throw new Error('Não é possível excluir uma assinatura ativa');
            }
            
            return await Assinatura.delete(id);
        } catch (error) {
            console.error('Erro ao excluir assinatura:', error);
            throw error;
        }
    }

    async validarAssinatura(assinaturaData, isUpdate = false) {
        const { usuario_id, plano_id, data_inicio, data_vencimento } = assinaturaData;
        
        if (!isUpdate || usuario_id !== undefined) {
            if (!usuario_id) {
                throw new Error('ID do usuário é obrigatório');
            }
            
            const usuario = await Usuario.findById(usuario_id);
            if (!usuario) {
                throw new Error('Usuário não encontrado');
            }
        }
        
        if (!isUpdate || plano_id !== undefined) {
            if (!plano_id) {
                throw new Error('ID do plano é obrigatório');
            }
            
            const plano = await Plano.findById(plano_id);
            if (!plano) {
                throw new Error('Plano não encontrado');
            }
            
            if (!plano.ativo) {
                throw new Error('Plano não está ativo');
            }
        }
        
        if (!isUpdate || data_inicio !== undefined) {
            if (!data_inicio || isNaN(new Date(data_inicio).getTime())) {
                throw new Error('Data de início inválida');
            }
            
            const dataInicio = new Date(data_inicio);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            if (dataInicio < hoje) {
                throw new Error('Data de início não pode ser no passado');
            }
        }
        
        if (!isUpdate || data_vencimento !== undefined) {
            if (!data_vencimento || isNaN(new Date(data_vencimento).getTime())) {
                throw new Error('Data de vencimento inválida');
            }
            
            const dataVencimento = new Date(data_vencimento);
            const dataInicio = new Date(data_inicio || new Date());
            
            if (dataVencimento <= dataInicio) {
                throw new Error('Data de vencimento deve ser após a data de início');
            }
        }
        
        return true;
    }

    async renovarAssinatura(id) {
        try {
            const assinatura = await Assinatura.findById(id);
            if (!assinatura) {
                throw new Error('Assinatura não encontrada');
            }
            
            if (assinatura.status !== 'ativo') {
                throw new Error('Apenas assinaturas ativas podem ser renovadas');
            }
            
            // Calcular nova data de vencimento (adicionar 30 dias)
            const dataVencimentoAtual = new Date(assinatura.data_vencimento);
            const novaDataVencimento = new Date(dataVencimentoAtual);
            novaDataVencimento.setDate(novaDataVencimento.getDate() + 30);
            
            return await Assinatura.update(id, {
                data_vencimento: novaDataVencimento.toISOString().split('T')[0]
            });
        } catch (error) {
            console.error('Erro ao renovar assinatura:', error);
            throw error;
        }
    }

    async getAssinaturasVencendo(dias = 7) {
        try {
            const hoje = new Date();
            const dataLimite = new Date(hoje);
            dataLimite.setDate(dataLimite.getDate() + dias);
            
            const query = `
                SELECT a.*, 
                       u.nome as cliente_nome, u.email as cliente_email,
                       p.nome as plano_nome, p.valor_mensal
                FROM assinaturas a
                JOIN usuarios u ON a.usuario_id = u.id
                JOIN planos p ON a.plano_id = p.id
                WHERE a.status = 'ativo'
                AND a.data_vencimento BETWEEN $1 AND $2
                ORDER BY a.data_vencimento ASC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [
                hoje.toISOString().split('T')[0],
                dataLimite.toISOString().split('T')[0]
            ]);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar assinaturas vencendo:', error);
            throw error;
        }
    }

    async getEstatisticasAssinaturas() {
        try {
            const [
                totalAtivas,
                totalPendentes,
                totalCanceladas,
                receitaMensal,
                crescimento
            ] = await Promise.all([
                Assinatura.count('ativo'),
                Assinatura.count('pendente'),
                Assinatura.count('cancelado'),
                this.calcularReceitaMensal(),
                this.calcularCrescimentoAssinaturas()
            ]);
            
            return {
                totalAtivas,
                totalPendentes,
                totalCanceladas,
                receitaMensal,
                crescimento
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas de assinaturas:', error);
            throw error;
        }
    }

    async calcularReceitaMensal() {
        try {
            const receitaMensal = await Assinatura.getReceitaMensal();
            const hoje = new Date();
            const mesAtual = hoje.getMonth() + 1;
            const anoAtual = hoje.getFullYear();
            
            const receita = receitaMensal.find(r => 
                parseInt(r.mes) === mesAtual && parseInt(r.ano) === anoAtual
            );
            
            return receita ? parseFloat(receita.receita_total) : 0;
        } catch (error) {
            console.error('Erro ao calcular receita mensal:', error);
            return 0;
        }
    }

    async calcularCrescimentoAssinaturas() {
        try {
            const hoje = new Date();
            const mesAtual = hoje.getMonth() + 1;
            const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
            const anoAnterior = mesAtual === 1 ? hoje.getFullYear() - 1 : hoje.getFullYear();
            
            const query = `
                SELECT 
                    EXTRACT(MONTH FROM data_inicio) as mes,
                    EXTRACT(YEAR FROM data_inicio) as ano,
                    COUNT(*) as total
                FROM assinaturas
                WHERE status = 'ativo'
                AND (
                    (EXTRACT(YEAR FROM data_inicio) = $1 AND EXTRACT(MONTH FROM data_inicio) = $2)
                    OR (EXTRACT(YEAR FROM data_inicio) = $3 AND EXTRACT(MONTH FROM data_inicio) = $4)
                )
                GROUP BY EXTRACT(YEAR FROM data_inicio), EXTRACT(MONTH FROM data_inicio)
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [
                hoje.getFullYear(), mesAtual,
                anoAnterior, mesAnterior
            ]);
            
            const totalMesAtual = result.rows.find(r => 
                parseInt(r.mes) === mesAtual && parseInt(r.ano) === hoje.getFullYear()
            )?.total || 0;
            
            const totalMesAnterior = result.rows.find(r => 
                parseInt(r.mes) === mesAnterior && parseInt(r.ano) === anoAnterior
            )?.total || 0;
            
            if (totalMesAnterior === 0) {
                return totalMesAtual > 0 ? 100 : 0;
            }
            
            return ((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100;
        } catch (error) {
            console.error('Erro ao calcular crescimento de assinaturas:', error);
            return 0;
        }
    }
}

module.exports = new AssinaturaService();