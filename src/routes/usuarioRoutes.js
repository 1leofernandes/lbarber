const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authMiddleware);

// GET /api/usuarios/me - Obter dados do usuário logado
router.get('/me', usuarioController.getMe);

// PUT /api/usuarios/me - Atualizar dados do usuário
router.put('/me', usuarioController.updateMe);

// DELETE /api/usuarios/me - Deletar conta do usuário
router.delete('/me', usuarioController.deleteMe);

module.exports = router;