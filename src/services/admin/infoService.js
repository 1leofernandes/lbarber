const Config = require('../../models/Config');

class InfoService {
    async getInformacoesBarbearia() {
        try {
            const informacoes = await Config.getInformacoesBarbearia();
            const horarios = await Config.getHorariosFuncionamento();
            
            return {
                ...informacoes,
                horarios: this.formatarHorarios(horarios)
            };
        } catch (error) {
            console.error('Erro ao buscar informações da barbearia:', error);
            throw error;
        }
    }

    async atualizarInformacoesBarbearia(informacoes) {
        try {
            // Validar dados
            await this.validarInformacoes(informacoes);
            
            // Salvar informações
            return await Config.setInformacoesBarbearia(informacoes);
        } catch (error) {
            console.error('Erro ao atualizar informações da barbearia:', error);
            throw error;
        }
    }

    async getHorariosFuncionamento() {
        try {
            const horarios = await Config.getHorariosFuncionamento();
            return this.formatarHorarios(horarios);
        } catch (error) {
            console.error('Erro ao buscar horários de funcionamento:', error);
            throw error;
        }
    }

    async atualizarHorariosFuncionamento(horarios) {
        try {
            // Validar horários
            await this.validarHorarios(horarios);
            
            // Formatar para salvar
            const horariosParaSalvar = {};
            Object.entries(horarios).forEach(([dia, horario]) => {
                horariosParaSalvar[`horario_${dia}`] = horario;
            });
            
            // Salvar horários
            return await Config.setHorariosFuncionamento(horariosParaSalvar);
        } catch (error) {
            console.error('Erro ao atualizar horários de funcionamento:', error);
            throw error;
        }
    }

    async getConfiguracoes() {
        try {
            const todasConfigs = await Config.getAll();
            
            const configs = {};
            todasConfigs.forEach(config => {
                configs[config.chave] = config.valor;
            });
            
            return configs;
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            throw error;
        }
    }

    async atualizarConfiguracao(chave, valor) {
        try {
            if (!chave || typeof chave !== 'string') {
                throw new Error('Chave da configuração é obrigatória');
            }
            
            return await Config.set(chave, valor);
        } catch (error) {
            console.error('Erro ao atualizar configuração:', error);
            throw error;
        }
    }

    formatarHorarios(horariosRaw) {
        const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
        const horariosFormatados = {};
        
        diasSemana.forEach(dia => {
            const horario = horariosRaw[`horario_${dia}`];
            if (horario) {
                horariosFormatados[dia] = horario;
            } else {
                horariosFormatados[dia] = 'Fechado';
            }
        });
        
        return horariosFormatados;
    }

    async validarInformacoes(informacoes) {
        const { nome_barbearia, endereco, telefone, email, instagram, whatsapp } = informacoes;
        
        if (!nome_barbearia || nome_barbearia.trim().length < 3) {
            throw new Error('Nome da barbearia deve ter pelo menos 3 caracteres');
        }
        
        if (!endereco || endereco.trim().length < 10) {
            throw new Error('Endereço deve ter pelo menos 10 caracteres');
        }
        
        if (telefone && !/^\(\d{2}\) \d{5}-\d{4}$/.test(telefone)) {
            throw new Error('Telefone inválido. Use o formato (99) 99999-9999');
        }
        
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Email inválido');
        }
        
        return true;
    }

    async validarHorarios(horarios) {
        const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
        
        for (const dia of diasSemana) {
            const horario = horarios[dia];
            
            if (!horario) {
                throw new Error(`Horário para ${dia} é obrigatório`);
            }
            
            if (horario !== 'Fechado') {
                const partes = horario.split(' - ');
                if (partes.length !== 2) {
                    throw new Error(`Formato de horário inválido para ${dia}. Use "HH:MM - HH:MM" ou "Fechado"`);
                }
                
                const [abertura, fechamento] = partes;
                if (!this.validarHora(abertura) || !this.validarHora(fechamento)) {
                    throw new Error(`Horário inválido para ${dia}. Use formato HH:MM`);
                }
                
                const horaAbertura = parseInt(abertura.split(':')[0]);
                const minutoAbertura = parseInt(abertura.split(':')[1]);
                const horaFechamento = parseInt(fechamento.split(':')[0]);
                const minutoFechamento = parseInt(fechamento.split(':')[1]);
                
                const minutosAbertura = horaAbertura * 60 + minutoAbertura;
                const minutosFechamento = horaFechamento * 60 + minutoFechamento;
                
                if (minutosFechamento <= minutosAbertura) {
                    throw new Error(`Horário de fechamento deve ser após a abertura para ${dia}`);
                }
            }
        }
        
        return true;
    }

    validarHora(hora) {
        const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        return regex.test(hora);
    }

    async getPoliticas() {
        try {
            const politicas = {};
            
            const politicasChaves = [
                'politica_cancelamento',
                'termos_uso',
                'politica_privacidade'
            ];
            
            for (const chave of politicasChaves) {
                const valor = await Config.get(chave);
                politicas[chave] = valor || '';
            }
            
            return politicas;
        } catch (error) {
            console.error('Erro ao buscar políticas:', error);
            throw error;
        }
    }

    async atualizarPoliticas(politicas) {
        try {
            const resultados = [];
            
            for (const [chave, valor] of Object.entries(politicas)) {
                const resultado = await Config.set(chave, valor);
                resultados.push(resultado);
            }
            
            return resultados;
        } catch (error) {
            console.error('Erro ao atualizar políticas:', error);
            throw error;
        }
    }

    async getDadosContato() {
        try {
            const query = `
                SELECT chave, valor
                FROM configs
                WHERE chave IN ('telefone_contato', 'email_contato', 'endereco_contato')
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query);
            
            const dados = {};
            result.rows.forEach(row => {
                dados[row.chave] = row.valor;
            });
            
            return dados;
        } catch (error) {
            console.error('Erro ao buscar dados de contato:', error);
            throw error;
        }
    }
}

module.exports = new InfoService();