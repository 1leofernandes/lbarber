// Rotas de autenticação
const express = require('express');
const router = express.Router();
const passport = require('passport');
const AuthController = require('../controllers/authController');

// POST /auth/registrar
router.post('/registrar', AuthController.register);

// POST /auth/registrar-barbeiro
router.post('/registrar-barbeiro', AuthController.registerBarber);

// POST /auth/login
router.post('/login', AuthController.login);

// POST /auth/esqueci-senha
router.post('/esqueci-senha', AuthController.requestPasswordReset);

// POST /auth/resetar-senha/:token
router.post('/resetar-senha/:token', AuthController.resetPassword);

// ==================== GOOGLE OAUTH ====================

// GET /auth/google - Iniciar autenticação Google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// GET /auth/google/callback - Callback do Google
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login.html?error=google_auth_failed`,
    session: false
  }),
  AuthController.googleCallback
);

module.exports = router;
