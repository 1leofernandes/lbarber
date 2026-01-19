// Configuração do Passport com Google OAuth
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const db = require('./database');
const logger = require('../utils/logger');

// Configurar estratégia Google
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extrair dados do Google
        const { id, displayName, emails } = profile;
        const email = emails && emails.length > 0 ? emails[0].value : null;

        if (!email) {
          return done(new Error('Email não encontrado no perfil do Google'));
        }

        // Verificar se usuário existe
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(query, [email]);

        if (result.rows.length > 0) {
          // Usuário existe, atualizar nome
          const user = result.rows[0];
          const updateQuery = `
            UPDATE users 
            SET google_id = $1, nome = $2, atualizado_em = NOW()
            WHERE email = $3
            RETURNING *
          `;
          const updateResult = await db.query(updateQuery, [id, displayName, email]);
          return done(null, updateResult.rows[0]);
        } else {
          // Criar novo usuário via Google
          const insertQuery = `
            INSERT INTO users (nome, email, google_id, role, telefone, criado_em, atualizado_em)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING *
          `;
          const insertResult = await db.query(insertQuery, [
            displayName,
            email,
            id,
            'cliente',
            '' // telefone vazio inicialmente
          ]);
          logger.info(`Novo usuário criado via Google: ${email}`);
          return done(null, insertResult.rows[0]);
        }
      } catch (err) {
        logger.error('Erro ao processar autenticação Google:', err);
        return done(err);
      }
    }
  )
);

// Serializar usuário
// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// // Desserializar usuário
// passport.deserializeUser(async (id, done) => {
//   try {
//     const query = 'SELECT * FROM users WHERE id = $1';
//     const result = await db.query(query, [id]);
//     if (result.rows.length > 0) {
//       done(null, result.rows[0]);
//     } else {
//       done(null, false);
//     }
//   } catch (err) {
//     done(err);
//   }
// });

module.exports = passport;
