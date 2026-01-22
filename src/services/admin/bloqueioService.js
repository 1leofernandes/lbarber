const Bloqueio = require('../../models/Bloqueio');
const Barbeiro = require('../../models/Barbeiro');

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
        const { tipo, data_inicio, data_fim, hora_inicio, hora_fim } = bloqueioData;
        
        // Validar tipo
        const tiposValidos = ['dia', 'horario'];
        if (!tiposValidos.includes(tipo)) {
            throw new Error('Tipo de bloqueio inválido');
        }
        
        // Validar datas
        const dataInicio = new Date(data_inicio);
        const dataFim = new Date(data_fim || data_inicio);
        
        if (isNaN(dataInicio.getTime())) {
            throw new Error('Data de início inválida');
        }
        
        if (data_fim && isNaN(dataFim.getTime())) {
            throw new Error('Data de fim inválida');
        }
        
        if (dataFim < dataInicio) {
            throw new Error('Data de fim não pode ser anterior à data de início');
        }
        
        // Validar horários para bloqueio do tipo 'horario'
        if (tipo === 'horario') {
            if (!hora_inicio || !hora_fim) {
                throw new Error('Horário de início e fim são obrigatórios para bloqueios do tipo "horario"');
            }
            
            const horaInicio = parseInt(hora_inicio.split(':')[0]);
            const minutoInicio = parseInt(hora_inicio.split(':')[1]);
            const horaFim = parseInt(hora_fim.split(':')[0]);
            const minutoFim = parseInt(hora_fim.split(':')[1]);
            
            if (horaInicio < 0 || horaInicio > 23 || minutoInicio < 0 || minutoInicio > 59) {
                throw new Error('Horário de início inválido');
            }
            
            if (horaFim < 0 || horaFim > 23 || minutoFim < 0 || minutoFim > 59) {
                throw new Error('Horário de fim inválido');
            }
            
            const inicioMinutos = horaInicio * 60 + minutoInicio;
            const fimMinutos = horaFim * 60 + minutoFim;
            
            if (fimMinutos <= inicioMinutos) {
                throw new Error('Horário de fim deve ser após o horário de início');
            }
        }
        
        return true;
    }

    async verificarSobreposicao(bloqueioData, excluirBloqueioId = null) {
        try {
            const { tipo, data_inicio, data_fim, hora_inicio, hora_fim, barbeiro_id } = bloqueioData;
            
            let query = `
                SELECT COUNT(*) as total
                FROM bloqueios
                WHERE ativo = true
                AND (
                    (barbeiro_id = $1 OR barbeiro_id IS NULL)
                    OR $1 IS NULL
                )
                AND (
            `;
            
            const params = [barbeiro_id];
            let paramCount = 2;
            
            if (tipo === 'dia') {
                // Para bloqueios de dia inteiro, verificar sobreposição de datas
                query += `(tipo = 'dia' AND (
                    (data_inicio <= $${paramCount} AND data_fim >= $${paramCount})
                    OR (data_inicio <= $${paramCount + 1} AND data_fim >= $${paramCount + 1})
                    OR ($${paramCount} <= data_inicio AND $${paramCount + 1} >= data_fim)
                ))`;
                params.push(data_inicio, data_fim || data_inicio);
                paramCount += 2;
            } else if (tipo === 'horario') {
                // Para bloqueios de horário, verificar sobreposição mais complexa
                query += `(tipo = 'horario' AND (
                    (data_inicio <= $${paramCount} AND data_fim >= $${paramCount})
                    OR (data_inicio <= $${paramCount + 1} AND data_fim >= $${paramCount + 1})
                    OR ($${paramCount} <= data_inicio AND $${paramCount + 1} >= data_fim)
                )
                AND NOT ($${paramCount + 2} >= hora_fim OR $${paramCount + 3} <= hora_inicio))`;
                params.push(data_inicio, data_fim || data_inicio, hora_fim, hora_inicio);
                paramCount += 4;
            }
            
            query += `)`;
            
            if (excluirBloqueioId) {
                query += ` AND id != $${paramCount}`;
                params.push(excluirBloqueioId);
            }
            
            const pool = require('../../config/database');
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