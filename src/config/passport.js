// Configuração do Passport com Google OAuth
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');
const logger = require('../utils/logger');

// ==================== GOOGLE STRATEGY ====================

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const nome = profile.displayName;
        const email = profile.emails?.[0]?.value || null;

        if (!email) {
          return done(new Error('Email não encontrado no perfil do Google'));
        }

        // 🔍 1. Verificar se o usuário já existe
        const existingUser = await db.query(
          'SELECT * FROM usuarios WHERE email = $1',
          [email]
        );

        // ✅ 2. Usuário já existe → login
        if (existingUser.rows.length > 0) {
          return done(null, existingUser.rows[0]);
        }

        // 🆕 3. Criar usuário novo via Google
        const newUser = await db.query(
          `
          INSERT INTO usuarios (
            nome,
            email,
            google_id,
            role,
            telefone,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          RETURNING *
          `,
          [
            nome,
            email,
            googleId,
            'cliente',
            null // telefone será coletado depois
          ]
        );

        logger.info(`Novo usuário criado via Google: ${email}`);
        return done(null, newUser.rows[0]);
      } catch (error) {
        logger.error('Erro ao processar autenticação Google:', error);
        return done(error);
      }
    }
  )
);

// ❌ NÃO USAR serialize/deserialize
// ❌ NÃO USAR session
// Autenticação será via JWT após o callback

module.exports = passport;
