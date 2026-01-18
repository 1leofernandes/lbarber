// Rotas de autenticação
const express = require('express');
const router = express.Router();
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

module.exports = router;
