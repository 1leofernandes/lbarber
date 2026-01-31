// src/utils/chargeScheduler.js
const subscriptionRecurrentService = require('../services/subscriptionRecurrentService');
const logger = require('./logger');

let schedulerInterval = null;

class ChargeScheduler {
    static start() {
        // Executar a cada 1 hora
        schedulerInterval = setInterval(() => {
            this.checkAndProcessCharges();
        }, 60 * 60 * 1000);

        // Executar imediatamente na inicialização
        this.checkAndProcessCharges();

        logger.info('Agendador de cobranças iniciado (a cada 1 hora)');
    }

    static stop() {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            schedulerInterval = null;
            logger.info('Agendador de cobranças parado');
        }
    }

    static async checkAndProcessCharges() {
        try {
            logger.info('Verificando cobranças vencidas...');
            await subscriptionRecurrentService.processarCobrancasDiarias();
        } catch (error) {
            logger.error('Erro ao processar cobranças no agendador:', error);
        }
    }
}

module.exports = ChargeScheduler;
