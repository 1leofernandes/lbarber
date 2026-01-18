// Utilitário de cache com fallback para quando Redis não está disponível
const redis = require('../config/redis');
const logger = require('./logger');

const cache = {
  // Tentar usar Redis, com fallback para memória
  async get(key) {
    try {
      const value = await redis.get(key);
      if (value) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value);
      }
      return null;
    } catch (err) {
      logger.warn(`Cache GET erro: ${key}`, err.message);
      return null;
    }
  },

  async set(key, value, ttl = 3600) {
    try {
      await redis.setEx(key, ttl, JSON.stringify(value));
      logger.debug(`Cache SET: ${key}`);
    } catch (err) {
      logger.warn(`Cache SET erro: ${key}`, err.message);
    }
  },

  async delete(key) {
    try {
      await redis.del(key);
      logger.debug(`Cache DELETE: ${key}`);
    } catch (err) {
      logger.warn(`Cache DELETE erro: ${key}`, err.message);
    }
  },

  async invalidatePattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
        logger.debug(`Cache invalidated pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (err) {
      logger.warn(`Cache invalidate pattern erro: ${pattern}`, err.message);
    }
  }
};

module.exports = cache;
