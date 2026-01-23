const Barbeiro = require('../../models/Barber');
const Usuario = require('../../models/User');
const Agendamento = require('../../models/Appointment');
const bcrypt = require('bcrypt');

class BarbeiroService {
    async getAllBarbeiros(ativosOnly = true) {
        try {
            const barbeiros = await Barbeiro.findAll(ativosOnly);
            
            // Adicionar estatísticas para cada barbeiro
            const barbeirosComEstatisticas = await Promise.all(
                barbeiros.map(async (barbeiro) => {
                    const estatisticas = await this.getEstatisticasBarbeiro(barbeiro.id);
                    return { ...barbeiro, ...estatisticas };
                })
            );
            
            return barbeirosComEstatisticas;
        } catch (error) {
            console.error('Erro ao buscar barbeiros:', error);
            throw error;
        }
    }

    async getBarbeiroById(id) {
        try {
            const barbeiro = await Barbeiro.findById(id);
            if (!barbeiro) {
                throw new Error('Barbeiro não encontrado');
            }
            
            const estatisticas = await this.getEstatisticasBarbeiro(id);
            return { ...barbeiro, ...estatisticas };
        } catch (error) {
            console.error('Erro ao buscar barbeiro:', error);
            throw error;
        }
    }

    async createBarbeiro(barbeiroData) {
        try {
            // Validar dados
            await this.validarBarbeiro(barbeiroData);
            
            // Verificar se email já existe
            const usuarioExistente = await Usuario.findByEmail(barbeiroData.email);
            if (usuarioExistente) {
                throw new Error('Email já cadastrado');
            }
            
            // Criptografar senha
            const salt = await bcrypt.genSalt(10);
            const senhaCriptografada = await bcrypt.hash(barbeiroData.senha, salt);
            
            // Criar barbeiro
            const dadosBarbeiro = {
                ...barbeiroData,
                senha: senhaCriptografada
            };
            
            return await Barbeiro.create(dadosBarbeiro);
        } catch (error) {
            console.error('Erro ao criar barbeiro:', error);
            throw error;
        }
    }

    async updateBarbeiro(id, barbeiroData) {
        try {
            const barbeiroExistente = await Barbeiro.findById(id);
            if (!barbeiroExistente) {
                throw new Error('Barbeiro não encontrado');
            }
            
            // Validar dados
            await this.validarBarbeiro(barbeiroData, true);
            
            // Verificar se email já existe (se foi alterado)
            if (barbeiroData.email && barbeiroData.email !== barbeiroExistente.email) {
                const usuarioExistente = await Usuario.findByEmail(barbeiroData.email);
                if (usuarioExistente && usuarioExistente.id !== id) {
                    throw new Error('Email já cadastrado para outro usuário');
                }
            }
            
            // Criptografar senha (se fornecida)
            if (barbeiroData.senha) {
                const salt = await bcrypt.genSalt(10);
                barbeiroData.senha = await bcrypt.hash(barbeiroData.senha, salt);
            } else {
                delete barbeiroData.senha;
            }
            
            return await Barbeiro.update(id, barbeiroData);
        } catch (error) {
            console.error('Erro ao atualizar barbeiro:', error);
            throw error;
        }
    }

    async promoverParaBarbeiro(usuario_id, especialidades = []) {
        try {
            const usuario = await Usuario.findById(usuario_id);
            if (!usuario) {
                throw new Error('Usuário não encontrado');
            }
            
            // Verificar se já é barbeiro
            if (usuario.roles && usuario.roles.includes('barbeiro')) {
                throw new Error('Usuário já é barbeiro');
            }
            
            return await Barbeiro.promoverParaBarbeiro(usuario_id, especialidades);
        } catch (error) {
            console.error('Erro ao promover usuário para barbeiro:', error);
            throw error;
        }
    }

    async rebaixarParaCliente(usuario_id) {
        try {
            const barbeiro = await Barbeiro.findById(usuario_id);
            if (!barbeiro) {
                throw new Error('Barbeiro não encontrado');
            }
            
            // Verificar se há agendamentos futuros
            const temAgendamentosFuturos = await this.verificarAgendamentosFuturos(usuario_id);
            if (temAgendamentosFuturos) {
                throw new Error('Não é possível rebaixar barbeiro com agendamentos futuros');
            }
            
            return await Barbeiro.rebaixarParaCliente(usuario_id);
        } catch (error) {
            console.error('Erro ao rebaixar barbeiro para cliente:', error);
            throw error;
        }
    }

    async deleteBarbeiro(id) {
        try {
            const barbeiro = await Barbeiro.findById(id);
            if (!barbeiro) {
                throw new Error('Barbeiro não encontrado');
            }
            
            // Verificar se há agendamentos futuros
            const temAgendamentosFuturos = await this.verificarAgendamentosFuturos(id);
            if (temAgendamentosFuturos) {
                throw new Error('Não é possível excluir barbeiro com agendamentos futuros');
            }
            
            return await Barbeiro.delete(id);
        } catch (error) {
            console.error('Erro ao excluir barbeiro:', error);
            throw error;
        }
    }

    async validarBarbeiro(barbeiroData, isUpdate = false) {
        const { nome, email, telefone, cpf, data_nascimento } = barbeiroData;
        
        if (!isUpdate || nome !== undefined) {
            if (!nome || nome.trim().length < 3) {
                throw new Error('Nome deve ter pelo menos 3 caracteres');
            }
        }
        
        if (!isUpdate || email !== undefined) {
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error('Email inválido');
            }
        }
        
        if (!isUpdate || telefone !== undefined) {
            if (!telefone || !/^\(\d{2}\) \d{5}-\d{4}$/.test(telefone)) {
                throw new Error('Telefone inválido. Use o formato (99) 99999-9999');
            }
        }
        
        if (!isUpdate || cpf !== undefined) {
            if (!cpf || !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf)) {
                throw new Error('CPF inválido. Use o formato 999.999.999-99');
            }
        }
        
        if (!isUpdate || data_nascimento !== undefined) {
            if (!data_nascimento || isNaN(new Date(data_nascimento).getTime())) {
                throw new Error('Data de nascimento inválida');
            }
            
            const idade = this.calcularIdade(data_nascimento);
            if (idade < 18) {
                throw new Error('Barbeiro deve ter pelo menos 18 anos');
            }
        }
        
        return true;
    }

    calcularIdade(dataNascimento) {
        const hoje = new Date();
        const nascimento = new Date(dataNascimento);
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const mes = hoje.getMonth() - nascimento.getMonth();
        
        if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
            idade--;
        }
        
        return idade;
    }

    async verificarAgendamentosFuturos(barbeiro_id) {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            const query = `
                SELECT COUNT(*) as total
                FROM agendamentos
                WHERE barbeiro_id = $1
                AND data_agendada >= $2
                AND status NOT IN ('cancelado')
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [barbeiro_id, hoje]);
            
            return parseInt(result.rows[0].total) > 0;
        } catch (error) {
            console.error('Erro ao verificar agendamentos futuros:', error);
            throw error;
        }
    }

    async getEstatisticasBarbeiro(barbeiro_id) {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            
            const [
                agendamentosHoje,
                agendamentosMes,
                receitaMes,
                avaliacaoMedia
            ] = await Promise.all([
                Barbeiro.getAgendamentosHoje(barbeiro_id),
                this.getAgendamentosMes(barbeiro_id),
                this.getReceitaMes(barbeiro_id),
                this.getAvaliacaoMedia(barbeiro_id)
            ]);
            
            return {
                agendamentosHoje,
                agendamentosMes,
                receitaMes,
                avaliacaoMedia
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas do barbeiro:', error);
            return {
                agendamentosHoje: 0,
                agendamentosMes: 0,
                receitaMes: 0,
                avaliacaoMedia: 0
            };
        }
    }

    async getAgendamentosMes(barbeiro_id) {
        try {
            const hoje = new Date();
            const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            
            const query = `
                SELECT COUNT(*) as total
                FROM agendamentos
                WHERE barbeiro_id = $1
                AND data_agendada BETWEEN $2 AND $3
                AND status NOT IN ('cancelado')
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [
                barbeiro_id,
                primeiroDiaMes.toISOString().split('T')[0],
                ultimoDiaMes.toISOString().split('T')[0]
            ]);
            
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao contar agendamentos do mês:', error);
            return 0;
        }
    }

    async getReceitaMes(barbeiro_id) {
        try {
            const hoje = new Date();
            const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            
            const query = `
                SELECT COALESCE(SUM(s.valor_servico), 0) as total
                FROM agendamentos a
                JOIN servicos s ON a.servico_id = s.id
                WHERE a.barbeiro_id = $1
                AND a.data_agendada BETWEEN $2 AND $3
                AND a.status = 'finalizado'
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [
                barbeiro_id,
                primeiroDiaMes.toISOString().split('T')[0],
                ultimoDiaMes.toISOString().split('T')[0]
            ]);
            
            return parseFloat(result.rows[0].total);
        } catch (error) {
            console.error('Erro ao calcular receita do mês:', error);
            return 0;
        }
    }

    async getAvaliacaoMedia(barbeiro_id) {
        try {
            const query = `
                SELECT COALESCE(AVG(avaliacao), 0) as media
                FROM avaliacoes
                WHERE barbeiro_id = $1
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query, [barbeiro_id]);
            
            return parseFloat(result.rows[0].media);
        } catch (error) {
            console.error('Erro ao buscar avaliação média:', error);
            return 0;
        }
    }

    async getClientesParaPromover() {
        try {
            const query = `
                SELECT id, nome, email, telefone, created_at
                FROM usuarios
                WHERE 'cliente' = ANY(roles)
                AND NOT 'barbeiro' = ANY(roles)
                AND NOT 'admin' = ANY(roles)
                AND ativo = true
                ORDER BY nome ASC
            `;
            
            const pool = require('../../config/database');
            const result = await pool.query(query);
            
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar clientes para promover:', error);
            throw error;
        }
    }
}

module.exports = new BarbeiroService();