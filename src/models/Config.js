const pool = require('../config/database');

class Config {
    static async get(key) {
        const query = 'SELECT valor FROM configs WHERE chave = $1';
        const result = await pool.query(query, [key]);
        return result.rows[0]?.valor;
    }

    static async set(key, value) {
        const query = `
            INSERT INTO configs (chave, valor)
            VALUES ($1, $2)
            ON CONFLICT (chave) 
            DO UPDATE SET valor = $2, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const result = await pool.query(query, [key, value]);
        return result.rows[0];
    }

    static async getAll() {
        const query = 'SELECT chave, valor FROM configs ORDER BY chave';
        const result = await pool.query(query);
        return result.rows;
    }

    static async getHorariosFuncionamento() {
        const query = `
            SELECT chave, valor 
            FROM configs 
            WHERE chave LIKE 'horario_%'
        `;
        const result = await pool.query(query);
        
        const horarios = {};
        result.rows.forEach(row => {
            horarios[row.chave] = row.valor;
        });
        
        return horarios;
    }

    static async setHorariosFuncionamento(horarios) {
        const results = [];
        
        for (const [chave, valor] of Object.entries(horarios)) {
            const result = await this.set(chave, valor);
            results.push(result);
        }
        
        return results;
    }

    static async getInformacoesBarbearia() {
        const query = `
            SELECT chave, valor 
            FROM configs 
            WHERE chave IN (
                'nome_barbearia', 'endereco', 'telefone', 
                'email', 'instagram', 'whatsapp', 'sobre'
            )
        `;
        const result = await pool.query(query);
        
        const informacoes = {};
        result.rows.forEach(row => {
            informacoes[row.chave] = row.valor;
        });
        
        return informacoes;
    }

    static async setInformacoesBarbearia(informacoes) {
        const results = [];
        
        for (const [chave, valor] of Object.entries(informacoes)) {
            const result = await this.set(chave, valor);
            results.push(result);
        }
        
        return results;
    }
}

module.exports = Config;