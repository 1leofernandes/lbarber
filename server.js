require('dotenv').config();
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('passport');

// Importar configuração do Passport
require('./src/config/passport');

// Importar rotas
const authRoutes = require('./src/routes/auth');
const appointmentRoutes = require('./src/routes/appointments');
const serviceRoutes = require('./src/routes/services');
const barberRoutes = require('./src/routes/barbeiros');
const paymentRoutes = require('./src/routes/payments');

// Importar middlewares
const errorHandler = require('./src/middlewares/errorHandler');
const logger = require('./src/utils/logger');

const app = express();
const port = process.env.PORT || 3000;

// ==================== SEGURANÇA E OTIMIZAÇÃO ====================

app.set('trust proxy', 1);


// Helmet: Headers de segurança
app.use(helmet());

// Compression: Comprime respostas (gzip)
app.use(compression());

// Rate Limiting: Protege contra DoS
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Muitas requisições, tente novamente mais tarde',
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limit apenas em rotas públicas sensíveis
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true
});

// ==================== CORS ====================

const corsOptions = {
  origin: [
    'https://lbarber.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    process.env.FRONTEND_URL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400 // 24 horas
};

app.use(cors(corsOptions));

// ==================== SESSION & PASSPORT ====================

app.use(passport.initialize());
// ==================== PARSING ====================

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// ==================== STATIC FILES ====================

app.use(express.static('public', {
  maxAge: '1d', // Cache por 1 dia
  etag: false
}));

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== ROTAS ====================

// Rate limit em rotas de autenticação
app.use('/auth/login', authLimiter);
app.use('/auth/registrar', authLimiter);
app.use('/auth/esqueci-senha', authLimiter);

// Rotas com rate limit geral
app.use('/auth', limiter, authRoutes);
app.use('/usuarios', limiter, require('./routes/usuarioRoutes'));
app.use('/agendamentos', limiter, appointmentRoutes);
app.use('/servicos', limiter, serviceRoutes);
app.use('/barbeiros', limiter, barberRoutes);
app.use('/pagamentos', limiter, paymentRoutes);

// ==================== 404 HANDLER ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// ==================== ERROR HANDLER ====================

app.use(errorHandler);

// ==================== INICIAR SERVIDOR ====================

const server = app.listen(port, () => {
  logger.info(`🚀 Servidor rodando em http://localhost:${port}`);
  logger.info(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido. Encerrando servidor gracefully...');
  server.close(() => {
    logger.info('Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido. Encerrando servidor gracefully...');
  server.close(() => {
    logger.info('Servidor encerrado');
    process.exit(0);
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason });
});

module.exports = app;
