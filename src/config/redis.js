require('dotenv').config();
const redis = require('redis');

// Cliente Redis para cache
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: máximo de tentativas de reconexão atingido');
        return new Error('Máximo de reconexões atingido');
      }
      return retries * 50;
    }
  }
});

redisClient.on('error', (err) => {
  console.warn('⚠️ Aviso Redis:', err.message);
  // Redis não é crítico, só para cache
});

redisClient.on('connect', () => {
  console.log('✅ Conectado ao Redis');
});

redisClient.on('ready', () => {
  console.log('✅ Redis pronto para uso');
});

// Conectar ao Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️ Redis não disponível. Cache desabilitado.');
  }
})();

module.exports = redisClient;
