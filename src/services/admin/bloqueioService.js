const Bloqueio = require('../../models/Block');
const Barbeiro = require('../../models/Barber');

class BloqueioService {
    async getAllBloqueios(filters = {}) {
        try {
            return await Bloqueio.findAll(filters);
        } catch (error) {
            console.error('Erro ao buscar bloqueios:', error);
            throw error;
        }
    }

    async getBloqueioById(id) {
        try {
            const bloqueio = await Bloqueio.findById(id);
            if (!bloqueio) {
                throw new Error('Bloqueio não encontrado');
            }
            return bloqueio;
        } catch (error) {
            console.error('Erro ao buscar bloqueio:', error);
            throw error;
        }
    }

    async createBloqueio(bloqueioData) {
        try {
            // Validar dados
            await this.validarBloqueio(bloqueioData);
            
            // Verificar se barbeiro existe (se aplicável)
            if (bloqueioData.barbeiro_id) {
                const barbeiro = await Barbeiro.findById(bloqueioData.barbeiro_id);
                if (!barbeiro) {
                    throw new Error('Barbeiro não encontrado');
                }
            }
            
            // Verificar sobreposição com bloqueios existentes
            const sobreposicao = await this.verificarSobreposicao(bloqueioData);
            if (sobreposicao) {
                throw new Error('Já existe um bloqueio neste período');
            }
            
            return await Bloqueio.create(bloqueioData);
        } catch (error) {
            console.error('Erro ao criar bloqueio:', error);
            throw error;
        }
    }

    async updateBloqueio(id, bloqueioData) {
        try {
            const bloqueioExistente = await Bloqueio.findById(id);
            if (!bloqueioExistente) {
                throw new Error('Bloqueio não encontrado');
            }
            
            // Validar dados
            await this.validarBloqueio(bloqueioData);
            
            // Verificar sobreposição com outros bloqueios (excluindo este)
            const sobreposicao = await this.verificarSobreposicao(bloqueioData, id);
            if (sobreposicao) {
                throw new Error('Já existe um bloqueio neste período');
            }
            
            return await Bloqueio.update(id, bloqueioData);
        } catch (error) {
            console.error('Erro ao atualizar bloqueio:', error);
            throw error;
        }
    }

    async deleteBloqueio(id) {
        try {
            const bloqueio = await Bloqueio.findById(id);
            if (!bloqueio) {
                throw new Error('Bloqueio não encontrado');
            }
            
            return await Bloqueio.delete(id);
        } catch (error) {
            console.error('Erro ao excluir bloqueio:', error);
            throw error;
        }
    }

    async validarBloqueio(bloqueioData) {
        const { tipo, data_inicio, data_fim, hora_inicio, hora_fim, dias_semana } = bloqueioData;
        
        // Validar tipo
        const tiposValidos = ['dia', 'horario', 'periodo', 'recorrente'];
        if (!tiposValidos.includes(tipo)) {
            throw new Error('Tipo de bloqueio inválido');
        }
        
        // Validar datas
        const dataInicio = new Date(data_inicio);
        const dataFim = data_fim ? new Date(data_fim) : new Date(data_inicio);
        
        if (isNaN(dataInicio.getTime())) {
            throw new Error('Data de início inválida');
        }
        
        if (data_fim && isNaN(dataFim.getTime())) {
            throw new Error('Data de fim inválida');
        }
        
        if (dataFim < dataInicio) {
            throw new Error('Data de fim não pode ser anterior à data de início');
        }
        
        // Validar horários para bloqueios que precisam de horário
        if (tipo === 'horario' || tipo === 'recorrente') {
            if (!hora_inicio || !hora_fim) {
                throw new Error('Horário de início e fim são obrigatórios para este tipo');
            }
            
            // Validar formato do horário (HH:MM)
            const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!horaRegex.test(hora_inicio) || !horaRegex.test(hora_fim)) {
                throw new Error('Formato de horário inválido. Use HH:MM');
            }
            
            const [hInicio, mInicio] = hora_inicio.split(':').map(Number);
            const [hFim, mFim] = hora_fim.split(':').map(Number);
            
            const inicioMinutos = hInicio * 60 + mInicio;
            const fimMinutos = hFim * 60 + mFim;
            
            if (fimMinutos <= inicioMinutos) {
                throw new Error('Horário de fim deve ser após o horário de início');
            }
        }
        
        // Validar dias da semana para bloqueio recorrente
        if (tipo === 'recorrente') {
            if (!dias_semana || !Array.isArray(dias_semana) || dias_semana.length === 0) {
                throw new Error('Dias da semana são obrigatórios para bloqueios recorrentes');
            }
            
            for (let dia of dias_semana) {
                if (dia < 1 || dia > 7) {
                    throw new Error('Dias da semana devem ser entre 1 (segunda) e 7 (domingo)');
                }
            }
        }
        
        return true;
    }

    async verificarSobreposicao(bloqueioData, excluirBloqueioId = null) {
        try {
            const { tipo, data_inicio, data_fim, hora_inicio, hora_fim, barbeiro_id } = bloqueioData;
            
            const pool = require('../../config/database');
            let query;
            let params = [];
            
            // Query base
            let baseQuery = `
                SELECT COUNT(*) as total
                FROM bloqueios
                WHERE ativo = true
            `;
            
            // Condição para barbeiro
            if (barbeiro_id) {
                baseQuery += ` AND (barbeiro_id = $${params.length + 1} OR barbeiro_id IS NULL)`;
                params.push(barbeiro_id);
            } else {
                baseQuery += ` AND barbeiro_id IS NULL`;
            }
            
            // Condição específica por tipo
            if (tipo === 'dia') {
                // Para bloqueios de dia inteiro, verificar sobreposição de datas
                baseQuery += ` AND tipo = 'dia' AND (
                    (data_inicio <= $${params.length + 1} AND COALESCE(data_fim, data_inicio) >= $${params.length + 1})
                    OR (data_inicio <= $${params.length + 2} AND COALESCE(data_fim, data_inicio) >= $${params.length + 2})
                    OR ($${params.length + 1} <= data_inicio AND $${params.length + 2} >= COALESCE(data_fim, data_inicio))
                )`;
                params.push(data_inicio, data_fim || data_inicio);
                
            } else if (tipo === 'horario' || tipo === 'recorrente') {
                // Para bloqueios de horário ou recorrente, verificar sobreposição de datas e horários
                baseQuery += ` AND tipo IN ('horario', 'recorrente') AND (
                    (
                        (data_inicio <= $${params.length + 1} AND COALESCE(data_fim, data_inicio) >= $${params.length + 1})
                        OR (data_inicio <= $${params.length + 2} AND COALESCE(data_fim, data_inicio) >= $${params.length + 2})
                        OR ($${params.length + 1} <= data_inicio AND $${params.length + 2} >= COALESCE(data_fim, data_inicio))
                    )
                    AND NOT ($${params.length + 4} <= hora_inicio OR $${params.length + 3} >= hora_fim)
                )`;
                params.push(data_inicio, data_fim || data_inicio, hora_fim, hora_inicio);
                
                // Para bloqueios recorrentes, também verificar dias da semana
                if (tipo === 'recorrente' && bloqueioData.dias_semana && bloqueioData.dias_semana.length > 0) {
                    baseQuery += ` AND (
                        dias_semana IS NULL 
                        OR dias_semana && $${params.length + 1}::integer[]
                    )`;
                    params.push(bloqueioData.dias_semana);
                }
            }
            
            // Excluir o próprio bloqueio se estiver editando
            if (excluirBloqueioId) {
                baseQuery += ` AND id != $${params.length + 1}`;
                params.push(excluirBloqueioId);
            }
            
            query = baseQuery;
            
            console.log('Query de verificação:', query);
            console.log('Parâmetros:', params);
            
            const result = await pool.query(query, params);
            return parseInt(result.rows[0].total) > 0;
            
        } catch (error) {
            console.error('Erro ao verificar sobreposição de bloqueios:', error);
            throw error;
        }
    }

    async getBloqueiosPorBarbeiro(barbeiro_id) {
        try {
            return await Bloqueio.findAll({ barbeiro_id });
        } catch (error) {
            console.error('Erro ao buscar bloqueios por barbeiro:', error);
            throw error;
        }
    }

    async getBloqueiosGerais() {
        try {
            return await Bloqueio.findAll({ barbeiro_id: null });
        } catch (error) {
            console.error('Erro ao buscar bloqueios gerais:', error);
            throw error;
        }
    }

    async desativarBloqueio(id) {
        try {
            return await Bloqueio.update(id, { ativo: false });
        } catch (error) {
            console.error('Erro ao desativar bloqueio:', error);
            throw error;
        }
    }
}

module.exports = new BloqueioService();