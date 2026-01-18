// Logger estruturado para facilitar debugging e monitoramento
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = levels[process.env.LOG_LEVEL || 'info'];

const logger = {
  error: (message, data = {}) => {
    if (currentLevel >= levels.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, data);
    }
  },
  warn: (message, data = {}) => {
    if (currentLevel >= levels.warn) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
    }
  },
  info: (message, data = {}) => {
    if (currentLevel >= levels.info) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
    }
  },
  debug: (message, data = {}) => {
    if (currentLevel >= levels.debug) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
    }
  }
};

module.exports = logger;
